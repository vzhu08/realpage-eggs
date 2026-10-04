import { useMemo } from 'react';
import type { Answer, AnswerValue, DataMode, FactDefinition, FixtureCaseSummary, LookupOutcome } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, Empty, ErrorNotice, Facts, Notice, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { diffOutcomes } from '../../lib/diff';
import { MATCH_QUALITY, RESULT_ORDER, resultMeta, sentence } from '../../lib/labels';
import { isSynthetic, readMetadata } from '../../lib/metadata';
import { groupOpenItems, openItems } from '../../lib/openItems';
import { movableResults } from '../../lib/uncertainty';
import type { SessionState } from '../../state/session';
import { addressLine } from '../property/PropertyFinder';
import { AnswerHistory } from '../questions/AnswerHistory';
import { QuestionsPanel } from '../questions/QuestionsPanel';
import { RemainingUncertainty } from '../questions/RemainingUncertainty';
import { WhatChanged } from '../questions/WhatChanged';
import { KeepResult } from './KeepResult';
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

/** Scrolls to a section of the result and puts the keyboard there. */
function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
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
  const fixtureNote = `${fixtureText.charAt(0).toUpperCase()}${fixtureText.slice(1)}${/[.!?]$/.test(fixtureText) ? '' : '.'}`;

  // What to do next, read from the plan and the open statements. Nothing here predicts an outcome.
  // While the date control has been changed but not run, the result on screen is still the one
  // computed with the earlier answers. Those are the answers shown with it, read-only.
  const shownAnswers = stale ? outcome.query.answers : session.answers;
  const answered = new Set(shownAnswers.map((answer) => answer.field));
  const openQuestions = (outcome.assist?.question_plan.questions ?? []).filter((question) => !answered.has(question.fact.field));
  const lead = openQuestions[0];
  const movable = lead ? movableResults(lookup.evaluations, lead).movable : 0;
  const open = useMemo(() => groupOpenItems(openItems(outcome, shownAnswers), new Set(lookup.evaluations.map((evaluation) => evaluation.team_rule_id))), [outcome, shownAnswers, lookup.evaluations]);
  const reviewTopics = open.other.length;

  return (
    <div id="lookup-results" className={busy && session.reevaluating ? 'results is-busy' : 'results'} aria-busy={busy}>
      <div className="context" role="group" aria-label="Result context">
        <p className="context__asof">
          {session.selection && <span className="context__subject">{addressLine(session.selection)}</span>}
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

      <section className="verdict" aria-labelledby="outcome-heading">
        <div className="verdict__head">
          <h2 id="outcome-heading" className="verdict__title" tabIndex={-1}>
            Rules for this property on {formatDate(lookup.as_of)}
          </h2>
          <span className="hint">
            {total} {total === 1 ? 'rule' : 'rules'} returned
          </span>
        </div>
        {total > 0 ? (
          <ul className="tally" aria-label="Results by status">
            {counts.map((entry) => {
              const meta = resultMeta(entry.result);
              return (
                <li key={entry.result} className={`tally__item tally__item--${meta.tone}`}>
                  <span className="tally__count">{entry.count}</span>
                  <Tag tone={meta.tone}>{meta.label}</Tag>
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

        {total > 0 && (
          <div className="result-browse">
            <div>
              <p className="result-browse__title">Read the returned provisions and inspect their sources</p>
              <p className="hint">Unknown means coverage is not established for this property and date. You can still read the extracted provisions and inspect their evidence.</p>
            </div>
            <button type="button" className="button button--primary" onClick={() => jumpTo('rules-heading')}>
              Browse {total} returned {total === 1 ? 'rule' : 'rules'}
              <Icon name="arrow" />
            </button>
          </div>
        )}

        {(conflicted.length > 0 || jurisdictionOpen || reviewTopics > 0) && (
          <ul className="cues" aria-label="What is unresolved">
            {conflicted.length > 0 && (
              <li className="cue cue--danger" data-cue="conflict">
                <Icon name="danger" size={18} className="cue__icon" />
                <div className="cue__body">
                  <p className="cue__title">
                    Sources conflict for {conflicted.length} {conflicted.length === 1 ? 'rule' : 'rules'} here
                  </p>
                  <p className="cue__text">The evaluator flagged a conflict it cannot settle, so {conflicted.length === 1 ? 'that result stays' : 'those results stay'} open. No answer about the property resolves a disagreement between sources.</p>
                </div>
                <a className="button button--small cue__action" href={conflictHref}>
                  Compare the conflicting sources
                </a>
              </li>
            )}
            {jurisdictionOpen && (
              <li className="cue cue--unknown" data-cue="jurisdiction">
                <Icon name="unknown" size={18} className="cue__icon" />
                <div className="cue__body">
                  <p className="cue__title">Legal municipality {MATCH_QUALITY[quality]?.label.toLowerCase() ?? quality}</p>
                  <p className="cue__text">Local rules for this property stay uncertain until its legal municipality is established.</p>
                </div>
              </li>
            )}
            {reviewTopics > 0 && (
              <li className="cue cue--muted" data-cue="review">
                <Icon name="info" size={18} className="cue__icon" />
                <div className="cue__body">
                  <p className="cue__title">
                    {reviewTopics} open review {reviewTopics === 1 ? 'topic' : 'topics'} for returned rules
                  </p>
                  <p className="cue__text">These are evidence, interpretation or analysis gaps, not a count of missing property facts. Property answers cannot close these gaps.</p>
                </div>
                <button type="button" className="button button--small button--quiet cue__action" onClick={() => jumpTo('uncertainty-heading')}>
                  See what remains
                </button>
              </li>
            )}
          </ul>
        )}

        {open.outside.length > 0 && <p className="hint">{open.outside.length} additional review {open.outside.length === 1 ? 'topic concerns' : 'topics concern'} rules outside this result. Their statements remain in “What remains uncertain” below.</p>}

        <div className="next" data-next={lead ? 'question' : open.statements > 0 ? 'review' : 'none'}>
          <p className="next__label">Next</p>
          {lead ? (
            <>
              <p className="next__text">
                Answer {openQuestions.length === 1 ? 'one question' : `${openQuestions.length} questions`} about the property.
                {movable > 0 ? ` The first can change ${movable} ${movable === 1 ? 'result' : 'results'}.` : ''}
              </p>
              <button type="button" className="button button--primary" onClick={() => jumpTo('questions-heading')}>
                Go to the question
                <Icon name="arrow" />
              </button>
            </>
          ) : open.statements > 0 ? (
            <>
              <p className="next__text">No factual question is open. What remains needs a source, an interpretation or more analysis.</p>
              <button type="button" className="button" onClick={() => jumpTo('uncertainty-heading')}>
                See what remains
                <Icon name="arrow" />
              </button>
            </>
          ) : total > 0 ? (
            <>
              <p className="next__text">Nothing is open for this property on this date. Each result links to the text it rests on.</p>
              <button type="button" className="button" onClick={() => jumpTo('rules-heading')}>
                Read the rules
                <Icon name="arrow" />
              </button>
            </>
          ) : (
            <p className="next__text">Try another date, or check the dataset status in the header.</p>
          )}
        </div>
      </section>

      {session.previous && session.previous !== outcome && <WhatChanged previous={session.previous} outcome={outcome} />}

      {outcome.fixture && (
        <Notice tone="synthetic" title={`Contract fixture: ${sentence(outcome.fixture.case)}`} compact>
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
        <Notice tone="unknown" title={metadata.partialData ? 'Partial data: this result can be incomplete' : 'Notes on this result'} compact>
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

      <QuestionsPanel outcome={outcome} answers={shownAnswers} definitions={definitions} busy={busy} synthetic={synthetic} relatedCases={relatedCases} onOpenCase={onOpenCase} onAnswer={onAnswer} onInspect={onInspect} />

      <AnswerHistory answers={shownAnswers} history={session.history} outcome={outcome} definitions={definitions} busy={busy} readOnly={stale} onAnswer={onAnswer} onRemove={onRemoveAnswer} />

      {total > 0 && (
        <section className="section" aria-labelledby="rules-heading">
          <div className="section-heading">
            <h2 id="rules-heading">Returned rules and source evidence</h2>
            <div className="section-heading__aside">
              <span className="hint">Applicability is not a finding of compliance or violation.</span>
            </div>
          </div>
          <p className="section__lead">Search the returned provisions, then open Evidence for the captured text and unresolved checks.</p>
          <RuleList key={`${lookup.address.address_id}:${lookup.as_of}`} evaluations={lookup.evaluations} rules={lookup.rules} selectedRuleId={selectedRuleId} onInspect={onInspect} changed={changedIds} />
        </section>
      )}

      <RemainingUncertainty outcome={outcome} answers={shownAnswers} onInspect={onInspect} definitions={definitions} disagreementHref={conflicted.length > 0 ? conflictHref : undefined} />

      <KeepResult session={session} outcome={outcome} mode={mode} apiBase={apiBase} busy={busy} />

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
