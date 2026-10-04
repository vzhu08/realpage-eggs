/** Lossless decoding with immutable shared subtrees. Nothing is projected away. */
export const ASSIST_MEDIA = 'application/vnd.realpage.assist-dag+json';
const retainedBytes = new WeakMap<object, number>();
/** Conservative graph accounting, not a browser-specific heap/RSS guarantee. */
export const assistRetainedBytes = (value: unknown) => value && typeof value === 'object' ? retainedBytes.get(value) ?? Infinity : Infinity;

export function decodeAssistWire(input: unknown): unknown {
  if (!input || typeof input !== 'object') throw new Error('Missing assist envelope');
  const envelope = input as { format?: unknown; nodes?: unknown; root?: unknown };
  if (envelope.format !== 'realpage-assist-dag-v1' || !Array.isArray(envelope.nodes) || envelope.nodes.length > 1_000_000) throw new Error('Invalid assist envelope');
  const decoded: unknown[] = [];
  let bytes = 0;
  const ref = (id: unknown): unknown => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= decoded.length) throw new Error('Invalid forward/cyclic assist reference');
    return decoded[id];
  };
  for (const node of envelope.nodes) {
    if (node === null || typeof node === 'string' || typeof node === 'boolean' || (typeof node === 'number' && Number.isFinite(node))) {
      decoded.push(node);
      bytes += typeof node === 'string' ? 64 + node.length * 2 : 16;
    } else if (node && typeof node === 'object' && !Array.isArray(node)) {
      const row = node as { a?: unknown; o?: unknown };
      if (Object.keys(row).length !== 1) throw new Error('Invalid assist node');
      if (Array.isArray(row.a)) {
        bytes += 160 + row.a.length * 32;
        decoded.push(Object.freeze(row.a.map(ref)));
      }
      else if (Array.isArray(row.o)) {
        bytes += 160;
        const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        for (const pair of row.o) {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || Object.hasOwn(result, pair[0])) throw new Error('Invalid assist object');
          result[pair[0]] = ref(pair[1]);
          bytes += 64 + pair[0].length * 2;
        }
        decoded.push(Object.freeze(result));
      } else throw new Error('Invalid assist node');
    } else throw new Error('Invalid assist scalar');
  }
  const root = ref(envelope.root);
  if (root && typeof root === 'object') retainedBytes.set(root, bytes);
  return root;
}

export function metric(name: string, start: number, detail: Record<string, unknown> = {}) {
  if (typeof performance === 'undefined') return;
  const fullName = `realpage:${name}`;
  // Each name keeps only the current observation; rehearsal captures after each click.
  performance.clearMeasures(fullName);
  performance.measure(fullName, { start, end: performance.now(), detail });
}
