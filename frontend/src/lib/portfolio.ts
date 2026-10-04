/**
 * Arranges a ChangeResult for reading: labels, groupings, a date timeline and a
 * source → rule → property tree. Everything here regroups values the API returned (the
 * comparison itself, GET /addresses, GET /rules/{id}, GET /sources/{id}). Nothing is
 * evaluated, inferred or ranked here, and no date is produced that a payload did not state.
 */
import type { AddressItem, ChangeResult, Evaluation, Evidence, Rule, SourceDocument } from '../api/types';
import { readDifferences } from './changes';
import { dateBounds, datePrecision, shiftDay, type DatePrecision } from './dates';
import { MATCH_QUALITY, categoryLabel } from './labels';

/* ---------- labels ---------- */

export interface PropertyLabel {
  addressId: string;
  /** Street address as supplied, or null while the address list has not been read. */
  street: string | null;
  /** Legal municipality when it is established; otherwise a statement that it is not. */
  place: string;
  placeKey: string;
  resolved: boolean;
  /** Postal city, shown only as a postal detail — never used as the legal municipality. */
  postalCity: string | null;
}

export function propertyLabel(addressId: string, item: AddressItem | undefined): PropertyLabel {
  if (!item) return { addressId, street: null, place: 'Location not loaded', placeKey: 'unloaded', resolved: false, postalCity: null };
  const { resolution, property } = item;
  const state = resolution.state ?? property.raw_address.state ?? null;
  const resolved = resolution.match_quality === 'resolved' && !!resolution.municipality;
  const quality = MATCH_QUALITY[resolution.match_quality ?? 'unresolved']?.label.toLowerCase() ?? 'unresolved';
  return {
    addressId,
    street: property.raw_address.street_address,
    place: resolved ? `${resolution.municipality}${state ? `, ${state}` : ''}` : `Municipality ${quality}${state ? ` · ${state}` : ''}`,
    placeKey: resolved ? `place:${resolution.municipality}|${state ?? ''}` : `open:${resolution.match_quality ?? 'unresolved'}|${state ?? ''}`,
    resolved,
    postalCity: property.raw_address.postal_city ?? null,
  };
}

export interface RuleLabel {
  ruleId: string;
  /** Null while the rule record has not been read; the ID is then the only honest label. */
  title: string | null;
  citation: string | null;
  jurisdiction: string | null;
  category: string | null;
  categoryLabel: string | null;
}

export function ruleLabel(ruleId: string, rule: Rule | undefined): RuleLabel {
  if (!rule) return { ruleId, title: null, citation: null, jurisdiction: null, category: null, categoryLabel: null };
  return { ruleId, title: rule.title, citation: rule.citation, jurisdiction: rule.jurisdiction, category: rule.category, categoryLabel: categoryLabel(rule.category) };
}

/* ---------- impact rows ---------- */

export interface ImpactRow {
  key: string;
  addressId: string;
  ruleId: string;
  /** "definite" or "uncertain", exactly as the comparison returned it. */
  certainty: string;
  before: Evaluation | null;
  after: Evaluation | null;
  /** The evaluator's own conflict flag on the later evaluation. */
  conflict: boolean;
}

export function impactRows(result: ChangeResult): { rows: ImpactRow[]; unreadable: Array<{ addressId: string; entries: unknown[] }> } {
  const rows: ImpactRow[] = [];
  const unreadable: Array<{ addressId: string; entries: unknown[] }> = [];
  for (const diff of readDifferences(result)) {
    for (const delta of diff.deltas) {
      rows.push({ key: `${diff.addressId}|${delta.ruleId}`, addressId: diff.addressId, ruleId: delta.ruleId, certainty: delta.certainty, before: delta.before, after: delta.after, conflict: delta.after?.conflict_flag === true });
    }
    if (diff.unreadable.length) unreadable.push({ addressId: diff.addressId, entries: diff.unreadable });
  }
  return { rows, unreadable };
}

export type ImpactKind = 'definite' | 'uncertain' | 'conflict';

export interface Filters {
  impact: ImpactKind | null;
  place: string | null;
  category: string | null;
}

export const NO_FILTERS: Filters = { impact: null, place: null, category: null };

export interface Lookups {
  addresses: ReadonlyMap<string, AddressItem>;
  rules: ReadonlyMap<string, Rule>;
  sources: ReadonlyMap<string, SourceDocument>;
}

const matchesImpact = (row: ImpactRow, impact: ImpactKind | null) => impact === null || (impact === 'conflict' ? row.conflict : row.certainty === impact);

export function filterRows(rows: ImpactRow[], filters: Filters, lookups: Lookups): ImpactRow[] {
  return rows.filter(
    (row) =>
      matchesImpact(row, filters.impact) &&
      (filters.place === null || propertyLabel(row.addressId, lookups.addresses.get(row.addressId)).placeKey === filters.place) &&
      (filters.category === null || (lookups.rules.get(row.ruleId)?.category ?? UNLABELED) === filters.category),
  );
}

