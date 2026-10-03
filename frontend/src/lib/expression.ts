/**
 * Structural display of the encoded rule expression (the canonical AST from the contract).
 * This prints the operators, facts and values exactly as encoded. It is not the Core
 * renderer's English rendering and it never evaluates anything.
 */
import type { Expression, Rule } from '../api/types';
import { formatValue, humanize } from './labels';

const SYMBOLS: Record<string, string> = { eq: '=', ne: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥' };

export interface ExpressionNode {
  /** JSON-pointer-style path without the leading slash, matching predicate IDs in the assist contract. */
  path: string;
  kind: 'group' | 'comparison' | 'literal' | 'unsupported';
  op: string;
  /** Heading for a group ("All of", "Any of", "Not"), or the full text for a leaf. */
  text: string;
  fact?: string;
  children: ExpressionNode[];
}

export function describeExpression(expression: Expression, path: string): ExpressionNode {
  const args = expression.args ?? [];
  const children = args.map((child, index) => describeExpression(child, `${path}/args/${index}`));
  switch (expression.op) {
    case 'all':
      return { path, kind: 'group', op: 'all', text: 'All of', children };
    case 'any':
      return { path, kind: 'group', op: 'any', text: 'Any of', children };
    case 'not':
      return { path, kind: 'group', op: 'not', text: 'Not', children };
    case 'literal':
      return { path, kind: 'literal', op: 'literal', text: expression.value === true ? 'Always true' : 'Always false', children: [] };
    case 'unsupported':
      return { path, kind: 'unsupported', op: 'unsupported', text: `Not encodable: ${expression.reason ?? 'no reason recorded'}`, children: [] };
    default: {
      const fact = expression.fact ?? '';
      const name = humanize(fact);
      const value = formatValue(expression.value);
      const text =
        expression.op in SYMBOLS
          ? `${name} ${SYMBOLS[expression.op]} ${value}`
          : expression.op === 'in'
            ? `${name} is one of: ${value}`
            : expression.op === 'date_before'
              ? `${name} is before ${value}`
              : expression.op === 'date_on_or_before'
                ? `${name} is on or before ${value}`
                : expression.op === 'age_at_least'
                  ? `${name} is at least ${value} years before the query date`
                  : `${name} ${expression.op} ${value}`;
      return { path, kind: 'comparison', op: expression.op, text, fact, children: [] };
    }
  }
}

export const isLiteralFalse = (expression: Expression | undefined): boolean => !expression || (expression.op === 'literal' && expression.value === false);

/** Every comparison on `field` in a rule's coverage and exemption expressions. */
function comparisonsOn(expression: Expression | undefined, field: string, out: Expression[] = []): Expression[] {
  if (!expression) return out;
  if (expression.fact === field) out.push(expression);
  for (const child of expression.args ?? []) comparisonsOn(child, field, out);
  return out;
}

export type AnswerForm =
  | { type: 'boolean' }
  | { type: 'integer'; minimum?: number }
  | { type: 'number'; minimum?: number }
  | { type: 'date'; allowPartial: boolean }
  | { type: 'enum'; options: string[] }
  | { type: 'string' };

/**
 * When the backend supplies no fact definition (the fact registry endpoint is planned, not
 * implemented), pick an input control from how the rules compare the fact. This chooses a
 * form control only; validation of the value remains the service's job.
 */
export function inferAnswerForm(field: string, rules: Rule[]): AnswerForm {
  const comparisons = rules.flatMap((rule) => [...comparisonsOn(rule.coverage_conditions, field), ...comparisonsOn(rule.exemption_conditions, field)]);
  for (const comparison of comparisons) {
    if (comparison.op === 'date_before' || comparison.op === 'date_on_or_before' || comparison.op === 'age_at_least') return { type: 'date', allowPartial: true };
    if (typeof comparison.value === 'boolean') return { type: 'boolean' };
    if (typeof comparison.value === 'number') return Number.isInteger(comparison.value) ? { type: 'integer' } : { type: 'number' };
    if (comparison.op === 'in' && Array.isArray(comparison.value) && comparison.value.every((item) => typeof item === 'string')) {
      return { type: 'enum', options: comparison.value as string[] };
    }
  }
  return { type: 'string' };
}
