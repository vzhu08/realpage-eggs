/**
 * Everything a lookup result still leaves open, as one list of statements. Each statement is
 * the service's own: an item of the question plan's `remaining_uncertainty`, or a reason the
 * evaluator attached to a rule that the plan did not already restate. Nothing is reworded,
 * merged across kinds or dropped; `topicsOf` then groups statements by their typed kind and
 * field for reading.
 */
import type { Answer, LookupOutcome, SourceSpan } from '../api/types';
import { UNCERTAINTY_KINDS, parseReason, sentence } from './labels';
import { type UncertaintyTopic, groupUncertainty, nextStep, topicsOf } from './uncertainty';

export interface OpenItem {
  key: string;
  kind: string;
  /** The service's name for this kind of statement, e.g. "Conflicting authority". */
  label: string;
  /** True only for a property fact: the one kind a person using the workspace can answer. */
  answerable: boolean;
  /** The kind of next step this needs, e.g. "A source to be obtained". */
  next: string;
  /** Interface note on who can close it; empty when the service's remedy already says so. */
  who: string;
  message: string;
  remedy: string;
  field: string | null;
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

export function openItems(outcome: LookupOutcome, answers: Answer[]): OpenItem[] {
  const plan = outcome.assist?.question_plan;
  const rows: OpenItem[] = [];

  for (const item of groupUncertainty(plan?.remaining_uncertainty ?? [])) {
    const kind = UNCERTAINTY_KINDS[item.kind] ?? { label: sentence(item.kind), answerable: false, who: '' };
    const step = nextStep(item.kind);
    rows.push({ key: `plan-${item.key}`, kind: item.kind, label: kind.label, answerable: kind.answerable, next: step.label, who: '', message: item.message, remedy: item.remedy, field: item.field, ruleIds: item.ruleIds, sourceRefs: item.sourceRefs, order: step.order });
  }

  // Reasons the evaluator attached to rules that the plan (if any) did not already cover.
  const planMessages = new Set(rows.map((row) => row.message));
  const messagesByRule = new Map<string, string[]>();
  const fieldRules = new Map<string, Set<string>>();
  const rowsByKey = new Map(rows.map(row => [row.key, row]));
  for (const row of rows) {
    for (const ruleId of row.ruleIds) {
      const messages = messagesByRule.get(ruleId) ?? [];
      messages.push(row.message);
      messagesByRule.set(ruleId, messages);
    }
    if (row.field !== null) {
      const rules = fieldRules.get(row.field) ?? new Set<string>();
      row.ruleIds.forEach(ruleId => rules.add(ruleId));
      fieldRules.set(row.field, rules);
    }
  }
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
        if (field && (asked.has(field) || fieldRules.get(field)?.has(evaluation.team_rule_id))) continue;
      }
      if (reason.kind === 'missing_property_fact') {
        const field = raw.slice(raw.indexOf(':') + 1).trim();
        if (asked.has(field) || fieldRules.get(field)?.has(evaluation.team_rule_id)) continue;
        const rules = fieldRules.get(field) ?? new Set<string>();
        rules.add(evaluation.team_rule_id);
        fieldRules.set(field, rules);
        const existing = rowsByKey.get(`fact-${field}`);
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
        rowsByKey.set(`fact-${field}`, rows[rows.length - 1]!);
      } else {
        // The plan restates most evaluator reasons, often inside a longer dated statement about
        // the same rule. A reason is not listed a second time when a plan statement for this
        // rule already carries its words in full.
        if (planMessages.has(reason.message)) continue;
        if (messagesByRule.get(evaluation.team_rule_id)?.some(message => message.includes(reason.message))) continue;
        const existing = rowsByKey.get(`reason-${raw}`);
        if (existing) {
          if (!existing.ruleIds.includes(evaluation.team_rule_id)) existing.ruleIds.push(evaluation.team_rule_id);
        } else {
          const kind = REASON_TO_KIND[reason.kind] ?? 'interpretation';
          const step = nextStep(kind);
          rows.push({ key: `reason-${raw}`, kind, label: reason.label, answerable: false, next: step.label, who: reason.remedy, message: reason.message, remedy: '', field: null, ruleIds: [evaluation.team_rule_id], sourceRefs: [], order: step.order, reason: reason.kind });
          rowsByKey.set(`reason-${raw}`, rows[rows.length - 1]!);
        }
      }
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

export interface OpenItemGroups {
  /** Topics about rules in this result that a documented property fact can close. */
  answerable: UncertaintyTopic<OpenItem>[];
  /** Topics about rules in this result that need evidence, interpretation or more analysis. */
  other: UncertaintyTopic<OpenItem>[];
  /** Topics that concern only rules outside this result. Kept, but apart. */
  outside: UncertaintyTopic<OpenItem>[];
  /** Statements in `answerable` and `other`, i.e. about this result. */
  statements: number;
}

/**
 * The same statements arranged for reading: grouped by kind and field, with the ones a
 * property fact can close first and the ones about rules outside this result set apart.
 */
export function groupOpenItems(items: OpenItem[], listedRuleIds: ReadonlySet<string>): OpenItemGroups {
  const outsideItems = items.filter((item) => item.ruleIds.length > 0 && !item.ruleIds.some((ruleId) => listedRuleIds.has(ruleId)));
  const outsideSet = new Set(outsideItems);
  const inside = items.filter((item) => !outsideSet.has(item));
  return {
    answerable: topicsOf(inside.filter((item) => item.answerable)),
    other: topicsOf(inside.filter((item) => !item.answerable)),
    outside: topicsOf(outsideItems),
    statements: inside.length,
  };
}
