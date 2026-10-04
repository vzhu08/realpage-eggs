import { useMemo, useState } from 'react';
import type { Answer, AnswerValue, DataMode, FactDefinition, FixtureCaseSummary, LookupOutcome } from '../../api/types';
import { Disclosure, Empty, ErrorNotice, Facts, Notice, SectionHeading, Tag } from '../../components/ui';
import { DEMO_ONLY } from '../../config';
import { formatDate } from '../../lib/dates';
import { diffOutcomes } from '../../lib/diff';
import { buildWorkingExport, downloadJson, workingExportFilename } from '../../lib/exportPackage';
import { MATCH_QUALITY, RESULT_ORDER, resultMeta, sentence } from '../../lib/labels';
import { isSynthetic, readMetadata } from '../../lib/metadata';
import type { SessionState } from '../../state/session';
import { AnswerHistory } from '../questions/AnswerHistory';
import { QuestionsPanel } from '../questions/QuestionsPanel';
import { RemainingUncertainty } from '../questions/RemainingUncertainty';
import { WhatChanged } from '../questions/WhatChanged';
import { RuleList } from './RuleList';

interface Props {
  session: SessionState;
  outcome: LookupOutcome;
  selectedRuleId: string | null;
  relatedCases: FixtureCaseSummary[];
  /** Fact definitions published by the data source (GET /facts), keyed by field. */
  factDefinitions: Record<string, FactDefinition>;
  onOpenCase: (fixtureCase: FixtureCaseSummary) => void;
  onInspect: (ruleId: string) => void;
  onAnswer: (field: string, value: AnswerValue, provenance: Answer['provenance']) => void;
  onRemoveAnswer: (field: string) => void;
  onRun: () => void;
  mode: DataMode;
  apiBase?: string;
  /** Where the conflicting sources for a property and date are compared. */
  disagreementHref: (addressId: string, asOf: string) => string;
}

