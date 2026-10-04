import assert from 'node:assert/strict';
import test from 'node:test';
import type { SourceSpan, Uncertainty } from '../../src/api/types';
import { groupUncertainty } from '../../src/lib/uncertainty';

test('grouped uncertainty preserves source versions and distinct quotes at identical offsets', () => {
  const original: SourceSpan = { doc_id: 'versioned-source', source_hash: 'a'.repeat(64), start: 0, end: 4, text: 'old!' };
  const revised = { ...original, source_hash: 'b'.repeat(64), text: 'new!' };
  const anotherQuote = { ...original, text: 'else' };
  const anotherSection = { ...original, section: 'Section 2' };
  const item = (rule: string, source: SourceSpan): Uncertainty => ({
    kind: 'conflict', message: 'Authority remains in conflict', remedy: 'Review authority',
    rule_ids: [rule], predicate_ids: [], field: null, source_refs: [source],
  });
  const [group] = groupUncertainty([
    item('r1', original), item('r2', revised), item('r3', anotherQuote),
    item('r4', anotherSection), item('r5', { ...original, section: null }),
  ]);
  assert.deepEqual(group!.sourceRefs, [original, revised, anotherQuote, anotherSection]);
  assert.deepEqual(group!.ruleIds, ['r1', 'r2', 'r3', 'r4', 'r5']);
});
