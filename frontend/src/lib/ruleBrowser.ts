import type { Evaluation, Rule } from '../api/types';
import { categoryLabel } from './labels';

/** Search the returned records only. Filtering never re-evaluates their coverage. */
export function filterRuleEvaluations(evaluations: Evaluation[], rules: Rule[], query = '', category = ''): Evaluation[] {
  const byId = new Map(rules.map(rule => [rule.team_rule_id, rule]));
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return evaluations.filter(evaluation => {
    const rule = byId.get(evaluation.team_rule_id);
    if (category && rule?.category !== category) return false;
    if (!terms.length) return true;
    const searchable = [evaluation.team_rule_id, rule?.title, rule?.requirement, rule?.key_value,
      rule?.jurisdiction, rule?.citation, rule?.source_doc_id, rule ? categoryLabel(rule.category) : '',
      ...evaluation.evidence.map(span => span.doc_id)].filter(Boolean).join(' ').toLocaleLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}