export function Results({ session, outcome, selectedRuleId, relatedCases, factDefinitions, onOpenCase, onInspect, onAnswer, onRemoveAnswer, onRun, mode, apiBase, disagreementHref }: Props) {
  const { lookup } = outcome;
  const metadata = readMetadata(lookup);
  const synthetic = isSynthetic(metadata) || outcome.origin.kind !== 'live';
  const busy = session.status === 'loading';
  const stale = session.dirty && (session.asOf !== lookup.as_of || session.selection?.property.address_id !== lookup.address.address_id);

  const changes = useMemo(() => (session.previous && session.previous !== outcome ? diffOutcomes(session.previous, outcome) : []), [session.previous, outcome]);
  const changedIds = useMemo(() => new Set(changes.filter((change) => change.kind === 'changed').map((change) => change.ruleId)), [changes]);

  const definitions = useMemo(() => ({ ...factDefinitions, ...session.definitions }), [factDefinitions, session.definitions]);

  const counts = RESULT_ORDER.map((result) => ({ result, count: lookup.evaluations.filter((evaluation) => evaluation.result === result).length })).filter((entry) => entry.count > 0);
  const total = lookup.evaluations.length;
  const quality = lookup.jurisdiction.match_quality ?? 'unresolved';
  const jurisdictionOpen = quality !== 'resolved';
  // The synthetic label has its own banner; every other warning is listed verbatim.
  const warnings = lookup.warnings.filter((warning) => !/^SYNTHETIC DEMONSTRATION/i.test(warning) && !/^CONTRACT FIXTURE/i.test(warning));
  const fixtureWarning = lookup.warnings.find((warning) => /^CONTRACT FIXTURE/i.test(warning));
  const fixtureText =
    fixtureWarning?.replace(/^CONTRACT FIXTURE:\s*/i, '') ??
    (outcome.fixture?.contractStatus === 'implemented_platform_api' ? 'A response of the implemented API on synthetic data, checked in as a contract example' : 'An authored contract example, not output from a live service');
  const conflicted = lookup.evaluations.filter((evaluation) => evaluation.conflict_flag);
  const conflictHref = disagreementHref(lookup.address.address_id, lookup.as_of);
  const [exported, setExported] = useState<'idle' | 'done' | 'failed'>('idle');
  const [shownExport, setShownExport] = useState<string | null>(null);
  // The export time is the only clock value in the file, and it is labeled as such there.
  const buildExport = () => buildWorkingExport({ outcome, answers: session.answers, history: session.history, mode, apiBase, exportedAt: new Date().toISOString() });
  const exportResult = () => setExported(downloadJson(workingExportFilename(lookup.address.address_id, lookup.as_of), buildExport()) ? 'done' : 'failed');
  const fixtureNote = `${fixtureText.charAt(0).toUpperCase()}${fixtureText.slice(1)}${/[.!?]$/.test(fixtureText) ? '' : '.'}`;

  return (
    <div className={busy && session.reevaluating ? 'results is-busy' : 'results'} aria-busy={busy}>
      <div className="context" role="group" aria-label="Result context">
        <p className="context__asof">
          <span className="context__label">As of</span> <strong>{formatDate(lookup.as_of)}</strong>
        </p>
        <div className="context__tags">
          {synthetic && <Tag tone="unknown">Synthetic data · not actual law</Tag>}
          {metadata.partialData && <Tag tone="unknown">Partial data</Tag>}
          {jurisdictionOpen && <Tag tone="unknown">Jurisdiction {MATCH_QUALITY[quality]?.label.toLowerCase() ?? quality}</Tag>}
          <Tag tone="neutral" icon={false}>
            {outcome.origin.label}
          </Tag>
        </div>
        <p className="context__disclaimer">{lookup.disclaimer}</p>
      </div>

      {session.previous && session.previous !== outcome && <WhatChanged previous={session.previous} outcome={outcome} />}

      {stale && (
        <Notice
          tone="info"
          title={`These results are for ${formatDate(lookup.as_of)}`}
          actions={
            <button type="button" className="button button--small" onClick={onRun} disabled={busy}>
              Run lookup for {formatDate(session.asOf)}
            </button>
          }
        >
          <p>The date above was changed and has not been looked up yet.</p>
        </Notice>
      )}

      {session.answerError && (
        <ErrorNotice error={session.answerError} context="Re-evaluation after your answer">
          <p>The result below is from before this answer and does not include it. Edit or remove the answer to try again.</p>
        </ErrorNotice>
      )}

      {outcome.fixture && (
        <Notice tone="synthetic" title={`Contract fixture: ${sentence(outcome.fixture.case)}`}>
          <p>{fixtureNote}</p>
          <p className="hint">
            Contract status: <span className="mono">{outcome.fixture.contractStatus}</span>
          </p>
        </Notice>
      )}

      {outcome.notices.map((notice) => (
        <Notice key={notice} tone="info" title={notice} role="status" compact />
      ))}

      {(metadata.partialData || warnings.length > 0) && (
        <Notice tone="unknown" title={metadata.partialData ? 'Partial data: this result can be incomplete' : 'Notes on this result'}>
          <ul className="plain-list plain-list--tight">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            {metadata.partialData && metadata.missingSourceIds.length > 0 && <li>{metadata.missingSourceIds.length} source documents have no captured text.</li>}
            {metadata.partialData && metadata.unprocessedSourceIds.length > 0 && <li>{metadata.unprocessedSourceIds.length} source documents have not completed extraction.</li>}
          </ul>
          {metadata.partialData && <p>A rule that is not listed here has not been ruled out. Missing sources are a coverage gap, not evidence that no law applies.</p>}
        </Notice>
      )}

      {conflicted.length > 0 && (
        <Notice
          tone="danger"
          title={`Sources conflict for ${conflicted.length} ${conflicted.length === 1 ? 'rule' : 'rules'} here`}
          actions={
            <a className="button button--small" href={conflictHref}>
              Compare the conflicting sources
            </a>
          }
        >
          <p>The evaluator flagged a conflict it cannot settle, so {conflicted.length === 1 ? 'that result stays' : 'those results stay'} open. No answer about the property resolves a disagreement between sources.</p>
        </Notice>
      )}

      <section className="section section--first" aria-labelledby="outcome-heading">
        <SectionHeading
          id="outcome-heading"
          title={`Rules for this property on ${formatDate(lookup.as_of)}`}
          aside={
            <span className="hint">
              {total} {total === 1 ? 'rule' : 'rules'} returned
            </span>
          }
        />
        {total > 0 ? (
          <ul className="tally" aria-label="Results by status">
            {counts.map((entry) => {
              const meta = resultMeta(entry.result);
              return (
                <li key={entry.result}>
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                  <span className="tally__count">{entry.count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No rules were returned for this property on this date" icon="list">
            <p>
              The service found no extracted rule that applies, is pending, or is still undetermined here. That describes the extracted dataset
              {metadata.partialData ? ', which is incomplete' : ''}; it is not a statement that no law applies.
            </p>
          </Empty>
        )}
      </section>

      <QuestionsPanel outcome={outcome} answers={session.answers} definitions={definitions} busy={busy} synthetic={synthetic} relatedCases={relatedCases} onOpenCase={onOpenCase} onAnswer={onAnswer} onInspect={onInspect} />

      <AnswerHistory answers={session.answers} history={session.history} outcome={outcome} definitions={definitions} busy={busy} onAnswer={onAnswer} onRemove={onRemoveAnswer} />

      {total > 0 && (
        <section className="section" aria-labelledby="rules-heading">
          <SectionHeading id="rules-heading" title="Rule by rule" aside={<span className="hint">Applicability is not a finding of compliance or violation.</span>} />
          <RuleList evaluations={lookup.evaluations} rules={lookup.rules} selectedRuleId={selectedRuleId} onInspect={onInspect} changed={changedIds} />
        </section>
      )}

      <RemainingUncertainty outcome={outcome} answers={session.answers} onInspect={onInspect} disagreementHref={conflicted.length > 0 ? conflictHref : undefined} />

      <section className="section export" aria-labelledby="export-heading">
        <SectionHeading id="export-heading" title="Keep this result" />
        <p className="section__lead">
          Download what is on screen as one file: the stored facts, your request-local answers and their history, the evaluator’s results, the exact quotes and source records, each evidence check, and what remains uncertain. Each kind is kept apart.
        </p>
        {DEMO_ONLY ? (
          // A hosted preview cannot hand the viewer a file, so the same content is shown on the page.
          <>
            <div className="export__actions">
              <button type="button" className="button" aria-expanded={shownExport !== null} onClick={() => setShownExport((current) => (current === null ? JSON.stringify(buildExport(), null, 2) : null))} disabled={busy}>
                {shownExport === null ? 'Show working export (JSON)' : 'Hide working export'}
              </button>
              <span className="hint">This hosted preview cannot save files. Run the app locally to download the same file.</span>
            </div>
            {shownExport !== null && (
              <pre className="raw export__preview" tabIndex={0} aria-label="Working export">
                {shownExport}
              </pre>
            )}
          </>
        ) : (
          <div className="export__actions">
            <button type="button" className="button" onClick={exportResult} disabled={busy}>
              Download working export (JSON)
            </button>
            <span className="hint" role="status">
              {exported === 'done' ? 'Download started.' : exported === 'failed' ? 'This browser did not allow the download.' : ''}
            </span>
          </div>
        )}
        <p className="hint">
          This is a working export assembled in the browser. It is not the reproducible evidence package: that needs snapshot and code hashes from the service, which the API does not provide yet. Model review is reported as the service records it; no independent human review is recorded.
        </p>
      </section>

      <Disclosure summary="About this result" className="about">
        <Facts
          dense
          rows={[
            { label: 'Source of this result', value: outcome.origin.label, note: outcome.origin.detail },
            { label: 'Query', value: <span className="mono">{`${outcome.query.address_id} · ${outcome.query.as_of}`}</span> },
            { label: 'Dataset mode', value: metadata.datasetMode ? sentence(metadata.datasetMode) : 'Not stated', note: metadata.datasetLabel },
            { label: 'Rule evidence modes', value: metadata.ruleModes.length ? metadata.ruleModes.map(sentence).join(', ') : 'None (no rules returned)' },
            { label: 'Partial data', value: metadata.partialData ? 'Yes' : 'No' },
            ...(metadata.runIds.length ? [{ label: 'Extraction runs', value: <span className="mono break">{metadata.runIds.join(', ')}</span> }] : []),
            ...(metadata.version ? [{ label: 'Backend version', value: metadata.version }] : []),
            ...(outcome.assist ? [{ label: 'Assist mode', value: sentence(outcome.assist.mode) }] : []),
          ]}
        />
        {outcome.contractWarnings.length > 0 && (
          <Notice tone="unknown" title="The response contains fields that are not in the checked-in contract" compact>
            <ul className="plain-list plain-list--tight">
              {outcome.contractWarnings.slice(0, 8).map((warning) => (
                <li key={warning} className="mono">
                  {warning}
                </li>
              ))}
            </ul>
          </Notice>
        )}
      </Disclosure>
    </div>
  );
}
