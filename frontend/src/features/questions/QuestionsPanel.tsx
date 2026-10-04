import type { Answer, AnswerValue, FixtureCaseSummary, LookupOutcome, Rule } from '../../api/types';
import { Disclosure, Notice, SectionHeading, Tag } from '../../components/ui';
import { inferAnswerForm } from '../../lib/expression';
import { humanize, sentence } from '../../lib/labels';
import { AnswerInput } from './AnswerInput';
import { QuestionCard } from './QuestionCard';

interface Props {
  outcome: LookupOutcome;
  answers: Answer[];
  busy: boolean;
  synthetic: boolean;
  /** Demo mode: fixture cases recorded for the same property and date. */
  relatedCases: FixtureCaseSummary[];
  onOpenCase: (fixtureCase: FixtureCaseSummary) => void;
  onAnswer: (field: string, value: AnswerValue, provenance: Answer['provenance']) => void;
  onInspect: (ruleId: string) => void;
}

const PLAN_STATUS = {
  complete: { label: 'Analysis complete', tone: 'applies' as const },
  partial: { label: 'Partial analysis', tone: 'unknown' as const },
  unavailable: { label: 'Planner unavailable', tone: 'muted' as const },
};

/**
 * Factual questions come only from the service's question plan. When no plan is available the
 * panel says so; it never ranks or invents questions itself.
 */
export function QuestionsPanel({ outcome, answers, busy, synthetic, relatedCases, onOpenCase, onAnswer, onInspect }: Props) {
  const rules = new Map<string, Rule>(outcome.lookup.rules.map((rule) => [rule.team_rule_id, rule]));
  const answered = new Set(answers.map((answer) => answer.field));
  const missing = [...new Set(outcome.lookup.evaluations.flatMap((evaluation) => evaluation.missing_facts ?? []))];
  const plan = outcome.assist?.question_plan;

  if (!plan) {
    if (outcome.planner.kind === 'no_fixture') {
      if (!missing.length && !relatedCases.length) return null;
      return (
        <section className="section" aria-labelledby="questions-heading">
          <SectionHeading id="questions-heading" title="Useful questions" aside={<Tag tone="muted">No plan in this recording</Tag>} />
          <p className="section__lead">{outcome.planner.detail}</p>
          {relatedCases.length > 0 && (
            <ul className="case-links">
              {relatedCases.map((fixtureCase) => (
                <li key={fixtureCase.id}>
                  <button type="button" className="case-link" onClick={() => onOpenCase(fixtureCase)}>
                    <span className="case-link__title">{fixtureCase.title}</span>
                    <span className="case-link__purpose">{fixtureCase.purpose}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
    // Live backend without the planned assist route: offer only what /lookup already supports.
    const open = missing.filter((field) => !answered.has(field));
    return (
      <section className="section" aria-labelledby="questions-heading">
        <SectionHeading id="questions-heading" title="Useful questions" aside={<Tag tone="muted">Planner unavailable</Tag>} />
        <Notice tone="neutral" title="Question planning is not available on this backend" compact>
          <p>{outcome.planner.kind === 'endpoint_unavailable' ? outcome.planner.detail : ''} No questions are ranked and no alternatives are shown.</p>
        </Notice>
        {open.length > 0 && (
          <>
            <p className="section__lead">
              The evaluator reported these facts as missing. You can supply one as a request-local, unverified fact. Whether it would change a result is not known until it is evaluated.
            </p>
            <ul className="supply">
              {open.map((field) => (
                <li key={field} className="question question--plain" data-field={field}>
                  <h3 className="question__prompt">{sentence(field)}</h3>
                  <p className="hint">Input type chosen from how the encoded rule compares this fact. No fact definition is published by this backend.</p>
                  <AnswerInput form={inferAnswerForm(field, outcome.lookup.rules)} legend={sentence(field)} busy={busy} submitLabel="Evaluate with this fact" onSubmit={(value) => onAnswer(field, value, 'user_provided')} onUnknown={() => onAnswer(field, null, 'user_provided')} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  const status = PLAN_STATUS[plan.status];
  const open = plan.questions.filter((question) => !answered.has(question.fact.field));
  const capabilities = Object.entries(outcome.assist?.capabilities ?? {});
  const limitsHit = plan.limits_hit ?? [];
  const unasked = missing.filter((field) => !answered.has(field) && !plan.questions.some((question) => question.fact.field === field));

  return (
    <section className="section" aria-labelledby="questions-heading">
      <SectionHeading
        id="questions-heading"
        title={
          <>
            Useful questions <span className="count">{open.length}</span>
          </>
        }
        aside={<Tag tone={status.tone}>{status.label}</Tag>}
      />

      {outcome.assist?.mode === 'contract_fixture' && (
        <p className="section__lead">
          This plan is an authored contract fixture: the agreed shape of the planner’s output, not output from the Core planner. Alternative outcomes inside it were produced by the evaluator.
        </p>
      )}

      {plan.status === 'unavailable' && (
        <Notice tone="neutral" title="The question planner is not available" compact>
          <p>The service answered without a plan. Lookup results and evidence are unaffected.</p>
        </Notice>
      )}

      {limitsHit.length > 0 && (
        <Notice tone="unknown" title="The analysis stopped at an explicit limit" compact>
          <p>
            Limit reached: {limitsHit.map(humanize).join(', ')}. {plan.evaluations_used ?? 0} of {plan.limits.max_evaluations ?? '—'} allowed evaluations were used. Branches that were not examined stay uncertain.
          </p>
        </Notice>
      )}

      {open.length === 0 && plan.status !== 'unavailable' && (
        <p className="section__lead">
          {plan.questions.length > 0
            ? 'Every question in this plan has an answer below.'
            : unasked.length > 0
              ? `No question is offered. The plan does not show that knowing ${unasked.map(humanize).join(' or ')} would settle a result on its own; see what remains uncertain below.`
              : 'Nothing to ask: the plan found no missing property fact that could change a result.'}
        </p>
      )}

      <div className="questions">
        {open.map((question, index) => (
          <QuestionCard key={question.question_id} question={question} rank={index + 1} rules={rules} busy={busy} allowDemoAnswers={synthetic} onAnswer={onAnswer} onInspect={onInspect} />
        ))}
      </div>

      <Disclosure summary="Plan details">
        <dl className="facts facts--dense">
          <div className="facts__row">
            <dt>Status</dt>
            <dd>
              {sentence(plan.status)}
              {plan.exhaustive ? ' · exhaustive' : ' · not claimed to be exhaustive or minimal'}
            </dd>
          </div>
          <div className="facts__row">
            <dt>Evaluations used</dt>
            <dd className="num">
              {plan.evaluations_used ?? 0} of {plan.limits.max_evaluations ?? '—'}
            </dd>
          </div>
          <div className="facts__row">
            <dt>Limits</dt>
            <dd className="num">
              up to {plan.limits.max_questions ?? '—'} questions · {plan.limits.max_fields ?? '—'} fields · {plan.limits.max_joint_fields ?? '—'} explored jointly
            </dd>
          </div>
          <div className="facts__row">
            <dt>Algorithm</dt>
            <dd className="mono">{plan.algorithm_version}</dd>
          </div>
          {capabilities.map(([name, value]) => (
            <div className="facts__row" key={name}>
              <dt>{sentence(name)}</dt>
              <dd>{value === 'implemented' ? 'Implemented' : 'Dependency unavailable'}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </section>
  );
}
