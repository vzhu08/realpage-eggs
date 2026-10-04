/**
 * Lays two source-backed claims side by side. It reads what the API already returns — the
 * evaluator's conflict flags, the rule records in conflict, their evidence and the source
 * records — and never decides which claim is right. No field here is a preference or a score.
 *
 * Two kinds of conflict exist in today's contract:
 *  - two rule records for the same provision that state different things (the backend flags
 *    both when it merges extractions: Rule.conflict_flag / conflict_note);
 *  - an interaction a source describes between two rules (Rule.interactions) that the
 *    evaluator could not resolve into a definite priority (Evaluation.conflict_flag).
 * A third kind — two sources disagreeing about one field, such as an effective date, before
 * any rule conflict is flagged — has no contract yet. It is shown only from the labeled
 * development fixture (ProposedDisagreement) and is requested from PLAT-06 / CORE-06.
 */
import type { Evaluation, Evidence, LookupOutcome, ProposedDisagreement, Rule, SourceDocument, Uncertainty } from '../api/types';
import { parseReason } from './labels';

export interface ClaimView {
  key: string;
  docId: string;
  /** Source record, when the response carried it. */
  source: Pick<SourceDocument, 'doc_id' | 'url' | 'authority' | 'source_type' | 'capture_status' | 'retrieved_at' | 'jurisdictions' | 'sha256'> | null;
  /** The rule record this claim comes from, when it is a rule. */
  rule: Rule | null;
  /** What this claim states for each field in dispute, as the record or fixture gives it. */
  stated: Array<{ field: string; value: string | null }>;
  /** The exact source text, with its offsets when recorded. */
  quote: { text: string; start: number | null; end: number | null } | null;
  /** Dated statuses carried with the claim (e.g. enacted on …). */
  statusDates: Array<{ status: string; on: string }>;
  /** This property's result under this claim's rule, when a lookup is in context. */
  evaluation: Evaluation | null;
}

export interface DisagreementView {
  id: string;
  basis: 'same_provision' | 'interaction' | 'proposed_fixture';
  /** Rule fields the two claims differ in. Empty when the dispute is about precedence. */
  fields: string[];
  claims: ClaimView[];
  affectedRuleIds: string[];
  /** Why it is unresolved, in the payload's own words. */
  reasons: string[];
  /** What would resolve it, in the payload's own words; empty when the payload gives none. */
  remedies: string[];
  /** For an interaction: what the source says about how the two rules relate. */
  relation: { kind: string; note: string; evidence: Evidence[] } | null;
}

/** Fields compared literally between two records of the same provision. */
const COMPARED: Array<{ field: keyof Rule; text: (rule: Rule) => string | null }> = [
  { field: 'requirement', text: (rule) => rule.requirement },
  { field: 'key_value', text: (rule) => rule.key_value ?? null },
  { field: 'effective_date', text: (rule) => rule.effective_date ?? null },
  { field: 'end_date', text: (rule) => rule.end_date ?? null },
  { field: 'lifecycle', text: (rule) => rule.lifecycle },
  { field: 'exemptions', text: (rule) => rule.exemptions ?? null },
  { field: 'coverage_conditions', text: (rule) => JSON.stringify(rule.coverage_conditions) },
  { field: 'exemption_conditions', text: (rule) => JSON.stringify(rule.exemption_conditions) },
];
/** Encoded expressions differ as structures; they are named but not printed as a "stated value". */
const STRUCTURAL = new Set(['coverage_conditions', 'exemption_conditions']);

const fold = (value: string) => value.trim().toLowerCase();
const provisionKey = (rule: Rule) => [fold(rule.jurisdiction), rule.category, fold(rule.citation), fold(rule.provision_key)].join('|');

function claimFromRule(rule: Rule, fields: string[], sources: SourceDocument[], evaluations: Evaluation[]): ClaimView {
  const anchor = rule.evidence.find((item) => item.quote === rule.quoted_span);
  const source = sources.find((item) => item.doc_id === rule.source_doc_id) ?? null;
  return {
    key: rule.team_rule_id,
    docId: rule.source_doc_id,
    source,
    rule,
    stated: fields.filter((field) => !STRUCTURAL.has(field)).map((field) => ({ field, value: COMPARED.find((item) => item.field === field)?.text(rule) ?? null })),
    quote: { text: rule.quoted_span, start: anchor?.start ?? null, end: anchor?.end ?? null },
    statusDates: [...(rule.status_events ?? []).map((event) => ({ status: event.status, on: event.on })), ...(rule.effective_date ? [{ status: 'takes effect', on: rule.effective_date }] : [])],
    evaluation: evaluations.find((evaluation) => evaluation.team_rule_id === rule.team_rule_id) ?? null,
  };
}

const differingFields = (first: Rule, second: Rule) => COMPARED.filter((item) => item.text(first) !== item.text(second)).map((item) => String(item.field));

