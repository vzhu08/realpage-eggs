/** ChangeResult.differences is an open object in the contract; read it defensively. */
import type { ChangeResult, Evaluation } from '../api/types';
import { validate } from '../api/validate';

export interface RuleDelta {
  ruleId: string;
  certainty: 'definite' | 'uncertain' | string;
  before: Evaluation | null;
  after: Evaluation | null;
}

export interface AddressDiff {
  addressId: string;
  deltas: RuleDelta[];
  /** Entries that did not have the documented shape; shown raw rather than dropped. */
  unreadable: unknown[];
}

const asEvaluation = (value: unknown): Evaluation | null => (value && typeof value === 'object' && validate('Evaluation', value).errors.length === 0 ? (value as Evaluation) : null);

export function readDifferences(result: ChangeResult): AddressDiff[] {
  return Object.entries(result.differences ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([addressId, raw]) => {
      const deltas: RuleDelta[] = [];
      const unreadable: unknown[] = [];
      for (const entry of Array.isArray(raw) ? raw : [raw]) {
        const item = entry as { team_rule_id?: unknown; certainty?: unknown; before?: unknown; after?: unknown } | null;
        const after = asEvaluation(item?.after);
        if (!item || typeof item.team_rule_id !== 'string' || typeof item.certainty !== 'string' || !after) {
          unreadable.push(entry);
          continue;
        }
        deltas.push({ ruleId: item.team_rule_id, certainty: item.certainty, before: asEvaluation(item.before), after });
      }
      return { addressId, deltas, unreadable };
    });
}
