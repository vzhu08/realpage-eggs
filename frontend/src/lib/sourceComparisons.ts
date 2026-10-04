/**
 * Arranges GET /source-comparisons for reading. Each observation is a pair of recorded claims
 * about one field, with the exact passages each claim cites. The service re-checks every
 * passage against its stored source and classifies the pair (navigator/source_comparison.py,
 * compare_claims); this file only orders and labels what it returned.
 *
 * What the service's classification does and does not establish:
 *  - `different_claims`: both sides cite at least one passage, every passage was found at its
 *    recorded position in a source whose hash matches, and the two recorded values are not
 *    equal. It is a literal difference between two recorded claims.
 *  - `same_claim`: the same checks pass and the two recorded values are equal.
 *  - `missing_support`: a side cites no passage, or some passage did not pass its check.
 * In every case the meaning of a passage is not checked (`semantic_support: not_checked`), no
 * side is preferred (`winner: null`) and no amendment is asserted (`legal_amendment: null`).
 * Nothing here decides that a difference is a legal conflict, and nothing here picks a side.
 */
import type { ClaimComparison, ComparedClaim, ComparisonSupport, SourceComparisonsResponse } from '../api/types';
import { datePrecision, formatDate } from './dates';
import { type Tone, formatValue, sentence } from './labels';

export type Classification = ClaimComparison['classification'];

export const CLASSIFICATION: Record<Classification, { label: string; tone: Tone; gloss: string; order: number }> = {
  different_claims: {
    label: 'The two claims differ',
    tone: 'unknown',
    gloss:
      'The two recorded values are literally different, and each cited passage was found exactly where it was recorded, in a stored source whose hash matches. Whether each passage means what its claim says was not checked, and whether the difference is a legal conflict has not been decided.',
    order: 0,
  },
  missing_support: {
    label: 'Support is missing or does not check out',
    tone: 'muted',
    gloss: 'At least one claim cites no captured passage, or a cited passage did not pass the service’s check against its stored source. Nothing is established about how the two claims compare.',
    order: 1,
  },
  same_claim: {
    label: 'The two claims are the same',
    tone: 'info',
    gloss: 'The two recorded values are equal, and each cited passage was found exactly where it was recorded, in a stored source whose hash matches. Matching values are not a check of meaning, and this is not a finding that the sources agree on the law.',
    order: 2,
  },
};

/** What the service's `status` says, in words. The raw value stays in the card's detail. */
export const STATUS_LABEL: Record<ClaimComparison['status'], string> = {
  unresolved: 'Unresolved',
  same_observation_not_semantically_verified: 'Same observation · meaning not verified',
};

/** What the cited passages for one claim amount to, from the service’s own checks. */
export type SupportState = 'supported' | 'stale' | 'none';

/** Why one cited passage does not count as support. Read from the response; nothing is inferred. */
export type SupportIssue =
  | 'source_missing' // `source` is null: the cited document is not in the snapshot
  | 'identity_mismatch' // `source.identity_valid` is false: the stored text no longer has its recorded hash
  | 'anchor_invalid'; // `anchor_valid` is false with the source present and intact

export function supportIssue(item: ComparisonSupport): SupportIssue | null {
  if (!item.source) return 'source_missing';
  if (!item.source.identity_valid) return 'identity_mismatch';
  if (!item.anchor_valid) return 'anchor_invalid';
  return null;
}

const ISSUE_WORDS: Record<SupportIssue, string> = {
  source_missing: 'The source this passage was recorded from is not in the snapshot, so the passage cannot be checked.',
  identity_mismatch: 'The stored text of this source does not hash to the hash recorded for it, so the service does not count a passage in it as checked.',
  anchor_invalid: 'The service did not confirm this passage at its recorded position in the stored source.',
};

/** Why one cited passage does not count as support, when it does not. */
export function supportProblem(item: ComparisonSupport): string | null {
  const issue = supportIssue(item);
  if (!issue) return null;
  // Two fields of the response compared as they are: the hash recorded on the passage and the stored source's.
  if (issue === 'anchor_invalid' && item.source && item.span.source_hash !== item.source.sha256) {
    return `${ISSUE_WORDS.anchor_invalid} The source hash recorded with the passage is not the stored source’s hash.`;
  }
  return ISSUE_WORDS[issue];
}

