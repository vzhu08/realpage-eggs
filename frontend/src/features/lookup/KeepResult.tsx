import { useEffect, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../../api/errors';
import { PACKAGE_ENDPOINT, packageFailure, packageRequestBody } from '../../api/evidencePackage';
import type { DataMode, EvidencePackage, LookupOutcome } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, ErrorNotice, Facts, SectionHeading, Spinner, Tag } from '../../components/ui';
import { DEMO_ONLY } from '../../config';
import { formatDate } from '../../lib/dates';
import { buildWorkingExport, downloadJson, downloadText, workingExportFilename } from '../../lib/exportPackage';
import { formatValue, humanize } from '../../lib/labels';
import type { SessionState } from '../../state/session';
import { useSource } from '../../state/source';

/** The two labels the service can put on a package, in words. The raw label is shown beside them. */
const ARTIFACT_LABEL: Record<EvidencePackage['artifact_label'], string> = {
  SYNTHETIC_NOT_FOR_SUBMISSION: 'Synthetic data · not for submission',
  RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION: 'Research evidence · not legal validation',
};

type PackageState =
  | { status: 'idle'; withdrawn?: boolean }
  | { status: 'loading' }
  | { status: 'saved'; pack: EvidencePackage; filename: string; bytes: number; delivered: boolean }
  | { status: 'error'; error: ApiError };

interface Props {
  session: SessionState;
  outcome: LookupOutcome;
  mode: DataMode;
  apiBase?: string;
  busy: boolean;
}

const kilobytes = (bytes: number) => (bytes < 1024 ? `${bytes} bytes` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} kB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Two ways to keep a result, kept apart because they are different things. The evidence
 * package is built by the service for exactly the request that produced the result on screen
 * and carries the source texts and hashes. The working export is assembled in the browser from
 * what is on screen.
 */
