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
  const indexes = new Map<string, { rules: Set<string>; sources: Map<string, Set<string>> }>();
  for (const item of items) {
    const key = JSON.stringify([item.kind, item.message, item.remedy, item.field ?? null]);
    const group = groups.get(key) ?? { key, kind: item.kind, message: item.message, remedy: item.remedy, field: item.field ?? null, ruleIds: [], sourceRefs: [] };
    groups.set(key, group);
    const index = indexes.get(key) ?? { rules: new Set<string>(), sources: new Map<string, Set<string>>() };
    indexes.set(key, index);
    for (const ruleId of item.rule_ids ?? []) {
      if (!index.rules.has(ruleId)) { index.rules.add(ruleId); group.ruleIds.push(ruleId); }
    }
    for (const ref of item.source_refs ?? []) {
      // Offsets identify a passage only within one source version. Keep every distinct
      // version, quote and section when identical statements are grouped for reading.
      const span = JSON.stringify([ref.doc_id, ref.source_hash, ref.start, ref.end, ref.section ?? null]);
      const texts = index.sources.get(span) ?? new Set<string>();
      if (!texts.has(ref.text)) { texts.add(ref.text); group.sourceRefs.push(ref); }
      index.sources.set(span, texts);
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

/**
 * How many results at least one recorded answer to a question would move. `listed` is how many
 * of those are among the results on screen now; an answer can also bring in a rule that is not
 * listed yet, so the two can differ.
 */
export function movableResults(current: Evaluation[], question: { alternatives: Array<{ evaluations: Evaluation[] }> }): { movable: number; listed: number; shown: number } {
  const ids = new Set(question.alternatives.flatMap((alternative) => consequenceOf(current, alternative.evaluations).changed.map((change) => change.ruleId)));
  const onScreen = new Set(current.map((evaluation) => evaluation.team_rule_id));
  return { movable: ids.size, listed: [...ids].filter((id) => onScreen.has(id)).length, shown: current.length };
}

/** "2 of the 3 results above", "the one result above", or "2 results" when an answer would also bring in a rule not listed yet. */
export function movableWords(count: { movable: number; listed: number; shown: number }): string {
  if (count.listed !== count.movable || count.shown === 0) return `${count.movable} ${count.movable === 1 ? 'result' : 'results'}`;
  return count.shown === 1 ? 'the one result above' : `${count.movable} of the ${count.shown} results above`;
}

/**
 * One readable topic: every open statement of one kind about one fact (or about no fact).
 * A topic is a way to read the statements together; each statement stays intact inside it,
 * with its own wording, remedy, rule references and source text.
 */
export interface UncertaintyTopic<T extends TopicStatement> {
  key: string;
  kind: string;
  field: string | null;
  statements: T[];
  /** Every rule any statement in the topic refers to, in first-seen order. */
  ruleIds: string[];
  /** The distinct next steps the statements give, in first-seen order. */
  remedies: string[];
}

export interface TopicStatement {
  kind: string;
  field?: string | null;
  remedy: string;
  ruleIds: string[];
}

/** Groups by the typed kind and field only. Message text is never read to decide a group. */
export function topicsOf<T extends TopicStatement>(statements: T[]): UncertaintyTopic<T>[] {
  const topics = new Map<string, UncertaintyTopic<T>>();
  for (const statement of statements) {
    const field = statement.field ?? null;
    const key = `${statement.kind}|${field ?? ''}`;
    const topic = topics.get(key) ?? { key, kind: statement.kind, field, statements: [], ruleIds: [], remedies: [] };
    topics.set(key, topic);
    topic.statements.push(statement);
    for (const ruleId of statement.ruleIds) if (!topic.ruleIds.includes(ruleId)) topic.ruleIds.push(ruleId);
    if (statement.remedy && !topic.remedies.includes(statement.remedy)) topic.remedies.push(statement.remedy);
  }
  return [...topics.values()];
}

/**
 * A plain heading for each kind of open item. It names the kind of gap, in the interface's own
 * words; the service's statements, shown beneath it, say what the gap is.
 */
export const TOPIC_HEADING: Record<string, string> = {
  property_fact: 'A fact about the property is not on record',
  jurisdiction: 'The legal municipality is not established',
  source_gap: 'Source support is incomplete',
  cross_reference: 'A cited provision has not been retrieved',
  conflict: 'Sources conflict and no precedence is established',
  interpretation: 'Encoded rules need interpretation review',
  analysis_limit: 'The analysis did not cover every case',
  service_dependency: 'A backend service was not available',
};

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
