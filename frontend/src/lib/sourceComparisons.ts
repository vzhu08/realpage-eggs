/**
 * Arranges GET /source-comparisons for reading. Each observation is a pair of claims about one
 * field, with the exact passages each claim rests on. The service re-checks every passage
 * against its stored source and classifies the pair; this file only orders and labels what it
 * returned. It never decides that a difference is a legal conflict, and it never picks a side.
 */
import type { ClaimComparison, ComparedClaim, ComparisonSupport, SourceComparisonsResponse } from '../api/types';
import { formatDate } from './dates';
import { type Tone, formatValue, sentence } from './labels';

export type Classification = ClaimComparison['classification'];

export const CLASSIFICATION: Record<Classification, { label: string; tone: Tone; gloss: string; order: number }> = {
  different_claims: {
    label: 'The two texts state different things',
    tone: 'unknown',
    gloss: 'Each passage was found exactly where it was recorded, and the two state different values for this field. This is a difference between two texts; whether it is a legal conflict has not been decided.',
    order: 0,
  },
  missing_support: {
    label: 'Support is missing on one side',
    tone: 'muted',
    gloss: 'At least one claim has no captured passage, or a recorded passage no longer matches its source. Nothing is established about how the two claims compare.',
    order: 1,
  },
  same_claim: {
    label: 'Both texts state the same thing',
    tone: 'info',
    gloss: 'Each passage was found exactly where it was recorded, and the two state the same value. Matching text is not a check of meaning.',
    order: 2,
  },
};

/** What the recorded passages for one claim amount to, from the service’s own checks. */
export type SupportState = 'supported' | 'stale' | 'none';

export function supportState(claim: ComparedClaim): SupportState {
  if (!claim.support.length) return 'none';
  return claim.support.every((item) => item.anchor_valid && item.source?.identity_valid === true) ? 'supported' : 'stale';
}

/** Why one recorded passage does not count as support, when it does not. */
export function supportProblem(item: ComparisonSupport): string | null {
  if (!item.source) return 'The source this passage was recorded from is not in the snapshot.';
  if (!item.source.identity_valid) return 'The stored source no longer matches its recorded hash.';
  if (!item.anchor_valid) return 'The passage is no longer found at its recorded position in the source.';
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  effective_date: 'Effective date',
  end_date: 'End date',
  enactment_date: 'Enactment date',
  key_value: 'Key value',
  lifecycle: 'Lifecycle status',
  requirement: 'Requirement',
  interaction: 'Interaction between rules',
};
export const comparisonFieldLabel = (field: string) => FIELD_LABELS[field] ?? sentence(field);

const DATE_LIKE = /^\d{4}(-\d{2}){0,2}$/;

/** A claimed value as text. A value that is exactly a date keeps the precision it was given in. */
export function claimValue(value: unknown): string {
  if (typeof value === 'string') return DATE_LIKE.test(value) ? formatDate(value) : value;
  return formatValue(value);
}

export interface ComparisonView {
  id: string;
  observation: ClaimComparison;
  fieldLabel: string;
  classification: (typeof CLASSIFICATION)[Classification];
  sides: Array<{ key: 'before' | 'after'; claim: ComparedClaim; value: string; state: SupportState }>;
}

export function arrangeComparisons(response: SourceComparisonsResponse): ComparisonView[] {
  return Object.entries(response.observations)
    .map(([id, observation]) => ({
      id,
      observation,
      fieldLabel: comparisonFieldLabel(observation.field),
      classification: CLASSIFICATION[observation.classification],
      sides: (['before', 'after'] as const).map((key) => ({ key, claim: observation[key], value: claimValue(observation[key].value), state: supportState(observation[key]) })),
    }))
    .sort((a, b) => a.classification.order - b.classification.order || a.id.localeCompare(b.id));
}

/** Observations that name any of these rules. An observation with no rule IDs names none. */
export function comparisonsForRules(views: ComparisonView[], ruleIds: Iterable<string>): ComparisonView[] {
  const wanted = new Set(ruleIds);
  return views.filter((view) => view.observation.rule_ids.some((ruleId) => wanted.has(ruleId)));
}

/** Counts for a one-line summary. The three kinds are reported apart, never as one number of "conflicts". */
export function comparisonCounts(views: ComparisonView[]): Record<Classification, number> {
  const counts: Record<Classification, number> = { different_claims: 0, missing_support: 0, same_claim: 0 };
  for (const view of views) counts[view.observation.classification] += 1;
  return counts;
}
