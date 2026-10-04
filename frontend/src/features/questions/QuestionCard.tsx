import type { AlternativeOutcome, Answer, AnswerValue, Evaluation, FactQuestion } from '../../api/types';
import { Disclosure, Tag } from '../../components/ui';
import { formFromDefinition } from '../../lib/answers';
import { type NumericInterval, readInterval } from '../../demo/replay';
import { UNCERTAINTY_KINDS, formatValue, humanize, resultMeta, sentence } from '../../lib/labels';
import { consequenceOf, groupUncertainty, movableResults, movableWords } from '../../lib/uncertainty';
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

// Short labels only: the service's complete qualification remains visible below.
const CONCISE_TITLES: Record<string, string> = {
  used_as_tenant_dwelling: 'Is this a tenant’s home under a rental agreement?',
  person_under_bpc_16702: 'Is the actor a “person” under BPC §16702?',
  end_consumer_of_product_or_service: 'Is the same actor the end consumer?',
};

export function QuestionCard({ question, rank, names, current, busy, allowDemoAnswers, onAnswer, onInspect }: Props) {
  const { fact } = question;
  const form = formFromDefinition(fact);
  const conciseTitle = CONCISE_TITLES[fact.field];
  // The planner prefixes these prompts with the exact meaning. Display that meaning
  // once as guidance, while retaining any following format instruction in details.
  const promptRemainder = conciseTitle && question.prompt.startsWith(fact.meaning)
    ? question.prompt.slice(fact.meaning.length).replace(/^\?\s*/, '').trim()
    : null;
  const headingId = `question-${question.question_id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  // Results at least one recorded answer would move — the reason this question is worth asking.
  const count = movableResults(current, question);
  // Rules this question is about, by name. Two records of one provision are named once each.
  const affected = question.rule_ids;
  return (
    <article className={rank === 1 ? 'question question--lead' : 'question'} aria-labelledby={headingId} data-question={question.question_id} data-fact-field={fact.field}>
      <p className="question__rank">{rank === 1 ? 'Most useful question' : `Question ${rank}`}</p>
      <h3 id={headingId} className="question__prompt">
        {conciseTitle ?? `${fact.meaning}?`}
      </h3>
      {conciseTitle && <p className="question__meaning"><span className="question__meaning-label">Answer guidance:</span> {fact.meaning}</p>}

      {question.alternatives.length > 0 && (
        <p className="question__consequence" data-consequence={count.movable}>
          {count.movable > 0 ? `Depending on the answer, ${movableWords(count)} can change.` : 'No recorded answer changes a result on its own. Other open items below still hold the result.'}
        </p>
      )}
      {affected.length > 0 && (
        <p className="question__affects">
          Affects{' '}
          {affected.map((ruleId, index) => (
            <span key={ruleId}>
              {index > 0 && ', '}
              <button type="button" className="link" onClick={() => onInspect(ruleId)}>
                {names.get(ruleId) ?? ruleId}
              </button>
            </span>
          ))}
        </p>
      )}

      <AnswerInput
        form={form}
        legend={conciseTitle ?? question.prompt}
        unit={fact.unit}
        limits={{ minimum: fact.minimum, maximum: fact.maximum }}
        busy={busy}
        onSubmit={(value) => onAnswer(fact.field, value, 'user_provided')}
        onUnknown={() => onAnswer(fact.field, null, 'user_provided')}
      />
      <p className="question__scope">Your answer is unverified, applies to this request only, and never changes the stored property record. Identical requests may reuse cached analysis.</p>

      <div className="question__more">
        {question.alternatives.length > 0 && (
          <Disclosure lazy={current.length > 32 || question.alternatives.length > 8} summary={`What each answer would mean (${question.alternatives.length} hypothetical${question.alternatives.length === 1 ? '' : 's'})`}>
            <p className="hint">Each line is the evaluator’s output for a probe value. Probe values are hypothetical; they are not facts about this property.</p>
            <ul className="alternatives">
              {question.alternatives.map((alternative) => (
                <Alternative key={alternative.alternative_id} alternative={alternative} field={fact.field} names={names} ruleIds={question.rule_ids} current={current} busy={busy} allowDemoAnswers={allowDemoAnswers} onAnswer={onAnswer} />
              ))}
            </ul>
          </Disclosure>
        )}

        <Disclosure summary="Why this is asked, in the planner’s words">
          <dl className="facts facts--dense">
            {promptRemainder !== '' && <div className="facts__row">
              <dt>{promptRemainder === null ? 'Question as planned' : 'Answer format as planned'}</dt>
              <dd>{promptRemainder ?? question.prompt}</dd>
            </div>}
            <div className="facts__row">
              <dt>Why this matters</dt>
              <dd>{question.why}</dd>
            </div>
            <div className="facts__row">
              <dt>Ranking</dt>
              <dd>
                {question.ranking_rationale}
                <span className="facts__note">
                  Rank score {Number(question.rank_score.toFixed(3))}. A heuristic for ordering questions; it is not a probability. Answer effort weight for this fact: {fact.answer_effort ?? 1} of 5.
                </span>
              </dd>
            </div>
            <div className="facts__row">
              <dt>Fact</dt>
              <dd>
                <span className="mono">{fact.field}</span> · {humanize(fact.data_type)}
              </dd>
            </div>
            {question.predicate_ids.length > 0 && (
              <div className="facts__row">
                <dt>Conditions affected</dt>
                <dd className="code-list">
                  {question.predicate_ids.map((predicate) => (
                    <code key={predicate} className="code">
                      {predicate}
                    </code>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </Disclosure>
      </div>
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
