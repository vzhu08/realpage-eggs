import type { Answer, LookupOutcome, Uncertainty } from '../../api/types';
import { SectionHeading, Tag } from '../../components/ui';
import { UNCERTAINTY_KINDS, humanize, parseReason, sentence } from '../../lib/labels';

interface Row {
  key: string;
  kind: string;
  label: string;
  answerable: boolean;
  who: string;
  message: string;
  remedy: string;
  field?: string | null;
  ruleIds: string[];
}

/**
 * What is still not known after the questions. Each item says what kind of gap it is and who
 * can close it, so a source gap or a legal conflict is never presented as something to answer.
 */
export function RemainingUncertainty({ outcome, answers, onInspect }: { outcome: LookupOutcome; answers: Answer[]; onInspect: (ruleId: string) => void }) {
  const titles = new Map(outcome.lookup.rules.map((rule) => [rule.team_rule_id, rule.title]));
  const plan = outcome.assist?.question_plan;
  const rows: Row[] = [];

  const fromPlan = (item: Uncertainty, index: number): Row => {
    const kind = UNCERTAINTY_KINDS[item.kind] ?? { label: sentence(item.kind), answerable: false, who: '' };
    return { key: `plan-${index}`, kind: item.kind, label: kind.label, answerable: kind.answerable, who: kind.who, message: item.message, remedy: item.remedy, field: item.field, ruleIds: item.rule_ids ?? [] };
  };
  (plan?.remaining_uncertainty ?? []).forEach((item, index) => rows.push(fromPlan(item, index)));

  // Reasons the evaluator attached to rules that the plan (if any) did not already cover.
  const coveredFields = new Set(rows.filter((row) => row.kind === 'property_fact' && row.field).map((row) => row.field));
  // A question that is still open is shown above; one answered "I don't know" belongs here.
  const markedUnknown = new Set(answers.filter((answer) => answer.value === null).map((answer) => answer.field));
  const asked = new Set((plan?.questions ?? []).map((question) => question.fact.field).filter((field) => !markedUnknown.has(field)));
  for (const evaluation of outcome.lookup.evaluations) {
    for (const raw of evaluation.uncertainty_reasons ?? []) {
      const reason = parseReason(raw);
      if (reason.kind === 'missing_property_fact') {
        const field = raw.slice(raw.indexOf(':') + 1).trim();
        if (coveredFields.has(field) || asked.has(field)) continue;
        coveredFields.add(field);
        rows.push({
          key: `fact-${field}`,
          kind: 'property_fact',
          label: 'Property fact',
          answerable: true,
          who: markedUnknown.has(field)
            ? 'You answered “I don’t know”, so this stays open. Edit the answer above if the fact becomes known.'
            : plan
              ? 'The evaluator reports this fact as missing. This plan offers no question for it.'
              : 'The evaluator reports this fact as missing.',
          message: `${sentence(field)} is not on record.`,
          remedy: 'A documented factual value would be needed.',
          field,
          ruleIds: [evaluation.team_rule_id],
        });
      } else {
        const existing = rows.find((row) => row.key === `reason-${raw}`);
        if (existing) existing.ruleIds.push(evaluation.team_rule_id);
        else rows.push({ key: `reason-${raw}`, kind: reason.kind, label: reason.label, answerable: false, who: reason.remedy, message: reason.message, remedy: '', ruleIds: [evaluation.team_rule_id] });
      }
    }
  }

  if (!rows.length) return null;
  return (
    <section className="section" aria-labelledby="uncertainty-heading">
      <SectionHeading
        id="uncertainty-heading"
        title={
          <>
            What remains uncertain <span className="count">{rows.length}</span>
          </>
        }
      />
      <ul className="uncertainty">
        {rows.map((row) => (
          <li key={row.key} className="uncertainty__item" data-kind={row.kind}>
            <div className="uncertainty__head">
              <Tag tone={row.answerable ? 'unknown' : 'muted'} icon={false}>
                {row.label}
              </Tag>
              <span className="uncertainty__who">{row.answerable ? 'A factual answer can close this' : 'Not a question for the renter or owner'}</span>
            </div>
            <p className="uncertainty__message">
              {row.field && row.kind === 'property_fact' && !row.message.toLowerCase().includes(humanize(row.field)) ? `${sentence(row.field)}: ` : ''}
              {row.message}
            </p>
            {row.remedy && <p className="uncertainty__remedy">{row.remedy}</p>}
            {row.who && <p className="hint">{row.who}</p>}
            {row.ruleIds.length > 0 && (
              <p className="hint">
                Affects{' '}
                {[...new Set(row.ruleIds)].map((ruleId, index) => (
                  <span key={ruleId}>
                    {index > 0 && ', '}
                    <button type="button" className="link" onClick={() => onInspect(ruleId)} disabled={!titles.has(ruleId)}>
                      {titles.get(ruleId) ?? ruleId}
                    </button>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
      {plan && !plan.exhaustive && <p className="hint">The plan does not claim this list is exhaustive.</p>}
    </section>
  );
}
