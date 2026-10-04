/**
 * Arranges the service's uncertainty statements for reading. The planner often returns the
 * same statement once per rule; identical statements are shown once with every rule they hold
 * back. Nothing is added: each message and remedy is the service's own wording.
 */
import type { Evaluation, SourceSpan, Uncertainty } from '../api/types';

export interface GroupedUncertainty {
  key: string;
  kind: string;
  message: string;
  remedy: string;
  field: string | null;
  ruleIds: string[];
  sourceRefs: SourceSpan[];
}

export function groupUncertainty(items: Uncertainty[]): GroupedUncertainty[] {
  const groups = new Map<string, GroupedUncertainty>();
  for (const item of items) {
    const key = JSON.stringify([item.kind, item.message, item.remedy, item.field ?? null]);
    const group = groups.get(key) ?? { key, kind: item.kind, message: item.message, remedy: item.remedy, field: item.field ?? null, ruleIds: [], sourceRefs: [] };
    groups.set(key, group);
    for (const ruleId of item.rule_ids ?? []) if (!group.ruleIds.includes(ruleId)) group.ruleIds.push(ruleId);
    for (const ref of item.source_refs ?? []) {
      if (!group.sourceRefs.some((existing) => existing.doc_id === ref.doc_id && existing.start === ref.start && existing.end === ref.end)) group.sourceRefs.push(ref);
    }
  }
  return [...groups.values()];
}

/**
 * The kind of next step each uncertainty kind calls for. Only a property fact is something
 * the person using the workspace can answer; every other kind needs evidence or review.
 */
export const NEXT_STEP: Record<string, { label: string; answerable: boolean; order: number }> = {
  property_fact: { label: 'A factual answer', answerable: true, order: 0 },
  jurisdiction: { label: 'Location evidence', answerable: false, order: 1 },
  source_gap: { label: 'A source to be obtained', answerable: false, order: 2 },
  cross_reference: { label: 'A cited provision to be retrieved', answerable: false, order: 3 },
  conflict: { label: 'Review of conflicting sources', answerable: false, order: 4 },
  interpretation: { label: 'Interpretation review', answerable: false, order: 5 },
  analysis_limit: { label: 'More analysis', answerable: false, order: 6 },
  service_dependency: { label: 'A backend service', answerable: false, order: 7 },
};
export const nextStep = (kind: string) => NEXT_STEP[kind] ?? { label: 'Review', answerable: false, order: 9 };

/** Lookup lists omit rules that do not cover the property; an alternative records them explicitly. */
const UNLISTED = new Set(['inapplicable', 'failed']);

export interface Consequence {
  changed: Array<{ ruleId: string; before: Evaluation['result'] | null; after: Evaluation }>;
  unchanged: Evaluation[];
}

/**
 * Which results a hypothetical answer would move, by comparing the evaluator's recorded
 * output for the probe with the evaluator's current output. Both sides are evaluator output.
 */
export function consequenceOf(current: Evaluation[], alternative: Evaluation[]): Consequence {
  const now = new Map(current.map((evaluation) => [evaluation.team_rule_id, evaluation.result]));
  const changed: Consequence['changed'] = [];
  const unchanged: Evaluation[] = [];
  for (const evaluation of alternative) {
    const before = now.get(evaluation.team_rule_id) ?? null;
    const same = before === null ? UNLISTED.has(evaluation.result) : before === evaluation.result;
    if (same) unchanged.push(evaluation);
    else changed.push({ ruleId: evaluation.team_rule_id, before, after: evaluation });
  }
  return { changed, unchanged };
}
