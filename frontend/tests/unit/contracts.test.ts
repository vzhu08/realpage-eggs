/**
 * Contract checks: every payload the app can show in demo mode must match the schemas
 * generated from contracts/, and the generated files must be current.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validate } from '../../src/api/validate';
import { ASSIST_EXAMPLE, ERROR_EXAMPLES, EVIDENCE_FIXTURES, LOOKUP_EXAMPLES, RECORDED_ASSISTS, RECORDED_CHANGES, RECORDED_RULES, RECORDED_SOURCES, RESEARCH_FIXTURES, SOURCE_COMPARISON } from '../../src/demo/fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('generated types, schemas and meta are in sync with contracts/', () => {
  const script = fileURLToPath(new URL('../../scripts/generate-contract-types.mjs', import.meta.url));
  const output = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.match(output, /match contracts\//);
});

test('the three ordinary lookup examples match LookupResponse', () => {
  assert.equal(LOOKUP_EXAMPLES.length, 3);
  for (const example of LOOKUP_EXAMPLES) {
    const result = validate('LookupResponse', example.response);
    assert.deepEqual(result, { errors: [], warnings: [] }, example.path);
    assert.equal(example.fixture_mode, 'synthetic');
  }
});

test('all five research fixtures match AssistResponse and are labeled as proposed', () => {
  assert.deepEqual(
    RESEARCH_FIXTURES.map((fixture) => fixture.case),
    ['decisive_question', 'irrelevant_missing_fact', 'two_unresolved_exemptions', 'unresolved_source_coverage', 'bounded_partial_analysis'],
  );
  for (const fixture of RESEARCH_FIXTURES) {
    assert.deepEqual(validate('AssistResponse', fixture.response), { errors: [], warnings: [] }, fixture.path);
    assert.equal(fixture.fixture_mode, 'synthetic');
    assert.equal(fixture.contract_status, 'proposed_core_output_not_live_service');
    assert.equal(fixture.response.mode, 'contract_fixture');
  }
});

test('the implemented-API examples match their models: assist response, evidence failure, source comparison', () => {
  assert.deepEqual(validate('AssistResponse', ASSIST_EXAMPLE.response), { errors: [], warnings: [] });
  assert.equal(ASSIST_EXAMPLE.contract_status, 'implemented_platform_api');
  assert.deepEqual(ASSIST_EXAMPLE.request, { address_id: 'SYNTH-003', as_of: '2026-11-15' });
  assert.equal(EVIDENCE_FIXTURES.length, 1);
  for (const fixture of EVIDENCE_FIXTURES) {
    assert.deepEqual(validate('AssistResponse', fixture.response), { errors: [], warnings: [] }, fixture.path);
    assert.equal(fixture.fixture_mode, 'synthetic');
  }
  assert.deepEqual(validate('Rule', SOURCE_COMPARISON.rule).errors, []);
  assert.deepEqual(validate('EvidenceReport', SOURCE_COMPARISON.evidence).errors, []);
  assert.deepEqual(validate('EncodedRuleRendering', SOURCE_COMPARISON.encoded_rule).errors, []);
  // The evidence report keeps its checks separate: several kinds, never one score.
  const kinds = new Set(SOURCE_COMPARISON.evidence.checks.map((check) => check.kind));
  assert.deepEqual([...kinds].sort(), ['citation_anchor', 'dependencies', 'quote_presence', 'semantic_support', 'source_availability', 'source_identity']);
});

test('every recorded replay payload matches its contract model', () => {
  assert.ok(RECORDED_ASSISTS.length >= 12);
  for (const entry of RECORDED_ASSISTS) {
    assert.deepEqual(validate('AssistResponse', entry.response), { errors: [], warnings: [] }, JSON.stringify(entry.request));
    assert.equal(entry.response.mode, 'synthetic');
  }
  for (const [id, detail] of Object.entries(RECORDED_RULES)) assert.deepEqual(validate('RuleDetail', detail).errors, [], id);
  for (const [id, source] of Object.entries(RECORDED_SOURCES)) assert.deepEqual(validate('SourceDocument', source).errors, [], id);
  for (const entry of RECORDED_CHANGES) {
    assert.deepEqual(validate('ChangeResult', entry.response).errors, [], JSON.stringify(entry.request));
    assert.deepEqual(validate('ChangeRequest', entry.request).errors, [], JSON.stringify(entry.request));
  }
});

test('recorded published scenarios are blocked, never an empty success', () => {
  const scenarios = RECORDED_CHANGES.filter((entry) => entry.request.test_id);
  assert.deepEqual(scenarios.map((entry) => entry.request.test_id), ['T1', 'T2', 'T3', 'T4', 'T5']);
  for (const entry of scenarios) {
    assert.equal(entry.store, 'no_extracted_rules');
    assert.equal(entry.response.status, 'blocked');
  }
  assert.equal(scenarios.find((entry) => entry.request.test_id === 'T4')?.response.scenario, 'if_enacted');
});

test('a missing required field is a contract error', () => {
  const broken = clone(LOOKUP_EXAMPLES[0]!.response) as unknown as Record<string, unknown>;
  delete broken.disclaimer;
  const result = validate('LookupResponse', broken);
  assert.ok(result.errors.some((error) => error.includes('disclaimer')));
});

test('a value outside an enum is a contract error', () => {
  const broken = clone(LOOKUP_EXAMPLES[0]!.response);
  (broken.evaluations[0] as unknown as { result: string }).result = 'violation';
  const result = validate('LookupResponse', broken);
  assert.ok(result.errors.some((error) => error.includes('violation')));
});

test('a wrong type deep inside a payload is located by path', () => {
  const broken = clone(RESEARCH_FIXTURES[0]!.response);
  (broken.question_plan.questions[0] as unknown as { rank_score: unknown }).rank_score = 'high';
  const result = validate('AssistResponse', broken);
  assert.ok(result.errors.some((error) => error.includes('question_plan.questions[0].rank_score')), result.errors.join('\n'));
});

test('an unknown extra field is visible drift, not a failure', () => {
  const drifted = { ...clone(LOOKUP_EXAMPLES[0]!.response), confidence: 0.99 };
  const result = validate('LookupResponse', drifted);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['LookupResponse.confidence: field is not in the contract']);
});

test('the checked-in error examples have the documented shapes', () => {
  assert.equal(ERROR_EXAMPLES.unknown_address.detail.code, 'unknown_id');
  assert.ok(Array.isArray(ERROR_EXAMPLES.invalid_input.detail));
});