/* ---------- summaries ---------- */

export interface GroupSummary {
  key: string;
  label: string;
  /** Extra words for a group that needs explaining, e.g. an unresolved location. */
  note?: string;
  /** Distinct properties with at least one changed result in this group. */
  properties: number;
  definite: number;
  uncertain: number;
  conflict: number;
}

const UNLABELED = '__unlabeled__';

function summarize(rows: ImpactRow[], groupOf: (row: ImpactRow) => { key: string; label: string; note?: string; last?: boolean }): GroupSummary[] {
  const groups = new Map<string, { label: string; note?: string; last: boolean; all: Set<string>; definite: Set<string>; uncertain: Set<string>; conflict: Set<string> }>();
  for (const row of rows) {
    const group = groupOf(row);
    const entry = groups.get(group.key) ?? { label: group.label, note: group.note, last: group.last === true, all: new Set(), definite: new Set(), uncertain: new Set(), conflict: new Set() };
    groups.set(group.key, entry);
    entry.all.add(row.addressId);
    if (row.certainty === 'definite') entry.definite.add(row.addressId);
    if (row.certainty === 'uncertain') entry.uncertain.add(row.addressId);
    if (row.conflict) entry.conflict.add(row.addressId);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => Number(a.last) - Number(b.last) || a.label.localeCompare(b.label))
    .map(([key, entry]) => ({ key, label: entry.label, note: entry.note, properties: entry.all.size, definite: entry.definite.size, uncertain: entry.uncertain.size, conflict: entry.conflict.size }));
}

/** Where the properties with a changed result are. An unresolved location is its own group. */
export function summarizeByPlace(rows: ImpactRow[], lookups: Lookups): GroupSummary[] {
  return summarize(rows, (row) => {
    const label = propertyLabel(row.addressId, lookups.addresses.get(row.addressId));
    if (label.placeKey === 'unloaded') return { key: label.placeKey, label: label.place, last: true };
    return label.resolved
      ? { key: label.placeKey, label: label.place }
      : { key: label.placeKey, label: label.place, note: 'Legal municipality not established; the postal city is not used.', last: true };
  });
}

/** What kind of rule changed, by the category on the rule record. */
export function summarizeByCategory(rows: ImpactRow[], lookups: Lookups): GroupSummary[] {
  return summarize(rows, (row) => {
    const rule = lookups.rules.get(row.ruleId);
    return rule ? { key: rule.category, label: categoryLabel(rule.category) } : { key: UNLABELED, label: 'Rule details not loaded', last: true };
  });
}

/* ---------- timeline ---------- */

export type EventType = 'status' | 'observed' | 'effective' | 'end';

export interface TimelineEvent {
  key: string;
  type: EventType;
  /** StatusEvent.status for a status event; the rule's lifecycle for an observed status. */
  status: string | null;
  /** The date exactly as the rule record states it (YYYY, YYYY-MM or YYYY-MM-DD). */
  date: string;
  precision: DatePrecision;
  /** First and last calendar day the stated date can mean. Equal for a full day. */
  low: string;
  high: string;
  ruleIds: string[];
  evidence: Evidence[];
  /** Where the event falls relative to the two compared dates. */
  position: 'earlier' | 'between' | 'later' | 'overlaps';
}

export interface Timeline {
  before: string;
  after: string;
  events: TimelineEvent[];
  /** Rule records whose dates could not be read as YYYY, YYYY-MM or YYYY-MM-DD. */
  unreadable: Array<{ ruleId: string; value: string }>;
}

const TYPE_ORDER: Record<EventType, number> = { status: 0, observed: 1, effective: 2, end: 3 };

/**
 * Dated statements on the rule records behind a comparison, in date order. A result on the
 * first compared date already reflects everything dated on or before it; events after it and
 * on or before the second date fall between the two.
 */
