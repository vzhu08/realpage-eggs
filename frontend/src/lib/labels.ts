/**
 * Presentation labels for contract enums. These rename values for readers; they add no
 * legal meaning. Unknown values fall back to the raw value so nothing is hidden.
 */
import type { RuleResult } from '../api/types';

export const humanize = (value: string): string => value.replace(/[_-]+/g, ' ').trim();
export const sentence = (value: string): string => {
  const text = humanize(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export type Tone = 'applies' | 'unknown' | 'future' | 'pending' | 'muted' | 'danger' | 'neutral' | 'info';

export const RESULT_ORDER: RuleResult[] = ['applies', 'unknown', 'not_yet_effective', 'pending', 'superseded', 'inapplicable', 'failed'];

export const RESULT_META: Record<RuleResult, { label: string; tone: Tone; group: string; gloss: string }> = {
  applies: { label: 'Applies', tone: 'applies', group: 'Applies on this date', gloss: 'The encoded coverage conditions are met on the query date. This is applicability, not a finding of compliance or violation.' },
  unknown: { label: 'Unknown', tone: 'unknown', group: 'Not yet determinable', gloss: 'Coverage cannot be established from the facts, sources or dates available.' },
  not_yet_effective: { label: 'Not yet effective', tone: 'future', group: 'Enacted, not yet effective', gloss: 'Enacted, but its effective date is after the query date.' },
  pending: { label: 'Pending', tone: 'pending', group: 'Pending, not current law', gloss: 'A proposal that has not been enacted. It creates no current obligation.' },
  superseded: { label: 'Superseded', tone: 'muted', group: 'Superseded', gloss: 'Displaced by another rule within the scope supported by the evidence.' },
  inapplicable: { label: 'Does not cover', tone: 'muted', group: 'Does not cover this property', gloss: 'The evaluator found the property outside this rule’s coverage on the query date.' },
  failed: { label: 'Failed measure', tone: 'muted', group: 'Failed measures', gloss: 'A measure that failed and creates no operative obligation.' },
};

export function resultMeta(result: string) {
  return RESULT_META[result as RuleResult] ?? { label: sentence(result), tone: 'neutral' as Tone, group: sentence(result), gloss: '' };
}

export const CATEGORY_LABELS: Record<string, string> = {
  rent_increase_limits: 'Rent increase limits',
  just_cause_eviction: 'Just-cause eviction',
  security_deposits: 'Security deposits',
  application_screening_fees: 'Application and screening fees',
  screening_restrictions: 'Screening restrictions',
  algorithmic_rent_setting: 'Algorithmic rent setting',
};
export const categoryLabel = (value: string) => CATEGORY_LABELS[value] ?? sentence(value);

export const TEMPORAL_LABELS: Record<string, string> = {
  in_force: 'In force',
  not_yet_effective: 'Not yet effective',
  pending: 'Pending',
  failed: 'Failed',
  inapplicable: 'No longer in force',
  unknown: 'Date status unknown',
};
export const temporalLabel = (value: string) => TEMPORAL_LABELS[value] ?? sentence(value);

export const TRUTH_LABELS: Record<string, string> = { true: 'Yes', false: 'No', unknown: 'Unknown' };

/** JurisdictionResolution.match_quality */
export const MATCH_QUALITY: Record<string, { label: string; tone: Tone; gloss: string }> = {
  resolved: { label: 'Resolved', tone: 'applies', gloss: 'The legal municipality was established by the recorded method.' },
  unresolved: { label: 'Unresolved', tone: 'unknown', gloss: 'The legal municipality is not established. Local rules for this state stay uncertain.' },
  ambiguous: { label: 'Ambiguous', tone: 'unknown', gloss: 'More than one municipality matched. Local rules stay uncertain.' },
  failed: { label: 'Resolution failed', tone: 'danger', gloss: 'The resolution attempt failed. Local rules stay uncertain.' },
};

/** Prefixes the evaluator puts on uncertainty reasons (navigator/engine.py, predicates.py). */
const REASON_KINDS: Record<string, { label: string; remedy: string }> = {
  missing_property_fact: { label: 'Missing property fact', remedy: 'A factual answer about the property can resolve this.' },
  jurisdiction_uncertainty: { label: 'Jurisdiction uncertain', remedy: 'Needs the property’s legal municipality to be established.' },
  temporal_uncertainty: { label: 'Date uncertain', remedy: 'The source’s dates or lifecycle history are not precise enough for this query date.' },
  unresolved_extraction: { label: 'Extraction needs review', remedy: 'The encoded rule has an unresolved review issue. This is not something a property fact can settle.' },
  conflicting_legal_evidence: { label: 'Conflicting evidence', remedy: 'Sources disagree and precedence is not established. Needs legal review.' },
  possible_interaction: { label: 'Possible interaction', remedy: 'Another rule may interact with this one. Needs review of the cited interaction.' },
  cyclic_interaction: { label: 'Cyclic interaction', remedy: 'Rules reference each other in a cycle. Needs review.' },
  unsupported_condition: { label: 'Unsupported condition', remedy: 'The rule contains a condition the evaluator cannot encode. Needs interpretation.' },
};

export interface ParsedReason {
  kind: string;
  label: string;
  message: string;
  remedy: string;
  raw: string;
}

export function parseReason(raw: string): ParsedReason {
  const index = raw.indexOf(':');
  const kind = index > 0 ? raw.slice(0, index).trim() : '';
  const known = REASON_KINDS[kind];
  if (!known) return { kind: 'other', label: 'Unresolved', message: raw, remedy: '', raw };
  const message = raw.slice(index + 1).trim();
  return { kind, label: known.label, message: kind === 'missing_property_fact' ? humanize(message) : message, remedy: known.remedy, raw };
}

/** Uncertainty.kind from the assist contract, with who can resolve it. */
export const UNCERTAINTY_KINDS: Record<string, { label: string; answerable: boolean; who: string }> = {
  property_fact: { label: 'Property fact', answerable: true, who: 'You can answer this with a documented fact.' },
  jurisdiction: { label: 'Jurisdiction', answerable: false, who: 'Needs location evidence, not an opinion about which law applies.' },
  source_gap: { label: 'Source gap', answerable: false, who: 'Needs a source to be obtained and verified. Not answerable by a renter or owner.' },
  cross_reference: { label: 'Cross-reference', answerable: false, who: 'A cited provision has not been retrieved. Not answerable by a renter or owner.' },
  interpretation: { label: 'Interpretation', answerable: false, who: 'Needs legal interpretation or review.' },
  conflict: { label: 'Conflicting authority', answerable: false, who: 'Needs review of conflicting sources.' },
  analysis_limit: { label: 'Analysis limit', answerable: false, who: 'The analysis stopped at an explicit budget. Uncertainty is retained.' },
  service_dependency: { label: 'Service dependency', answerable: false, who: 'A backend service is not available yet.' },
};

export const PROVENANCE_LABELS: Record<string, string> = {
  user_provided: 'You provided · unverified',
  demo: 'Demo answer · synthetic',
};

/** Formats any scalar fact value for display without interpreting it. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Unknown';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
