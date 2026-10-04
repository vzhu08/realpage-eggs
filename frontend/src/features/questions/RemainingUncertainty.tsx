import type { Answer, LookupOutcome, SourceSpan } from '../../api/types';
import { Disclosure, SectionHeading, Tag } from '../../components/ui';
import { UNCERTAINTY_KINDS, humanize, parseReason, sentence } from '../../lib/labels';
import { ruleDisplayNames } from '../../lib/ruleNames';
import { groupUncertainty, nextStep } from '../../lib/uncertainty';

interface Row {
  key: string;
  kind: string;
  label: string;
  answerable: boolean;
  /** The kind of next step this item needs, e.g. "A factual answer" or "A source to be obtained". */
  next: string;
  who: string;
  message: string;
  remedy: string;
  field?: string | null;
  ruleIds: string[];
  sourceRefs: SourceSpan[];
  order: number;
  /** For an item taken from an evaluator reason: the reason's own prefix, e.g. unsupported_condition. */
  reason?: string;
}

/** Reason prefixes from the evaluator, mapped to the contract's uncertainty kinds for ordering and wording. */
const REASON_TO_KIND: Record<string, string> = {
  jurisdiction_uncertainty: 'jurisdiction',
  temporal_uncertainty: 'interpretation',
  unresolved_extraction: 'interpretation',
  conflicting_legal_evidence: 'conflict',
  possible_interaction: 'conflict',
  cyclic_interaction: 'conflict',
  unsupported_condition: 'interpretation',
};

interface Props {
  outcome: LookupOutcome;
  answers: Answer[];
  onInspect: (ruleId: string) => void;
  /** Where the conflicting sources for this property and date are compared. */
  disagreementHref?: string;
}

/**
 * What is still not known after the questions. Each item says what is missing, which results
 * it holds back and what kind of next step would close it, so a source gap or a legal conflict
 * is never presented as something a renter or owner could answer.
 */
