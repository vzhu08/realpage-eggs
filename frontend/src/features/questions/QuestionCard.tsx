import type { AlternativeOutcome, Answer, AnswerValue, Evaluation, FactQuestion } from '../../api/types';
import { Disclosure, Tag } from '../../components/ui';
import { formFromDefinition } from '../../lib/answers';
import { type NumericInterval, readInterval } from '../../demo/replay';
import { UNCERTAINTY_KINDS, formatValue, humanize, resultMeta, sentence } from '../../lib/labels';
import { consequenceOf, groupUncertainty } from '../../lib/uncertainty';
import { AnswerInput } from './AnswerInput';

interface Props {
  question: FactQuestion;
  rank: number;
  /** Display names for the rules in the current result, keyed by rule ID. */
  names: Map<string, string>;
  /** The evaluator's current results, so each hypothetical can show what it would move. */
  current: Evaluation[];
  busy: boolean;
  /** Synthetic data only: recorded probe values may be applied as labeled demo answers. */
  allowDemoAnswers: boolean;
  onAnswer: (field: string, value: AnswerValue, provenance: Answer['provenance']) => void;
  onInspect: (ruleId: string) => void;
}

export function QuestionCard({ question, rank, names, current, busy, allowDemoAnswers, onAnswer, onInspect }: Props) {
  const { fact } = question;
  const form = formFromDefinition(fact);
  const headingId = `question-${question.question_id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  // Results at least one recorded answer would move — the reason this question is worth asking.
  const movable = new Set(question.alternatives.flatMap((alternative) => consequenceOf(current, alternative.evaluations).changed.map((change) => change.ruleId)));
  const considered = new Set(question.alternatives.flatMap((alternative) => alternative.evaluations.map((evaluation) => evaluation.team_rule_id)));
  return (
    <article className="question" aria-labelledby={headingId} data-question={question.question_id}>
      <p className="question__rank">Question {rank}</p>
      <h3 id={headingId} className="question__prompt">
        {question.prompt}
      </h3>
      <p className="question__meaning">
        <span className="question__meaning-label">Asks for:</span> {fact.meaning}
        {fact.unit ? ` (${fact.unit})` : ''}
      </p>

      <div className="question__why">
        <p className="question__why-label">Why this matters</p>
        <p>{question.why}</p>
        {question.alternatives.length > 0 && (
          <p className="question__consequence" data-consequence={movable.size}>
            {movable.size > 0
              ? `Depending on the answer, ${movable.size} of ${considered.size} ${considered.size === 1 ? 'result' : 'results'} can change.`
              : 'No recorded answer changes a result on its own. Other open items below still hold the result.'}
          </p>
        )}
        {question.rule_ids.length > 0 && (
          <p className="question__affects">
            Affects{' '}
            {question.rule_ids.map((ruleId, index) => (
              <span key={ruleId}>
                {index > 0 && ', '}
                <button type="button" className="link" onClick={() => onInspect(ruleId)}>
                  {names.get(ruleId) ?? ruleId}
                </button>
              </span>
            ))}
          </p>
        )}
      </div>

      <AnswerInput
        form={form}
        legend={question.prompt}
        unit={fact.unit}
        limits={{ minimum: fact.minimum, maximum: fact.maximum }}
        busy={busy}
        onSubmit={(value) => onAnswer(fact.field, value, 'user_provided')}
        onUnknown={() => onAnswer(fact.field, null, 'user_provided')}
      />

      {question.alternatives.length > 0 && (
        <Disclosure summary={`What each answer would mean (${question.alternatives.length} hypothetical${question.alternatives.length === 1 ? '' : 's'})`} defaultOpen>
          <p className="hint">Each line is the evaluator’s output for a probe value. Probe values are hypothetical; they are not facts about this property.</p>
          <ul className="alternatives">
            {question.alternatives.map((alternative) => (
              <Alternative key={alternative.alternative_id} alternative={alternative} field={fact.field} names={names} ruleIds={question.rule_ids} current={current} busy={busy} allowDemoAnswers={allowDemoAnswers} onAnswer={onAnswer} />
            ))}
          </ul>
        </Disclosure>
      )}

      <Disclosure summary="Why this question is ranked here">
        <p>{question.ranking_rationale}</p>
        <p className="hint">
          Rank score {Number(question.rank_score.toFixed(3))}. A heuristic for ordering questions; it is not a probability. Answer effort weight for this fact: {fact.answer_effort ?? 1} of 5.
        </p>
        {question.predicate_ids.length > 0 && (
          <p className="hint">
            Conditions affected:{' '}
            {question.predicate_ids.map((predicate) => (
              <code key={predicate} className="code">
                {predicate}
              </code>
            ))}
          </p>
        )}
      </Disclosure>
    </article>
  );
}

/** "1 to 7 dwelling units", "exactly 8 dwelling units", "9 dwelling units or more" — the planner's own bounds, in words. */
function describeInterval(interval: NumericInterval): string {
  const unit = interval.unit ? ` ${interval.unit}` : '';
  const { lower, upper } = interval;
  if (lower !== null && upper !== null) {
    if (lower === upper) return `exactly ${lower}${unit}`;
    return `${interval.lowerInclusive ? '' : 'more than '}${lower} to ${interval.upperInclusive ? '' : 'less than '}${upper}${unit}`;
  }
  if (lower !== null) return `${interval.lowerInclusive ? '' : 'more than '}${lower}${unit}${interval.lowerInclusive ? ' or more' : ''}`;
  return `${interval.upperInclusive ? 'up to' : 'less than'} ${upper}${unit}`;
}

function Alternative({ alternative, field, names, ruleIds, current, busy, allowDemoAnswers, onAnswer }: { alternative: AlternativeOutcome; field: string; names: Map<string, string>; ruleIds: string[]; current: Evaluation[]; busy: boolean; allowDemoAnswers: boolean; onAnswer: Props['onAnswer'] }) {
  const consequence = consequenceOf(current, alternative.evaluations);
  // What would still be open, with the items that concern this question's rules first.
  const about = (item: { ruleIds: string[] }) => (item.ruleIds.some((id) => ruleIds.includes(id)) ? 0 : 1);
  const remaining = groupUncertainty(alternative.remaining_uncertainty).sort((a, b) => about(a) - about(b));
  const shownRemaining = remaining.slice(0, 3);
  const moreRemaining = remaining.slice(3);
  const ruleName = (ruleId: string) => names.get(ruleId) ?? <span className="mono break">{ruleId}</span>;
  const remainingItem = (item: (typeof remaining)[number]) => (
    <li key={item.key}>
      <strong>{UNCERTAINTY_KINDS[item.kind]?.label ?? sentence(item.kind)}:</strong> {item.field ? `${humanize(item.field)} — ` : ''}
      {item.message}
    </li>
  );
  const probeKeys = Object.keys(alternative.probe_facts);
  const probe = alternative.probe_facts[field];
  const interval = readInterval(alternative);
  const singleProbe = probeKeys.length === 1 && probeKeys[0] === field && (typeof probe === 'string' || typeof probe === 'number' || typeof probe === 'boolean');
  return (
    <li className="alternative">
      <div className="alternative__head">
        <p className="alternative__label">{alternative.label}</p>
        <Tag tone="info" icon={false}>
          Hypothetical
        </Tag>
      </div>
      {interval ? (
        <p className="hint">
          Covers {describeInterval(interval)}. Evaluated at the probe value {formatValue(probe)}, which stands in for the whole range.
        </p>
      ) : (
        alternative.interval && (
          <p className="hint">
            Covers:{' '}
            {Object.entries(alternative.interval)
              .map(([key, value]) => `${humanize(key)} ${formatValue(value)}`)
              .join(', ')}
          </p>
        )
      )}
      {consequence.changed.length > 0 ? (
        <ul className="alternative__results" aria-label="Results this answer would change">
          {consequence.changed.map((change) => {
            const before = change.before ? resultMeta(change.before) : null;
            const after = resultMeta(change.after.result);
            return (
              <li key={change.ruleId} data-moved>
                <span className="alternative__rule">{ruleName(change.ruleId)}</span>
                <span className="alternative__flow">
                  {before ? <Tag tone={before.tone}>{before.label}</Tag> : <Tag tone="muted">Not listed</Tag>}
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">would become</span>
                  <Tag tone={after.tone}>{after.label}</Tag>
                </span>
                <span className="alternative__explanation">{change.after.explanation}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="alternative__none">This answer would not change any result by itself.</p>
      )}
      {consequence.unchanged.length > 0 && (
        <Disclosure summary={`${consequence.unchanged.length} ${consequence.unchanged.length === 1 ? 'result' : 'results'} would stay the same`}>
          <ul className="alternative__results alternative__results--same">
            {consequence.unchanged.map((evaluation) => {
              const meta = resultMeta(evaluation.result);
              return (
                <li key={evaluation.team_rule_id}>
                  <span className="alternative__rule">{ruleName(evaluation.team_rule_id)}</span>
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                  <span className="alternative__explanation">{evaluation.explanation}</span>
                </li>
              );
            })}
          </ul>
        </Disclosure>
      )}
      {remaining.length > 0 ? (
        <div className="alternative__remaining">
          <p className="alternative__remaining-label">Would still be uncertain</p>
          <ul className="plain-list plain-list--tight">{shownRemaining.map(remainingItem)}</ul>
          {moreRemaining.length > 0 && (
            <Disclosure summary={`${moreRemaining.length} more`}>
              <ul className="plain-list plain-list--tight">{moreRemaining.map(remainingItem)}</ul>
            </Disclosure>
          )}
        </div>
      ) : (
        <p className="hint">No remaining uncertainty recorded for this alternative.</p>
      )}
      {allowDemoAnswers && singleProbe && (
        <button type="button" className="button button--small" disabled={busy} onClick={() => onAnswer(field, probe as Exclude<AnswerValue, null>, 'demo')}>
          Answer with {formatValue(probe)} as a demo answer
        </button>
      )}
    </li>
  );
}
