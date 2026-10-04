import type { AlternativeOutcome, Answer, AnswerValue, FactQuestion, Rule } from '../../api/types';
import { Disclosure, Tag } from '../../components/ui';
import { formFromDefinition } from '../../lib/answers';
import { UNCERTAINTY_KINDS, formatValue, humanize, resultMeta, sentence } from '../../lib/labels';
import { AnswerInput } from './AnswerInput';

interface Props {
  question: FactQuestion;
  rank: number;
  rules: Map<string, Rule>;
  busy: boolean;
  /** Synthetic data only: recorded probe values may be applied as labeled demo answers. */
  allowDemoAnswers: boolean;
  onAnswer: (field: string, value: AnswerValue, provenance: Answer['provenance']) => void;
  onInspect: (ruleId: string) => void;
}

export function QuestionCard({ question, rank, rules, busy, allowDemoAnswers, onAnswer, onInspect }: Props) {
  const { fact } = question;
  const form = formFromDefinition(fact);
  const headingId = `question-${question.question_id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
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
        {question.rule_ids.length > 0 && (
          <p className="question__affects">
            Affects{' '}
            {question.rule_ids.map((ruleId, index) => (
              <span key={ruleId}>
                {index > 0 && ', '}
                <button type="button" className="link" onClick={() => onInspect(ruleId)}>
                  {rules.get(ruleId)?.title ?? ruleId}
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
              <Alternative key={alternative.alternative_id} alternative={alternative} field={fact.field} rules={rules} busy={busy} allowDemoAnswers={allowDemoAnswers} onAnswer={onAnswer} />
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

function Alternative({ alternative, field, rules, busy, allowDemoAnswers, onAnswer }: { alternative: AlternativeOutcome; field: string; rules: Map<string, Rule>; busy: boolean; allowDemoAnswers: boolean; onAnswer: Props['onAnswer'] }) {
  const probeKeys = Object.keys(alternative.probe_facts);
  const probe = alternative.probe_facts[field];
  const singleProbe = probeKeys.length === 1 && probeKeys[0] === field && (typeof probe === 'string' || typeof probe === 'number' || typeof probe === 'boolean');
  return (
    <li className="alternative">
      <div className="alternative__head">
        <p className="alternative__label">{alternative.label}</p>
        <Tag tone="info" icon={false}>
          Hypothetical
        </Tag>
      </div>
      {alternative.interval && (
        <p className="hint">
          Covers:{' '}
          {Object.entries(alternative.interval)
            .map(([key, value]) => `${humanize(key)} ${formatValue(value)}`)
            .join(', ')}
        </p>
      )}
      <ul className="alternative__results">
        {alternative.evaluations.map((evaluation) => {
          const meta = resultMeta(evaluation.result);
          return (
            <li key={evaluation.team_rule_id}>
              <span className="alternative__rule">{rules.get(evaluation.team_rule_id)?.title ?? evaluation.team_rule_id}</span>
              <Tag tone={meta.tone}>{meta.label}</Tag>
              <span className="alternative__explanation">{evaluation.explanation}</span>
            </li>
          );
        })}
      </ul>
      {alternative.remaining_uncertainty.length > 0 ? (
        <div className="alternative__remaining">
          <p className="alternative__remaining-label">Would still be uncertain</p>
          <ul className="plain-list plain-list--tight">
            {alternative.remaining_uncertainty.map((item, index) => (
              <li key={index}>
                <strong>{UNCERTAINTY_KINDS[item.kind]?.label ?? sentence(item.kind)}:</strong> {item.field ? `${humanize(item.field)} — ` : ''}
                {item.message}
              </li>
            ))}
          </ul>
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
