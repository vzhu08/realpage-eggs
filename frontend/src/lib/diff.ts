/**
 * Compares two results for the same property and date so a re-evaluation can show exactly
 * what moved. It reads evaluator output only; it draws no conclusions of its own.
 */
import type { Evaluation, LookupOutcome } from '../api/types';
import { ruleDisplayNames } from './ruleNames';

export interface RuleChange {
  ruleId: string;
  title: string;
  before: Evaluation | null;
  after: Evaluation | null;
  /** For a rule that left the list: the evaluator's own recorded evaluation, when the source has one. */
  recordedAfter: Evaluation | null;
  kind: 'changed' | 'unchanged' | 'no_longer_listed' | 'newly_listed';
}

const fingerprint = (evaluation: Evaluation) =>
  JSON.stringify([evaluation.result, evaluation.temporal_status, [...(evaluation.missing_facts ?? [])].sort(), [...(evaluation.uncertainty_reasons ?? [])].sort(), evaluation.conflict_flag ?? false]);

export function diffOutcomes(previous: LookupOutcome, next: LookupOutcome): RuleChange[] {
  const all = new Map([...previous.lookup.rules, ...next.lookup.rules].map((rule) => [rule.team_rule_id, rule]));
  const titles = ruleDisplayNames(all.values());
  const before = new Map(previous.lookup.evaluations.map((evaluation) => [evaluation.team_rule_id, evaluation]));
  const after = new Map(next.lookup.evaluations.map((evaluation) => [evaluation.team_rule_id, evaluation]));
  const recorded = new Map((next.replayed?.evaluations ?? []).map((evaluation) => [evaluation.team_rule_id, evaluation]));
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.map((ruleId) => {
    const was = before.get(ruleId) ?? null;
    const now = after.get(ruleId) ?? null;
    const kind: RuleChange['kind'] = was && now ? (fingerprint(was) === fingerprint(now) ? 'unchanged' : 'changed') : was ? 'no_longer_listed' : 'newly_listed';
    return { ruleId, title: titles.get(ruleId) ?? ruleId, before: was, after: now, recordedAfter: now ? null : (recorded.get(ruleId) ?? null), kind };
  });
}
