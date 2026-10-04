/** Lossless decoding with immutable shared subtrees. Nothing is projected away. */
export const ASSIST_MEDIA = 'application/vnd.realpage.assist-dag+json';

export function decodeAssistWire(input: unknown): unknown {
  if (!input || typeof input !== 'object') throw new Error('Missing assist envelope');
  const envelope = input as { format?: unknown; nodes?: unknown; root?: unknown };
  if (envelope.format !== 'realpage-assist-dag-v1' || !Array.isArray(envelope.nodes) || envelope.nodes.length > 1_000_000) throw new Error('Invalid assist envelope');
  const decoded: unknown[] = [];
  const ref = (id: unknown): unknown => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= decoded.length) throw new Error('Invalid forward/cyclic assist reference');
    return decoded[id];
  };
  for (const node of envelope.nodes) {
    if (node === null || typeof node === 'string' || typeof node === 'boolean' || (typeof node === 'number' && Number.isFinite(node))) {
      decoded.push(node);
    } else if (node && typeof node === 'object' && !Array.isArray(node)) {
      const row = node as { a?: unknown; o?: unknown };
      if (Object.keys(row).length !== 1) throw new Error('Invalid assist node');
      if (Array.isArray(row.a)) decoded.push(Object.freeze(row.a.map(ref)));
      else if (Array.isArray(row.o)) {
        const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        for (const pair of row.o) {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || Object.hasOwn(result, pair[0])) throw new Error('Invalid assist object');
          result[pair[0]] = ref(pair[1]);
        }
        decoded.push(Object.freeze(result));
      } else throw new Error('Invalid assist node');
    } else throw new Error('Invalid assist scalar');
  }
  return ref(envelope.root);
}

export function metric(name: string, start: number, detail: Record<string, unknown> = {}) {
  if (typeof performance === 'undefined') return;
  const fullName = `realpage:${name}`;
  // Each name keeps only the current observation; rehearsal captures after each click.
  performance.clearMeasures(fullName);
  performance.measure(fullName, { start, end: performance.now(), detail });
}