function payloadWords(ruleIds: string[], rules: Rule[], evaluations: Evaluation[], uncertainty: Uncertainty[]): { reasons: string[]; remedies: string[] } {
  const reasons = new Set<string>();
  const remedies = new Set<string>();
  for (const rule of rules) if (ruleIds.includes(rule.team_rule_id) && rule.conflict_note) reasons.add(rule.conflict_note);
  for (const evaluation of evaluations) {
    if (!ruleIds.includes(evaluation.team_rule_id)) continue;
    for (const raw of evaluation.uncertainty_reasons ?? []) {
      const reason = parseReason(raw);
      if (reason.kind === 'conflicting_legal_evidence' || reason.kind === 'possible_interaction' || reason.kind === 'cyclic_interaction') reasons.add(reason.message);
    }
  }
  for (const item of uncertainty) {
    if (item.kind !== 'conflict' || !(item.rule_ids ?? []).some((id) => ruleIds.includes(id))) continue;
    reasons.add(item.message);
    if (item.remedy) remedies.add(item.remedy);
  }
  return { reasons: [...reasons], remedies: [...remedies] };
}

/** Conflicts the evaluator flagged in one lookup, each with the two records it is between. */
export function disagreementsFromLookup(outcome: LookupOutcome): DisagreementView[] {
  const { rules, evaluations, sources } = outcome.lookup;
  const uncertainty = outcome.assist?.question_plan.remaining_uncertainty ?? [];
  const flagged = new Set(evaluations.filter((evaluation) => evaluation.conflict_flag).map((evaluation) => evaluation.team_rule_id));
  const views: DisagreementView[] = [];
  const used = new Set<string>();

  // Two or more records of the same provision, flagged by the backend as different interpretations.
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    if (!rule.conflict_flag && !flagged.has(rule.team_rule_id)) continue;
    groups.set(provisionKey(rule), [...(groups.get(provisionKey(rule)) ?? []), rule]);
  }
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const first = members[0] as Rule;
    const fields = [...new Set(members.slice(1).flatMap((member) => differingFields(first, member)))];
    if (!fields.length) continue;
    const ids = members.map((rule) => rule.team_rule_id);
    ids.forEach((id) => used.add(id));
    views.push({ id: `provision:${key}`, basis: 'same_provision', fields, claims: members.map((rule) => claimFromRule(rule, fields, sources, evaluations)), affectedRuleIds: ids, ...payloadWords(ids, rules, evaluations, uncertainty), relation: null });
  }

  // A stated relationship between two rules that the evaluator left as a conflict.
  for (const rule of rules) {
    for (const interaction of rule.interactions ?? []) {
      const target = rules.find(
        (candidate) => candidate.team_rule_id !== rule.team_rule_id && fold(candidate.citation) === fold(interaction.target_citation) && fold(candidate.jurisdiction) === fold(interaction.target_jurisdiction) && candidate.category === interaction.category,
      );
      if (!target || !(flagged.has(rule.team_rule_id) || flagged.has(target.team_rule_id))) continue;
      const fields = differingFields(rule, target).filter((field) => field === 'requirement' || field === 'key_value');
      const ids = [rule.team_rule_id, target.team_rule_id];
      ids.forEach((id) => used.add(id));
      views.push({
        id: `interaction:${rule.team_rule_id}:${target.team_rule_id}`,
        basis: 'interaction',
        fields,
        claims: [claimFromRule(rule, fields, sources, evaluations), claimFromRule(target, fields, sources, evaluations)],
        affectedRuleIds: ids,
        ...payloadWords(ids, rules, evaluations, uncertainty),
        relation: { kind: interaction.kind, note: interaction.note, evidence: interaction.evidence },
      });
    }
  }

  // A flagged rule whose counterpart is not in this response is still shown, alone.
  for (const rule of rules) {
    if (!flagged.has(rule.team_rule_id) || used.has(rule.team_rule_id)) continue;
    views.push({ id: `single:${rule.team_rule_id}`, basis: 'same_provision', fields: [], claims: [claimFromRule(rule, [], sources, evaluations)], affectedRuleIds: [rule.team_rule_id], ...payloadWords([rule.team_rule_id], rules, evaluations, uncertainty), relation: null });
  }
  return views;
}

/** The labeled development fixture, in the same view. Source records are attached when read. */
export function disagreementFromProposed(entry: ProposedDisagreement, sources: ReadonlyMap<string, SourceDocument>): DisagreementView {
  return {
    id: entry.disagreement_id,
    basis: 'proposed_fixture',
    fields: [entry.field],
    claims: entry.claims.map((claim) => ({
      key: claim.claim_id,
      docId: claim.span.doc_id,
      source: sources.get(claim.span.doc_id) ?? null,
      rule: null,
      stated: [{ field: entry.field, value: claim.stated_value }],
      quote: { text: claim.span.text, start: claim.span.start, end: claim.span.end },
      statusDates: claim.status_dates,
      evaluation: null,
    })),
    affectedRuleIds: entry.affected_rule_ids,
    reasons: [entry.unresolved_reason],
    remedies: [entry.remedy],
    relation: null,
  };
}
