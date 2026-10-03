/**
 * The demo replays recorded evaluator output and nothing else. These tests pin that down:
 * an answer changes the result only when the fixture holds the evaluator's output for it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Answer } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { RESEARCH_FIXTURES, type ResearchFixture } from '../../src/demo/fixtures';
import { recordedValues, replayFixture } from '../../src/demo/replay';

const fixture = (name: string): ResearchFixture => {
  const found = RESEARCH_FIXTURES.find((candidate) => candidate.case === name);
  assert.ok(found, name);
  return found;
};
const answer = (field: string, value: Answer['value'], provenance: Answer['provenance'] = 'user_provided'): Answer => ({ field, value, provenance });

test('no answers returns the fixture baseline untouched', () => {
  const decisive = fixture('decisive_question');
  const replay = replayFixture(decisive, []);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'unknown');
  assert.equal(replay.assist.question_plan.questions.length, 1);
  assert.deepEqual(replay.dispositions, []);
  assert.equal(replay.replayed, undefined);
});

test('a decisive recorded answer replays the evaluator output for that probe', () => {
  const decisive = fixture('decisive_question');
  const recorded = decisive.response.question_plan.questions[0]!.alternatives.find((alternative) => alternative.probe_facts.units === 8)!;
  const replay = replayFixture(decisive, [answer('units', 8, 'demo')]);
  assert.deepEqual(replay.assist.lookup.evaluations, recorded.evaluations);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'applies');
  assert.equal(replay.assist.question_plan.questions.length, 0);
  assert.deepEqual(replay.assist.answers_applied.map((item) => [item.field, item.value, item.provenance]), [['units', 8, 'demo']]);
  assert.equal(replay.dispositions[0]?.status, 'applied');
  assert.equal(replay.replayed?.alternativeId, recorded.alternative_id);
  assert.deepEqual(validate('AssistResponse', replay.assist).errors, []);
});

test('a recorded answer that takes the rule out of coverage empties the list but keeps the evaluator record', () => {
  const replay = replayFixture(fixture('decisive_question'), [answer('units', 7)]);
  assert.deepEqual(replay.assist.lookup.evaluations, []);
  assert.deepEqual(replay.assist.lookup.rules, []);
  assert.equal(replay.replayed?.evaluations[0]?.result, 'inapplicable');
});

test('a value with no recorded evaluator output is not evaluated and changes nothing', () => {
  const decisive = fixture('decisive_question');
  const replay = replayFixture(decisive, [answer('units', 12)]);
  assert.deepEqual(replay.assist.lookup, decisive.response.lookup);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
  assert.match(replay.dispositions[0]?.note ?? '', /Recorded values: 7, 8/);
  assert.deepEqual(replay.assist.answers_applied, []);
  assert.equal(replay.replayed, undefined);
});

test('numeric strings are not coerced into a recorded numeric probe', () => {
  const replay = replayFixture(fixture('decisive_question'), [answer('units', '8')]);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
});

test('an explicit unknown is recorded and leaves the result unknown', () => {
  const decisive = fixture('decisive_question');
  const replay = replayFixture(decisive, [answer('units', null)]);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'unknown');
  assert.deepEqual(replay.assist.answers_applied.map((item) => [item.field, item.value]), [['units', null]]);
  assert.equal(replay.dispositions[0]?.status, 'applied');
});

test('two unresolved exemptions: answering the ranked question still leaves the rule unknown', () => {
  const replay = replayFixture(fixture('two_unresolved_exemptions'), [answer('certificate_of_occupancy', '2020-06-30')]);
  const evaluation = replay.assist.lookup.evaluations[0];
  assert.equal(evaluation?.result, 'unknown');
  assert.deepEqual(evaluation?.missing_facts, ['exemption_filed', 'owner_occupied']);
  assert.deepEqual(replay.assist.question_plan.remaining_uncertainty.map((item) => item.field), ['exemption_filed', 'owner_occupied']);
  assert.equal(replay.assist.question_plan.questions.length, 0);
});

test('partial dates are matched exactly; precision is never padded to find a recording', () => {
  const replay = replayFixture(fixture('two_unresolved_exemptions'), [answer('certificate_of_occupancy', '2020-06')]);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
});

test('replaying never mutates the checked-in fixture', () => {
  for (const item of RESEARCH_FIXTURES) {
    const before = JSON.stringify(item);
    replayFixture(item, [answer('units', 8), answer('owner_occupied', null)]);
    replayFixture(item, [answer('units', 7)]);
    assert.equal(JSON.stringify(item), before, item.case);
  }
});

test('recordedValues lists exactly the probes the fixture holds', () => {
  assert.deepEqual(recordedValues(fixture('decisive_question'), 'units'), [7, 8]);
  assert.deepEqual(recordedValues(fixture('bounded_partial_analysis'), 'units'), [7]);
  assert.deepEqual(recordedValues(fixture('unresolved_source_coverage'), 'units'), []);
});