export function buildTimeline(result: Pick<ChangeResult, 'before' | 'after'>, rules: Rule[]): Timeline {
  const merged = new Map<string, TimelineEvent>();
  const unreadable: Timeline['unreadable'] = [];
  const add = (rule: Rule, type: EventType, status: string | null, date: string | null | undefined, evidence: Evidence[]) => {
    if (!date) return;
    const bounds = dateBounds(date);
    const precision = datePrecision(date);
    if (!bounds || !precision) {
      unreadable.push({ ruleId: rule.team_rule_id, value: date });
      return;
    }
    const key = `${type}:${status ?? ''}:${date}`;
    const position: TimelineEvent['position'] =
      bounds.high <= result.before ? 'earlier' : bounds.low > result.after ? 'later' : bounds.low > result.before && bounds.high <= result.after ? 'between' : 'overlaps';
    const event = merged.get(key) ?? { key, type, status, date, precision, low: bounds.low, high: bounds.high, ruleIds: [], evidence: [], position };
    merged.set(key, event);
    if (!event.ruleIds.includes(rule.team_rule_id)) event.ruleIds.push(rule.team_rule_id);
    for (const item of evidence) {
      if (!event.evidence.some((existing) => existing.doc_id === item.doc_id && existing.start === item.start && existing.quote === item.quote)) event.evidence.push(item);
    }
  };
  for (const rule of rules) {
    for (const event of rule.status_events ?? []) add(rule, 'status', event.status, event.on, event.evidence);
    // A status snapshot that only repeats a dated status event is the same statement, not a second one.
    const repeated = (rule.status_events ?? []).some((event) => event.on === rule.status_as_of && event.status === rule.lifecycle);
    if (!repeated) add(rule, 'observed', rule.lifecycle, rule.status_as_of, rule.evidence.filter((item) => item.supports.includes('status_as_of')));
    add(rule, 'effective', null, rule.effective_date, rule.evidence.filter((item) => item.supports.includes('effective_date')));
    add(rule, 'end', null, rule.end_date, rule.evidence.filter((item) => item.supports.includes('end_date')));
  }
  const events = [...merged.values()].sort((a, b) => a.low.localeCompare(b.low) || a.high.localeCompare(b.high) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  return { before: result.before, after: result.after, events, unreadable };
}

export interface ComparisonOffer {
  before: string;
  after: string;
  /** What the pair of days means relative to the stated date. */
  meaning: 'day_before_to_day' | 'day_before_to_first_possible_day' | 'day_before_to_last_possible_day';
}

/** Day pairs that straddle an event, for "compare across this date". Never a guessed day. */
export function comparisonsAcross(event: TimelineEvent): ComparisonOffer[] {
  const before = shiftDay(event.low, -1);
  if (!before) return [];
  if (event.low === event.high) return [{ before, after: event.low, meaning: 'day_before_to_day' }];
  return [
    { before, after: event.low, meaning: 'day_before_to_first_possible_day' },
    { before, after: event.high, meaning: 'day_before_to_last_possible_day' },
  ];
}

/* ---------- drill-down trees ---------- */

export interface RuleNode {
  ruleId: string;
  rule: Rule | null;
  rows: ImpactRow[];
}

export interface SourceNode {
  /** Empty when the rule record (and so its source) has not been read. */
  docId: string;
  source: SourceDocument | null;
  rules: RuleNode[];
  properties: number;
}

/** Source document → rules encoded from it that changed → properties whose result changed. */
export function sourceTree(rows: ImpactRow[], lookups: Lookups): SourceNode[] {
  const byRule = new Map<string, ImpactRow[]>();
  for (const row of rows) byRule.set(row.ruleId, [...(byRule.get(row.ruleId) ?? []), row]);
  const nodes = new Map<string, SourceNode>();
  for (const [ruleId, ruleRows] of byRule) {
    const rule = lookups.rules.get(ruleId) ?? null;
    const docId = rule?.source_doc_id ?? '';
    const node = nodes.get(docId) ?? { docId, source: lookups.sources.get(docId) ?? null, rules: [], properties: 0 };
    nodes.set(docId, node);
    node.rules.push({ ruleId, rule, rows: ruleRows });
  }
  for (const node of nodes.values()) {
    node.rules.sort((a, b) => (a.rule?.title ?? a.ruleId).localeCompare(b.rule?.title ?? b.ruleId) || a.ruleId.localeCompare(b.ruleId));
    node.properties = new Set(node.rules.flatMap((rule) => rule.rows.map((row) => row.addressId))).size;
  }
  return [...nodes.values()].sort((a, b) => Number(a.docId === '') - Number(b.docId === '') || a.docId.localeCompare(b.docId));
}

export interface PropertyNode {
  addressId: string;
  label: PropertyLabel;
  rows: ImpactRow[];
}

export function propertyTree(rows: ImpactRow[], lookups: Lookups): PropertyNode[] {
  const byAddress = new Map<string, ImpactRow[]>();
  for (const row of rows) byAddress.set(row.addressId, [...(byAddress.get(row.addressId) ?? []), row]);
  return [...byAddress.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([addressId, addressRows]) => ({ addressId, label: propertyLabel(addressId, lookups.addresses.get(addressId)), rows: addressRows }));
}

/** Rule IDs a comparison mentions: every rule with a changed result, plus scenario mappings. */
export function referencedRuleIds(result: ChangeResult): string[] {
  const ids = new Set<string>();
  for (const row of impactRows(result).rows) ids.add(row.ruleId);
  for (const mapped of Object.values(result.mapped_rule_ids ?? {})) for (const id of mapped) ids.add(id);
  return [...ids].sort();
}

/** Address IDs a comparison mentions in any of its lists. */
export function referencedAddressIds(result: ChangeResult): string[] {
  return [...new Set([...result.affected_address_ids, ...result.uncertain_address_ids, ...result.conflict_flag_address_ids, ...Object.keys(result.differences ?? {})])].sort();
}
