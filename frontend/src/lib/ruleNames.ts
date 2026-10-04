/**
 * Display names for rules. Two records of one provision carry the same title (that is what a
 * source disagreement looks like), so a title that occurs more than once is followed by the
 * document each record was encoded from. Nothing else is added.
 */
import type { Rule } from '../api/types';

export function ruleDisplayNames(rules: Iterable<Rule>): Map<string, string> {
  const list = [...rules];
  const counts = new Map<string, number>();
  for (const rule of list) counts.set(rule.title, (counts.get(rule.title) ?? 0) + 1);
  return new Map(list.map((rule) => [rule.team_rule_id, (counts.get(rule.title) ?? 0) > 1 ? `${rule.title} · ${rule.source_doc_id}` : rule.title]));
}
