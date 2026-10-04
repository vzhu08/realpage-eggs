import { useEffect, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../../api/errors';
import type { DataMode, EvidencePackage, LookupOutcome } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, ErrorNotice, Facts, SectionHeading, Spinner, Tag } from '../../components/ui';
import { DEMO_ONLY } from '../../config';
import { formatDate } from '../../lib/dates';
import { buildWorkingExport, downloadJson, downloadText, workingExportFilename } from '../../lib/exportPackage';
import type { SessionState } from '../../state/session';
import { useSource } from '../../state/source';

/** The two labels the service can put on a package, in words. The raw label is shown beside them. */
const ARTIFACT_LABEL: Record<EvidencePackage['artifact_label'], string> = {
  SYNTHETIC_NOT_FOR_SUBMISSION: 'Synthetic data · not for submission',
  RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION: 'Research evidence · not legal validation',
};

type PackageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'saved'; pack: EvidencePackage; filename: string; delivered: boolean }
  | { status: 'error'; error: ApiError };

interface Props {
  session: SessionState;
  outcome: LookupOutcome;
  mode: DataMode;
  apiBase?: string;
  busy: boolean;
}

/**
 * Two ways to keep a result, kept apart because they are different things. The evidence
 * package is built by the service for exactly the request on screen and carries the source
 * texts and hashes. The working export is assembled in the browser from what is on screen.
 */
export function KeepResult({ session, outcome, mode, apiBase, busy }: Props) {
  const source = useSource();
  const { lookup } = outcome;
  const [pack, setPack] = useState<PackageState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const [exported, setExported] = useState<'idle' | 'done' | 'failed'>('idle');
  const [shownExport, setShownExport] = useState<string | null>(null);

  // A package belongs to one result. A new result (another date, property or answer) withdraws
  // any request still in flight and clears what was reported for the earlier one.
  useEffect(() => {
    setPack({ status: 'idle' });
    setExported('idle');
    setShownExport(null);
    return () => controller.current?.abort();
  }, [outcome]);

  const answers = outcome.query.answers;
  const answerWords = answers.length === 0 ? 'no answers' : `${answers.length} request-local ${answers.length === 1 ? 'answer' : 'answers'}`;
  // The service builds packages for saved properties through the assist route's request shape.
  const supported = !!source.evidencePackage && outcome.origin.kind === 'live';

  const downloadPackage = async () => {
    if (!source.evidencePackage) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPack({ status: 'loading' });
    try {
      // The request is the one that produced the result on screen: same property, date and answers.
      const result = await source.evidencePackage(outcome.query, abort.signal);
      if (abort.signal.aborted) return;
      setPack({ status: 'saved', pack: result.package, filename: result.filename, delivered: downloadText(result.filename, result.text) });
    } catch (error) {
      if (abort.signal.aborted || isAbort(error)) return;
      setPack({ status: 'error', error: toApiError(error, 'POST /lookup/evidence-package') });
    }
  };
  const cancelPackage = () => {
    controller.current?.abort();
    setPack({ status: 'idle' });
  };

  // The export time is the only clock value in the file, and it is labeled as such there.
  const buildExport = () => buildWorkingExport({ outcome, answers: session.answers, history: session.history, mode, apiBase, exportedAt: new Date().toISOString() });
  const exportResult = () => setExported(downloadJson(workingExportFilename(lookup.address.address_id, lookup.as_of), buildExport()) ? 'done' : 'failed');

  return (
    <section className="section keep" aria-labelledby="export-heading">
      <SectionHeading
        id="export-heading"
        title="Keep this result"
        aside={
          <span className="hint">
            <span className="mono">{outcome.query.address_id}</span> · as of {formatDate(lookup.as_of)} · {answerWords}
          </span>
        }
      />
      <div className="keep__grid">
        <article className="keep__card keep__card--package" aria-labelledby="package-title" data-package={pack.status}>
          <h3 id="package-title" className="keep__title">
            Evidence package
          </h3>
          <p className="keep__text">
            Built by the service for exactly this request: the original property record, every rule and source text used, the full response with your answers and their provenance, and hashes of the inputs, the response and the code version.
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
              {pack.status === 'saved' && (
                <div className="keep__receipt" role="status">
                  <p className="keep__saved">
                    {pack.delivered ? (
                      <>
                        Saved as <span className="mono break">{pack.filename}</span>
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
                  <Disclosure summary={`Hashes and limitations (${pack.pack.limitations.length})`}>
                    <Facts
                      dense
                      rows={[
                        { label: 'Package', value: <span className="mono break">{pack.pack.package_sha256}</span> },
                        { label: 'Inputs', value: <span className="mono break">{pack.pack.input_sha256}</span>, note: 'Identifies the replay inputs for this property, not the whole dataset.' },
                        { label: 'Response', value: <span className="mono break">{pack.pack.response_sha256}</span> },
                        { label: 'Code version', value: <span className="mono break">{pack.pack.code.fingerprint}</span>, note: `Pipeline ${pack.pack.code.pipeline_version} · Python ${pack.pack.code.python_version}` },
                        { label: 'Format', value: pack.pack.format_version ?? 'evidence-package-v1' },
                      ]}
                    />
                    <ul className="plain-list plain-list--tight">
                      {pack.pack.limitations.map((limitation) => (
                        <li key={limitation}>{limitation}</li>
                      ))}
                    </ul>
                    <p className="hint">Hashes identify content; they are not signatures. A package that replays to the same output does not establish that the law was read correctly.</p>
                  </Disclosure>
                </div>
              )}
              {pack.status === 'error' && (
                <ErrorNotice
                  error={pack.error}
                  context={`Evidence package for ${outcome.query.address_id} as of ${formatDate(lookup.as_of)}`}
                  actions={
                    pack.error.kind === 'not_implemented' || pack.error.kind === 'invalid_request' ? undefined : (
                      <button type="button" className="button button--small" onClick={() => void downloadPackage()}>
                        Try again
                      </button>
                    )
                  }
                >
                  <p>Nothing was saved. {pack.error.kind === 'not_implemented' ? 'The working export beside it is still available.' : 'The result on screen is unaffected.'}</p>
                </ErrorNotice>
              )}
            </>
          ) : (
            <p className="keep__unavailable" data-package-unavailable>
              {outcome.fixture
                ? 'Not available for a contract example: the package is built by the live service for a saved property.'
                : mode === 'demo'
                  ? 'Not available in the synthetic demo: the package is built by the live service (POST /lookup/evidence-package), and the demo replays recordings without one.'
                  : 'Not available for this result.'}
            </p>
          )}
        </article>

        <article className="keep__card" aria-labelledby="working-title">
          <h3 id="working-title" className="keep__title">
            Working export
          </h3>
          <p className="keep__text">
            Assembled in this browser from what is on screen, including the order of your answers. It carries no source texts and no hashes, and nothing in it is re-verified. It is not the evidence package.
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