export function RemainingUncertainty({ outcome, answers, onInspect, disagreementHref }: Props) {
  const titles = ruleDisplayNames(outcome.lookup.rules);
  const plan = outcome.assist?.question_plan;
  const rows: Row[] = [];

  for (const item of groupUncertainty(plan?.remaining_uncertainty ?? [])) {
    const kind = UNCERTAINTY_KINDS[item.kind] ?? { label: sentence(item.kind), answerable: false, who: '' };
    const step = nextStep(item.kind);
    rows.push({ key: `plan-${item.key}`, kind: item.kind, label: kind.label, answerable: kind.answerable, next: step.label, who: '', message: item.message, remedy: item.remedy, field: item.field, ruleIds: item.ruleIds, sourceRefs: item.sourceRefs, order: step.order });
  }

  // Reasons the evaluator attached to rules that the plan (if any) did not already cover.
  const planMessages = new Set(rows.map((row) => row.message));
  // A question that is still open is shown above; one answered "I don't know" belongs here.
  const markedUnknown = new Set(answers.filter((answer) => answer.value === null).map((answer) => answer.field));
  const asked = new Set((plan?.questions ?? []).map((question) => question.fact.field).filter((field) => !markedUnknown.has(field)));
  for (const evaluation of outcome.lookup.evaluations) {
    for (const raw of evaluation.uncertainty_reasons ?? []) {
      const reason = parseReason(raw);
      // Core B already distinguishes imprecise property values from imprecise
      // legal thresholds. Preserve that classification instead of adding a
      // contradictory, generic interpretation row from the evaluator prefix.
      if (raw.startsWith('insufficient_fact_precision:')) {
        const field = raw.slice(raw.indexOf(':') + 1).trim().split(/\s+/)[0];
        if (field && (asked.has(field) || rows.some((row) => row.field === field && row.ruleIds.includes(evaluation.team_rule_id)))) continue;
      }
      if (reason.kind === 'missing_property_fact') {
        const field = raw.slice(raw.indexOf(':') + 1).trim();
        if (asked.has(field) || rows.some((row) => row.field === field && row.ruleIds.includes(evaluation.team_rule_id))) continue;
        const existing = rows.find((row) => row.key === `fact-${field}`);
        if (existing) {
          if (!existing.ruleIds.includes(evaluation.team_rule_id)) existing.ruleIds.push(evaluation.team_rule_id);
          continue;
        }
        rows.push({
          key: `fact-${field}`,
          kind: 'property_fact',
          label: 'Property fact',
          answerable: true,
          next: nextStep('property_fact').label,
          who: markedUnknown.has(field)
            ? 'You answered “I don’t know”, so this stays open. Edit the answer above if the fact becomes known.'
            : plan
              ? 'The evaluator reports this fact as missing. This plan offers no question for it.'
              : 'The evaluator reports this fact as missing.',
          message: `${sentence(field)} is not on record.`,
          remedy: 'A documented factual value would be needed.',
          field,
          ruleIds: [evaluation.team_rule_id],
          sourceRefs: [],
          order: 0,
        });
      } else {
        // The plan restates most evaluator reasons in its own words; do not show both.
        if (planMessages.has(reason.message)) continue;
        const existing = rows.find((row) => row.key === `reason-${raw}`);
        if (existing) {
          if (!existing.ruleIds.includes(evaluation.team_rule_id)) existing.ruleIds.push(evaluation.team_rule_id);
        } else {
          const kind = REASON_TO_KIND[reason.kind] ?? 'interpretation';
          const step = nextStep(kind);
          rows.push({ key: `reason-${raw}`, kind, label: reason.label, answerable: false, next: step.label, who: reason.remedy, message: reason.message, remedy: '', ruleIds: [evaluation.team_rule_id], sourceRefs: [], order: step.order, reason: reason.kind });
        }
      }
    }
  }

  if (!rows.length) return null;
  rows.sort((a, b) => a.order - b.order);
  // The plan also reports on rules that do not reach this property. Those are kept, but apart.
  const offList = rows.filter((row) => row.ruleIds.length > 0 && !row.ruleIds.some((ruleId) => titles.has(ruleId)));
  const onList = rows.filter((row) => !offList.includes(row));
  const answerable = onList.filter((row) => row.answerable);
  const other = onList.filter((row) => !row.answerable);

  const item = (row: Row) => (
    <li key={row.key} className="uncertainty__item" data-kind={row.kind} data-reason={row.reason}>
      <div className="uncertainty__head">
        <Tag tone={row.answerable ? 'unknown' : 'muted'} icon={false}>
          {row.label}
        </Tag>
        <span className="uncertainty__who">
          Needs: <strong>{row.next.charAt(0).toLowerCase() + row.next.slice(1)}</strong>
        </span>
      </div>
      <p className="uncertainty__message">
        {row.field && row.kind === 'property_fact' && !row.message.toLowerCase().includes(humanize(row.field)) && !row.message.includes(row.field) ? `${sentence(row.field)}: ` : ''}
        {row.message}
      </p>
      {row.ruleIds.length > 0 && (
        <p className="uncertainty__affects">
          <span className="uncertainty__affects-label">Holds back</span>{' '}
          {[...new Set(row.ruleIds)]
            .filter((ruleId) => titles.has(ruleId))
            .map((ruleId, index) => (
              <span key={ruleId}>
                {index > 0 && ', '}
                <button type="button" className="link" onClick={() => onInspect(ruleId)}>
                  {titles.get(ruleId)}
                </button>
              </span>
            ))}
          {(() => {
            const outside = [...new Set(row.ruleIds)].filter((ruleId) => !titles.has(ruleId));
            const listed = row.ruleIds.length - outside.length;
            if (!outside.length) return null;
            return (
              <span className="uncertainty__outside" title={outside.join(', ')}>
                {listed > 0 ? ' and ' : ''}
                {outside.length} {outside.length === 1 ? 'rule' : 'rules'} not in this result
              </span>
            );
          })()}
        </p>
      )}
      {row.remedy && (
        <p className="uncertainty__remedy">
          <span className="uncertainty__affects-label">Next step</span> {row.remedy}
        </p>
      )}
      {row.who && <p className="hint">{row.who}</p>}
      {row.kind === 'conflict' && disagreementHref && (
        <p className="hint">
          <a className="link" href={disagreementHref}>
            Compare the conflicting sources
          </a>
        </p>
      )}
      {row.sourceRefs.length > 0 && (
        <Disclosure summary={`Source text referred to (${row.sourceRefs.length})`}>
          <ul className="spans">
            {row.sourceRefs.map((ref, index) => (
              <li key={index}>
                <blockquote>{ref.text}</blockquote>
                <p className="hint">
                  <span className="mono">{ref.doc_id}</span> · characters {ref.start}–{ref.end}
                </p>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </li>
  );

  return (
    <section className="section" aria-labelledby="uncertainty-heading">
      <SectionHeading
        id="uncertainty-heading"
        title={
          <>
            What remains uncertain <span className="count">{onList.length}</span>
          </>
        }
      />
      {answerable.length > 0 && (
        <>
          <p className="uncertainty__group" id="uncertainty-answerable">
            A fact about the property can close these
          </p>
          <ul className="uncertainty" aria-labelledby="uncertainty-answerable">
            {answerable.map(item)}
          </ul>
        </>
      )}
      {other.length > 0 && (
        <>
          <p className="uncertainty__group" id="uncertainty-other">
            Needs evidence, interpretation or more analysis
          </p>
          <ul className="uncertainty" aria-labelledby="uncertainty-other">
            {other.map(item)}
          </ul>
        </>
      )}
      {offList.length > 0 && (
        <Disclosure summary={`${offList.length} more ${offList.length === 1 ? 'item concerns a rule' : 'items concern rules'} that do not reach this property`}>
          <p className="hint">The service reported these for rules outside this result. They do not hold back anything listed above.</p>
          <ul className="uncertainty">{offList.map(item)}</ul>
        </Disclosure>
      )}
      {plan && !plan.exhaustive && <p className="hint">The plan does not claim this list is exhaustive.</p>}
    </section>
  );
}
