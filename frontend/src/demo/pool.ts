/**
 * Recorded responses repeat the same rules, evidence and traces many times, so the recording
 * script stores each repeated subtree once (frontend/scripts/record_demo.py, `intern`).
 * This restores the exact original responses. Every expansion builds fresh objects, so
 * nothing is shared between two responses.
 */
export interface Pooled {
  pool: unknown[];
  data: unknown;
}

export function expandPooled<T>(recorded: Pooled): T {
  const expand = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(expand);
    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.length === 1 && entries[0]![0] === '$pool') {
        const index = entries[0]![1];
        if (typeof index !== 'number' || index < 0 || index >= recorded.pool.length) throw new Error(`Recorded fixture refers to a missing pooled entry (${String(index)}). Re-run frontend/scripts/record_demo.py.`);
        return expand(recorded.pool[index]);
      }
      return Object.fromEntries(entries.map(([key, value]) => [key, expand(value)]));
    }
    return node;
  };
  return expand(recorded.data) as T;
}
