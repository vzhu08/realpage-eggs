/**
 * The demo replays recorded evaluator output and nothing else. These tests pin that down:
 * an answer changes the result only when the fixture holds the evaluator's output for it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Answer } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { ASSIST_EXAMPLE, RESEARCH_FIXTURES } from '../../src/demo/fixtures';
import { intervalContains, readInterval, recordedValues, replayAssist } from '../../src/demo/replay';

const fixture = (name: string) => {
  const found = RESEARCH_FIXTURES.find((candidate) => candidate.case === name);
  assert.ok(found, name);
  return found.response;
};
const answer = (field: string, value: Answer['value'], provenance: Answer['provenance'] = 'user_provided'): Answer => ({ field, value, provenance });

test('no answers returns the fixture baseline untouched', () => {
  const decisive = fixture('decisive_question');
  const replay = replayAssist(decisive, []);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'unknown');
  assert.equal(replay.assist.question_plan.questions.length, 1);
  assert.deepEqual(replay.dispositions, []);
  assert.equal(replay.replayed, undefined);
});

test('a decisive recorded answer replays the evaluator output for that probe', () => {
  const decisive = fixture('decisive_question');
  const recorded = decisive.question_plan.questions[0]!.alternatives.find((alternative) => alternative.probe_facts.units === 8)!;
  const replay = replayAssist(decisive, [answer('units', 8, 'demo')]);
  assert.deepEqual(replay.assist.lookup.evaluations, recorded.evaluations);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'applies');
  assert.equal(replay.assist.question_plan.questions.length, 0);
  assert.deepEqual(replay.assist.answers_applied.map((item) => [item.field, item.value, item.provenance]), [['units', 8, 'demo']]);
  assert.equal(replay.dispositions[0]?.status, 'applied');
  assert.equal(replay.replayed?.alternativeId, recorded.alternative_id);
  assert.deepEqual(validate('AssistResponse', replay.assist).errors, []);
});

test('a recorded answer that takes the rule out of coverage empties the list but keeps the evaluator record', () => {
  const replay = replayAssist(fixture('decisive_question'), [answer('units', 7)]);
  assert.deepEqual(replay.assist.lookup.evaluations, []);
  assert.deepEqual(replay.assist.lookup.rules, []);
  assert.equal(replay.replayed?.evaluations[0]?.result, 'inapplicable');
});

test('a value with no recorded evaluator output is not evaluated and changes nothing', () => {
  const decisive = fixture('decisive_question');
  const replay = replayAssist(decisive, [answer('units', 12)]);
  assert.deepEqual(replay.assist.lookup, decisive.lookup);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
  assert.match(replay.dispositions[0]?.note ?? '', /Recorded values: 7, 8/);
  assert.deepEqual(replay.assist.answers_applied, []);
  assert.equal(replay.replayed, undefined);
});

test('numeric strings are not coerced into a recorded numeric probe', () => {
  const replay = replayAssist(fixture('decisive_question'), [answer('units', '8')]);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
});

test('an explicit unknown is recorded and leaves the result unknown', () => {
  const decisive = fixture('decisive_question');
  const replay = replayAssist(decisive, [answer('units', null)]);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'unknown');
  assert.deepEqual(replay.assist.answers_applied.map((item) => [item.field, item.value]), [['units', null]]);
  assert.equal(replay.dispositions[0]?.status, 'applied');
});

test('two unresolved exemptions: answering the ranked question still leaves the rule unknown', () => {
  const replay = replayAssist(fixture('two_unresolved_exemptions'), [answer('certificate_of_occupancy', '2020-06-30')]);
  const evaluation = replay.assist.lookup.evaluations[0];
  assert.equal(evaluation?.result, 'unknown');
  assert.deepEqual(evaluation?.missing_facts, ['exemption_filed', 'owner_occupied']);
  assert.deepEqual(replay.assist.question_plan.remaining_uncertainty.map((item) => item.field), ['exemption_filed', 'owner_occupied']);
  assert.equal(replay.assist.question_plan.questions.length, 0);
});

test('partial dates are matched exactly; precision is never padded to find a recording', () => {
  const replay = replayAssist(fixture('two_unresolved_exemptions'), [answer('certificate_of_occupancy', '2020-06')]);
  assert.equal(replay.dispositions[0]?.status, 'not_evaluated');
});

test('replaying never mutates the checked-in fixture', () => {
  for (const item of [...RESEARCH_FIXTURES, ASSIST_EXAMPLE]) {
    const before = JSON.stringify(item);
    replayAssist(item.response, [answer('units', 8), answer('owner_occupied', null)]);
    replayAssist(item.response, [answer('units', 7)]);
    assert.equal(JSON.stringify(item), before, item.case);
  }
});

test('recordedValues lists exactly the probes the fixture holds', () => {
  assert.deepEqual(recordedValues(fixture('decisive_question'), 'units'), [7, 8]);
  assert.deepEqual(recordedValues(fixture('bounded_partial_analysis'), 'units'), [7]);
  assert.deepEqual(recordedValues(fixture('unresolved_source_coverage'), 'units'), []);
});

// ------------------------------------------------------------------ the implemented API's own example
test('the API example partitions units into intervals with inclusive bounds', () => {
  const alternatives = ASSIST_EXAMPLE.response.question_plan.questions[0]!.alternatives;
  const intervals = alternatives.map((alternative) => readInterval(alternative));
  assert.deepEqual(
    intervals.map((interval) => [interval?.lower, interval?.upper, interval?.lowerInclusive, interval?.upperInclusive]),
    [
      [1, 7, true, true],
      [8, 8, true, true],
      [9, null, true, false],
    ],
  );
  assert.ok(intervalContains(intervals[0]!, 7));
  assert.ok(!intervalContains(intervals[0]!, 8));
  assert.ok(!intervalContains(intervals[0]!, 0));
  assert.ok(intervalContains(intervals[2]!, 400));
  assert.ok(!intervalContains({ lower: 1, upper: 7, lowerInclusive: false, upperInclusive: false }, 1));
  assert.ok(!intervalContains({ lower: 1, upper: 7, lowerInclusive: false, upperInclusive: false }, 7));
});

test('an answer inside a declared interval replays that interval\'s recorded outcome and says so', () => {
  const replay = replayAssist(ASSIST_EXAMPLE.response, [answer('units', 12)]);
  assert.equal(replay.assist.lookup.evaluations[0]?.result, 'applies');
  assert.equal(replay.replayed?.label, 'If units is in [9, unbounded)');
  assert.match(replay.dispositions[0]?.note ?? '', /interval that contains this answer.*probe value 9/);
  assert.deepEqual(validate('AssistResponse', replay.assist).errors, []);
  // The answered fact is no longer listed as uncertain, and nothing is listed twice.
  const remaining = replay.assist.question_plan.remaining_uncertainty;
  assert.ok(!remaining.some((item) => item.kind === 'property_fact' && item.field === 'units'));
  assert.equal(new Set(remaining.map((item) => `${item.kind}|${item.message}`)).size, remaining.length);
  assert.ok(remaining.some((item) => item.kind === 'source_gap'));
});

test('interval replay respects the lower partition and exact probes', () => {
  const below = replayAssist(ASSIST_EXAMPLE.response, [answer('units', 5)]);
  assert.deepEqual(below.assist.lookup.evaluations, []);
  assert.equal(below.replayed?.evaluations[0]?.result, 'inapplicable');
  const exact = replayAssist(ASSIST_EXAMPLE.response, [answer('units', 8)]);
  assert.match(exact.dispositions[0]?.note ?? '', /^Replayed the recorded evaluator output for/);
  const outside = replayAssist(ASSIST_EXAMPLE.response, [answer('units', 0)]);
  assert.equal(outside.dispositions[0]?.status, 'not_evaluated');
  const wrongType = replayAssist(ASSIST_EXAMPLE.response, [answer('units', '12')]);
  assert.equal(wrongType.dispositions[0]?.status, 'not_evaluated');
});