export function supportState(claim: ComparedClaim): SupportState {
  if (!claim.support.length) return 'none';
  return claim.support.every((item) => supportIssue(item) === null) ? 'supported' : 'stale';
}

/** One sentence on what was checked for a claim's passages. */
export function supportSummary(claim: ComparedClaim): string {
  const total = claim.support.length;
  if (total === 0) return 'No passage was captured for this claim, so there is nothing to check.';
  const failing = claim.support.filter((item) => supportIssue(item) !== null).length;
  if (failing === 0) return total === 1 ? 'Its passage was found at its recorded position, in a stored source whose hash matches.' : `All ${total} passages were found at their recorded positions, in stored sources whose hashes match.`;
  return total === 1 ? 'Its passage did not pass the check against the stored source, so it does not count as support.' : `${failing} of ${total} passages did not pass the check against the stored source, so the claim is not supported as recorded.`;
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
/** A reading label for the field. An unlisted field name is shown as written, with spaces. */
export const comparisonFieldLabel = (field: string) => FIELD_LABELS[field] ?? sentence(field);

const DATE_LIKE = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * A claimed value as text. Free text is shown as written. A value that is exactly a date keeps
 * the precision it was given in: a month stays a month and is never placed on a day.
 */
export function claimValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'No value recorded';
  if (typeof value === 'string') {
    if (!DATE_LIKE.test(value)) return value;
    return datePrecision(value) === 'month' ? `${formatDate(value)} · month only` : formatDate(value);
  }
  return formatValue(value);
}

export interface ComparisonSide {
  key: 'before' | 'after';
  claim: ComparedClaim;
  /** The claimed value, for reading. */
  value: string;
  state: SupportState;
  /** What the service's checks on this side's passages amount to. */
  summary: string;
}

export interface ComparisonView {
  id: string;
  observation: ClaimComparison;
  fieldLabel: string;
  classification: (typeof CLASSIFICATION)[Classification];
  /** The card's title: the classification, made specific about which support is missing or stale. */
  headline: string;
  sides: ComparisonSide[];
}

function headlineFor(observation: ClaimComparison, sides: ComparisonSide[]): string {
  if (observation.classification !== 'missing_support') return CLASSIFICATION[observation.classification].label;
  const none = sides.filter((side) => side.state === 'none').length;
  const stale = sides.some((side) => side.state === 'stale');
  const absent = none === 2 ? 'Neither claim has a captured passage' : none === 1 ? 'One claim has no captured passage' : null;
  if (absent && stale) return `${absent}, and a cited passage no longer checks out`;
  if (absent) return absent;
  if (stale) return 'A cited passage no longer checks out against its source';
  return CLASSIFICATION.missing_support.label;
}

export function arrangeComparisons(response: SourceComparisonsResponse): ComparisonView[] {
  return Object.entries(response.observations)
    .map(([id, observation]) => {
      const sides = (['before', 'after'] as const).map((key): ComparisonSide => ({ key, claim: observation[key], value: claimValue(observation[key].value), state: supportState(observation[key]), summary: supportSummary(observation[key]) }));
      return { id, observation, fieldLabel: comparisonFieldLabel(observation.field), classification: CLASSIFICATION[observation.classification], headline: headlineFor(observation, sides), sides };
    })
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

export const COUNT_ORDER: Classification[] = ['different_claims', 'missing_support', 'same_claim'];
const COUNT_WORDS: Record<Classification, (count: number) => string> = {
  different_claims: (count) => `${count} ${count === 1 ? 'differs' : 'differ'}`,
  missing_support: (count) => `${count} with support missing or not checking out`,
  same_claim: (count) => `${count} ${count === 1 ? 'is' : 'are'} the same`,
};
/** “2 differ”, “1 with support missing…”, “1 is the same”: one phrase per kind that occurs. */
export const countPhrase = (kind: Classification, count: number) => COUNT_WORDS[kind](count);