export function KeepResult({ session, outcome, mode, apiBase, busy }: Props) {
  const source = useSource();
  const { lookup } = outcome;
  const [pack, setPack] = useState<PackageState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const [exported, setExported] = useState<'idle' | 'done' | 'failed'>('idle');
  const [shownExport, setShownExport] = useState<string | null>(null);

  // A package belongs to one result. A new result (another date, property or answer), or this
  // section leaving the page, withdraws any request still in flight: its response can then
  // neither save a file nor show a receipt.
  useEffect(() => {
    setPack((current) => ({ status: 'idle', withdrawn: current.status === 'loading' || (current.status === 'idle' && current.withdrawn === true) }));
    setExported('idle');
    setShownExport(null);
    return () => controller.current?.abort();
  }, [outcome]);

  // While the result is being re-evaluated it is about to be replaced, so a package still being
  // built would describe an answer or date state the reader has already left.
  useEffect(() => {
    if (!busy || !controller.current || controller.current.signal.aborted) return;
    controller.current.abort();
    setPack((current) => (current.status === 'loading' ? { status: 'idle', withdrawn: true } : current));
  }, [busy]);

  // The request is the one that produced the result on screen: its property, its date and every
  // request-local answer, explicit unknowns included. Never the form's current, unsent state.
  const request = packageRequestBody(outcome.query);
  const unknowns = request.answers.filter((answer) => answer.value === null).length;
  const answerWords = request.answers.length === 0 ? 'no answers' : `${count(request.answers.length, 'answer', 'answers')} of yours${unknowns ? ` (${unknowns} marked unknown)` : ''}`;
  const subject = lookup.address.raw_address.street_address || outcome.query.address_id;
  // The service builds packages for saved properties, through the live API only.
  const supported = !!source.evidencePackage && outcome.origin.kind === 'live' && !outcome.fixture;

  const downloadPackage = async () => {
    if (!source.evidencePackage) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPack({ status: 'loading' });
    try {
      const result = await source.evidencePackage(outcome.query, abort.signal);
      // The result changed, the property changed or this section left the page while waiting.
      if (abort.signal.aborted) return;
      setPack({ status: 'saved', pack: result.package, filename: result.filename, bytes: result.byteLength, delivered: downloadText(result.filename, result.text) });
    } catch (error) {
      if (abort.signal.aborted || isAbort(error)) return;
      setPack({ status: 'error', error: toApiError(error, PACKAGE_ENDPOINT) });
    }
  };
  const cancelPackage = () => {
    controller.current?.abort();
    setPack({ status: 'idle' });
  };

  // The export time is the only clock value in the file, and it is labeled as such there.
  const buildExport = () => buildWorkingExport({ outcome, answers: session.answers, history: session.history, mode, apiBase, exportedAt: new Date().toISOString() });
  const exportResult = () => setExported(downloadJson(workingExportFilename(lookup.address.address_id, lookup.as_of), buildExport()) ? 'done' : 'failed');
  const failure = pack.status === 'error' ? packageFailure(pack.error) : null;

  return (
    <section className="section keep" aria-labelledby="export-heading">
      <SectionHeading
        id="export-heading"
        title="Keep this result"
        aside={
          <span className="hint">
            {subject} · as of {formatDate(lookup.as_of)} · {answerWords}
          </span>
        }
      />
      <div className="keep__grid">
        <article className="keep__card keep__card--package" aria-labelledby="package-title" data-package={pack.status}>
          <h3 id="package-title" className="keep__title">
            Evidence package
          </h3>
          <p className="keep__text">
            Built by the service for exactly the result on screen: the original property record, every rule and source text used, the full response with your answers and their provenance, and hashes of the inputs, the response and the code version.
          </p>
          {supported ? (
            <>
              <div className="keep__actions">
                <button type="button" className="button button--primary" onClick={() => void downloadPackage()} disabled={busy || pack.status === 'loading'}>
                  <Icon name="download" />
                  {pack.status === 'loading' ? 'Building the package…' : 'Download evidence package'}
                </button>
                {pack.status === 'loading' && (
                  <>
                    <Spinner label="The service is assembling the package" />
                    <button type="button" className="button button--small button--quiet" onClick={cancelPackage}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {busy && <p className="hint">Available again when the result has finished updating. A package is always built for the result on screen.</p>}
              {pack.status === 'idle' && pack.withdrawn && (
                <p className="hint" role="status" data-package-withdrawn>
                  The package request was withdrawn because the result was being updated. Nothing was saved.
                </p>
              )}
              <Disclosure summary="What is sent to the service">
                <Facts
                  dense
                  rows={[
                    { label: 'Request', value: <span className="mono break">{PACKAGE_ENDPOINT}</span>, note: apiBase ? `At ${apiBase}` : undefined },
                    { label: 'Property', value: <span className="mono break">{request.address_id}</span>, note: 'A saved property ID. Typed addresses are not supported by this route.' },
                    { label: 'As of', value: <span className="mono">{request.as_of}</span> },
                    {
                      label: 'Answers',
                      value:
                        request.answers.length === 0 ? (
                          'None'
                        ) : (
                          <ul className="plain-list plain-list--tight">
                            {request.answers.map((answer) => (
                              <li key={answer.field}>
                                <span className="mono">{answer.field}</span> = {answer.value === null ? 'unknown (sent as null)' : <span className="mono break">{JSON.stringify(answer.value)}</span>} · {humanize(answer.provenance)}
                              </li>
                            ))}
                          </ul>
                        ),
                      note: 'Every answer behind this result is sent, including those marked unknown. Answers are unverified and are not stored by the service.',
                    },
                  ]}
                />
                <p className="hint">The service echoes this request inside the package. A package that names another property, date or set of answers is refused and not saved.</p>
              </Disclosure>
              {pack.status === 'saved' && (
                <div className="keep__receipt" role="status" data-label={pack.pack.artifact_label}>
                  <p className="keep__saved">
                    {pack.delivered ? (
                      <>
                        Saved as <span className="mono break">{pack.filename}</span> · {kilobytes(pack.bytes)}, exactly as the service sent it
                      </>
                    ) : (
                      'The package was built, but this browser did not allow the download.'
                    )}
                  </p>
                  <p className="keep__label">
                    <Tag tone={pack.pack.artifact_label === 'SYNTHETIC_NOT_FOR_SUBMISSION' ? 'unknown' : 'info'}>{ARTIFACT_LABEL[pack.pack.artifact_label] ?? pack.pack.artifact_label}</Tag>
                    <span className="mono">{pack.pack.artifact_label}</span>
                  </p>
                  <p className="keep__text">{pack.pack.disclaimer}</p>
                  <p className="keep__text" data-package-contents>
                    Inside: the original record for this property, {count(Object.keys(pack.pack.inputs.rules).length, 'rule', 'rules')}, {count(Object.keys(pack.pack.inputs.sources).length, 'source text', 'source texts')}, and the full response as of{' '}
                    {formatDate(pack.pack.response.lookup.as_of)} with{' '}
                    {pack.pack.response.answers_applied.length === 0
                      ? 'no answers applied'
                      : `${count(pack.pack.response.answers_applied.length, 'answer', 'answers')} applied (${pack.pack.response.answers_applied.map((answer) => `${humanize(answer.field)}: ${answer.value === null || answer.value === undefined ? 'unknown' : formatValue(answer.value)}, ${humanize(answer.provenance ?? 'user_provided')}`).join('; ')})`}
                    .
                  </p>
                  <Disclosure summary={`Hashes and limitations (${pack.pack.limitations.length})`}>
                    <Facts
                      dense
                      rows={[
                        { label: 'Package', value: <span className="mono break">{pack.pack.package_sha256}</span> },
                        { label: 'Inputs', value: <span className="mono break">{pack.pack.input_sha256}</span>, note: 'Identifies the replay inputs for this property, not the whole dataset.' },
                        { label: 'Response', value: <span className="mono break">{pack.pack.response_sha256}</span> },
                        { label: 'Code version', value: <span className="mono break">{pack.pack.code.fingerprint}</span>, note: `Pipeline ${pack.pack.code.pipeline_version} · Python ${pack.pack.code.python_version}` },
                        { label: 'Format', value: <span className="mono">{pack.pack.format_version ?? 'evidence-package-v1'}</span> },
                      ]}
                    />
                    <ul className="plain-list plain-list--tight" aria-label="Limitations stated in the package">
                      {pack.pack.limitations.map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                    </ul>
                    <p className="hint">Hashes identify content; they are not signatures. A package that replays to the same output does not establish that the law was read correctly.</p>
                  </Disclosure>
                </div>
              )}
              {pack.status === 'error' && failure && (
                <ErrorNotice
                  error={pack.error}
                  context={`Evidence package for ${outcome.query.address_id} as of ${formatDate(lookup.as_of)}`}
                  actions={
                    failure.retry ? (
                      <button type="button" className="button button--small" onClick={() => void downloadPackage()} disabled={busy}>
                        Try again
                      </button>
                    ) : undefined
                  }
                >
                  <p>{failure.text}</p>
                  <p>The result on screen is unaffected.</p>
                </ErrorNotice>
              )}
            </>
          ) : (
            <p className="keep__unavailable" data-package-unavailable>
              {outcome.fixture
                ? 'Not available for a contract example: the package is built by the live service for a saved property.'
                : mode === 'demo'
                  ? 'Not available in the synthetic demo: the package is built by the live service for a saved property, and the demo only replays recordings. Switch to the live API to download one.'
                  : 'Not available for this result: it did not come from the live service.'}
            </p>
          )}
        </article>

        <article className="keep__card" aria-labelledby="working-title">
          <h3 id="working-title" className="keep__title">
            Working export
          </h3>
          <p className="keep__text">
            Assembled in this browser from what is on screen, including the order of your answers. It carries no source texts and no input, response or code hashes, and nothing in it is re-verified. It is not the evidence package.
          </p>
          {DEMO_ONLY ? (
            // A hosted preview cannot hand the viewer a file, so the same content is shown on the page.
            <>
              <div className="keep__actions">
                <button type="button" className="button" aria-expanded={shownExport !== null} onClick={() => setShownExport((current) => (current === null ? JSON.stringify(buildExport(), null, 2) : null))} disabled={busy}>
                  {shownExport === null ? 'Show working export (JSON)' : 'Hide working export'}
                </button>
              </div>
              <p className="hint">This hosted preview cannot save files. Run the app locally to download the same file.</p>
              {shownExport !== null && (
                <pre className="raw export__preview" tabIndex={0} aria-label="Working export">
                  {shownExport}
                </pre>
              )}
            </>
          ) : (
            <div className="keep__actions">
              <button type="button" className="button" onClick={exportResult} disabled={busy}>
                <Icon name="download" />
                Download working export (JSON)
              </button>
              <span className="hint" role="status">
                {exported === 'done' ? 'Download started.' : exported === 'failed' ? 'This browser did not allow the download.' : ''}
              </span>
            </div>
          )}
        </article>
      </div>
      <p className="hint">Model review is reported as the service records it. No independent human review is recorded in either file.</p>
    </section>
  );
}
