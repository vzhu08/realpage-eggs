import { expect, test } from '@playwright/test';
import { RULE_ID, RULE_TITLE, addressPage, baseHandlers, clone, examples, expectNoHorizontalOverflow, health, mockApi, openEvidence, openLive, openPropertyRecord, questionCard, ruleRow, selectProperty, showHypotheticals } from './helpers';

const unknown = examples.unknown.response;

test.describe('live API: failure, partial and unavailable states', () => {
  test('an unreachable service is stated plainly and never becomes an empty result or a silent demo', async ({ page }) => {
    await mockApi(page, { 'GET /health': () => 'abort', 'GET /addresses': () => 'abort' });
    await openLive(page);
    const alert = page.getByRole('alert').filter({ hasText: 'The service could not be reached' });
    await expect(alert).toContainText('Could not reach the API');
    await expect(alert).toContainText('it is never used automatically');
    await expect(page.getByRole('button', { name: /API not reachable/ })).toBeVisible();
    await expect(page.getByText('The property list could not be loaded')).toBeVisible();
    await expect(page.getByRole('note', { name: 'Synthetic demo notice' })).toHaveCount(0);
    await expect(page.getByText(/No rules were returned/)).toHaveCount(0);

    // The demo is an explicit choice.
    await alert.getByRole('button', { name: 'Open the synthetic demo' }).click();
    await expect(page.getByRole('note', { name: 'Synthetic demo notice' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Synthetic demo' })).toBeChecked();
  });

  test('partial dataset with no extraction: lookup reports 503 as unavailable, not as "no rules"', async ({ page }) => {
    const unresolved = clone(unknown);
    unresolved.address.address_id = 'A0009';
    unresolved.address.raw_address = { street_address: '9 Sample Avenue', postal_city: 'Springfield', state: 'NJ', zip: '07000' };
    unresolved.jurisdiction = { ...unresolved.jurisdiction, address_id: 'A0009', state: 'NJ', municipality: null, match_quality: 'unresolved', method: 'census_geocoder', unresolved: ['Legal municipality not resolved'] };
    await mockApi(page, {
      'GET /health': () => ({ json: health({ dataset_readiness: 'partial', rules: 0, sources: 87, addresses: 500, resolved_municipalities: 479, last_extraction_outcome: 'failed' }) }),
      'GET /addresses': () => ({ json: addressPage([unresolved]) }),
      'POST /lookup': () => ({ status: 503, json: { detail: { code: 'dataset_unavailable', message: 'No completed extraction; configure provider and run navigator extract' } } }),
    });
    await openLive(page);
    await expect(page.getByText('Partial dataset').first()).toBeVisible();
    await expect(page.getByText(/No rules have been extracted yet, so lookups will report extraction as unavailable/)).toBeVisible();
    await expect(page.getByText(/21 of 500 sample properties have no resolved municipality/)).toBeVisible();
    await expect(page.getByText(/The last extraction run ended as “failed” \(for example, a provider failure\)/)).toBeVisible();

    await selectProperty(page, '9 Sample Avenue');
    // Unresolved legal geography stays on the page; it is not folded into the property record.
    const open = page.getByRole('note').filter({ hasText: 'Legal municipality not established' });
    await expect(open).toBeVisible();
    await expect(open).toContainText('The postal city on the address is not treated as the legal municipality.');
    await expect(open).toContainText('Legal municipality not resolved');
    await expect(page.locator('.subject__line')).toContainText('Unresolved');
    await expect(page.locator('.subject__line')).not.toContainText('Springfield');
    await openPropertyRecord(page);
    const jurisdiction = page.getByRole('region', { name: 'Jurisdiction' });
    await expect(jurisdiction).toContainText('Unresolved');
    await expect(jurisdiction).toContainText('Not established');
    await expect(jurisdiction).toContainText('census_geocoder');

    await page.getByRole('button', { name: 'Run lookup' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The dataset is not ready' });
    await expect(alert).toContainText('No completed extraction; configure provider and run navigator extract');
    await expect(alert).toContainText('It does not mean that no rules apply to this property.');
    await expect(alert).toContainText('HTTP 503');
    await expect(page.getByText(/No rules were returned/)).toHaveCount(0);
    await expect(page.locator('.rule')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('stale selection (404), invalid request (422), dependency failure (502) and contract mismatch each get their own state', async ({ page }) => {
    let mode: '404' | '422' | '502' | 'core' | 'drift' | 'bad' = '404';
    await mockApi(page, {
      ...baseHandlers(),
      'POST /lookup': () => {
        if (mode === '404') return { status: 404, json: examples.errors.unknown_address };
        if (mode === '422') return { status: 422, json: { detail: [{ type: 'date_from_datetime_parsing', loc: ['body', 'as_of'], msg: 'Input should be a valid date', input: 'x' }] } };
        if (mode === '502') return { status: 502, json: { detail: { code: 'core_contract_error', message: 'Core output did not satisfy the shared contract' } } };
        if (mode === 'core') return { status: 503, json: { detail: { code: 'core_unavailable', message: 'Core service failed; no substitute analysis generated' } } };
        if (mode === 'drift') return { json: { ...clone(unknown), confidence: 0.97 } };
        return { json: { ...clone(unknown), evaluations: [{ ...clone(unknown.evaluations[0]), result: 'violation' }] } };
      },
    });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    const run = page.getByRole('button', { name: /^Run lookup/ });

    await run.click();
    const stale = page.getByRole('alert').filter({ hasText: 'That selection is no longer in the dataset' });
    await expect(stale).toContainText('Unknown address ID MISSING');
    await expect(stale.getByRole('button', { name: 'Choose another property' })).toBeVisible();

    mode = '422';
    await run.click();
    const invalid = page.getByRole('alert').filter({ hasText: 'The request was not accepted' });
    await expect(invalid).toContainText('as_of: Input should be a valid date');

    mode = '502';
    await run.click();
    await expect(page.getByRole('alert').filter({ hasText: 'A backend dependency failed' })).toContainText('Core output did not satisfy the shared contract');

    // A failing Core service is a dependency failure too, never "the dataset is not ready".
    mode = 'core';
    await run.click();
    const core = page.getByRole('alert').filter({ hasText: 'A backend dependency failed' });
    await expect(core).toContainText('Core service failed; no substitute analysis generated');
    await expect(page.getByText('The dataset is not ready')).toHaveCount(0);

    mode = 'bad';
    await run.click();
    const contract = page.getByRole('alert').filter({ hasText: 'The response did not match the contract' });
    await expect(contract).toContainText('so it is not shown');
    await expect(contract).toContainText('"violation" is not one of');
    await expect(page.locator('.rule')).toHaveCount(0);

    // An additive field is surfaced as drift without hiding the result.
    mode = 'drift';
    await run.click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await page.getByText('About this result').click();
    await expect(page.getByText('LookupResponse.confidence: field is not in the contract')).toBeVisible();
  });

  test('a transport failure during lookup can be retried', async ({ page }) => {
    let fail = true;
    await mockApi(page, { ...baseHandlers(), 'POST /lookup': () => (fail ? 'abort' : { json: examples.normal.response }) });
    await openLive(page);
    await selectProperty(page, '1 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The service could not be reached' });
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    // A live response that says it is synthetic is labeled synthetic even outside demo mode.
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Synthetic data · not actual law');
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Live API');
  });

  test('partial data, source gaps, unresolved jurisdiction and every rule state stay visible and separate', async ({ page }) => {
    const response = clone(unknown);
    const base = response.rules[0];
    const evaluation = response.evaluations[0];
    const variant = (id: string, title: string, result: string, extra: Record<string, unknown> = {}) => {
      response.rules.push({ ...clone(base), team_rule_id: id, title, evidence_mode: 'live', semantic_verification: 'needs_review' });
      response.evaluations.push({ ...clone(evaluation), team_rule_id: id, result, missing_facts: [], uncertainty_reasons: [], explanation: `As of 2026-11-15, ${title} (test double).`, ...extra });
    };
    variant('r-pending', 'Test double: pending measure', 'pending', { temporal_status: 'pending' });
    variant('r-future', 'Test double: future rule', 'not_yet_effective', { temporal_status: 'not_yet_effective' });
    variant('r-superseded', 'Test double: superseded rule', 'superseded', { applied_interactions: ['r-other'] });
    variant('r-conflict', 'Test double: conflicted rule', 'unknown', {
      conflict_flag: true,
      jurisdiction: 'unknown',
      uncertainty_reasons: ['jurisdiction_uncertainty: legal municipality unresolved', 'conflicting_legal_evidence: Review source disagreement', 'unsupported_condition: cross-reference to section 9 not encoded'],
    });
    response.jurisdiction = { ...response.jurisdiction, municipality: null, match_quality: 'ambiguous', unresolved: ['Two municipalities matched this address'] };
    response.warnings = ['Missing source material: 33 documents; no-rule conclusions are not established', 'Unresolved extraction: 4 source documents', 'Local jurisdiction unresolved; state answers retained and same-state local candidates marked uncertain'];
    response.metadata = { ...response.metadata, dataset: { mode: 'real' }, rule_modes: ['live', 'synthetic'], partial_data: true, missing_source_ids: Array.from({ length: 33 }, (_, i) => `D${i}`), unprocessed_source_ids: ['D90', 'D91', 'D92', 'D93'] };

    await mockApi(page, { ...baseHandlers(), 'POST /lookup': () => ({ json: response }) });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();

    const context = page.getByRole('group', { name: 'Result context' });
    await expect(context).toContainText('Partial data');
    await expect(context).toContainText('Jurisdiction ambiguous');
    const partial = page.getByRole('note').filter({ hasText: 'Partial data: this result can be incomplete' });
    await expect(partial).toContainText('Missing source material: 33 documents; no-rule conclusions are not established');
    await expect(partial).toContainText('33 source documents have no captured text.');
    await expect(partial).toContainText('4 source documents have not completed extraction.');
    await expect(partial).toContainText('Missing sources are a coverage gap, not evidence that no law applies.');

    for (const [name, count] of [['Not yet determinable', 2], ['Enacted, not yet effective', 1], ['Pending, not current law', 1], ['Superseded', 1]] as const) {
      await expect(page.getByRole('region', { name: `${name}: ${count}` })).toBeVisible();
    }
    await expect(ruleRow(page, 'r-pending')).toContainText('Pending');
    await expect(ruleRow(page, 'r-conflict')).toContainText('Conflict flagged');
    await expect(ruleRow(page, 'r-conflict')).toContainText('Jurisdiction uncertain: legal municipality unresolved');

    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    for (const summary of await remaining.locator('.uncertainty__original > summary').all()) await summary.click();
    // Each open item names the kind of next step it needs; only a property fact is answerable.
    const head = (kind: string) => remaining.locator(`.uncertainty__item[data-kind="${kind}"] .uncertainty__head`);
    const conflict = remaining.locator('.uncertainty__item[data-kind="conflict"]');
    await expect(head('conflict')).toContainText('Review of conflicting sources');
    await expect(conflict.getByRole('link', { name: 'Compare the conflicting sources' })).toHaveAttribute('href', /#\/disagreements\?.*address=SYNTH-003.*as_of=2026-11-15/);
    await expect(conflict.locator('.statement[data-reason="conflicting_legal_evidence"]')).toContainText('Review source disagreement');
    await expect(remaining.locator('.statement[data-reason="unsupported_condition"]')).toContainText('cross-reference to section 9 not encoded');
    await expect(head('jurisdiction')).toContainText('Location evidence');
    await expect(remaining.locator('.statement[data-reason="jurisdiction_uncertainty"]')).toContainText('legal municipality unresolved');
    await expect(head('property_fact')).toContainText('A factual answer');
    await expect(remaining.getByText('A fact about the property can close these')).toBeVisible();
    await expect(remaining.getByText('Needs evidence, interpretation or more analysis')).toBeVisible();
    // The conflict is also announced above the results, with the way to compare the sources.
    const cues = page.getByRole('list', { name: 'What is unresolved' });
    await expect(cues.locator('[data-cue="conflict"]')).toContainText('Sources conflict for 1 rule here');
    await expect(cues.locator('[data-cue="conflict"]').getByRole('link', { name: 'Compare the conflicting sources' })).toBeVisible();
    await expect(cues.locator('[data-cue="jurisdiction"]')).toContainText('Legal municipality ambiguous');
    // With a missing fact and no planner on this backend, nothing is asked; the next step is to read what remains.
    await expect(page.locator('.next')).toHaveAttribute('data-next', 'review');
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('live API: questions and evidence against the agreed assist contract', () => {
  test('without the assist route: says so, and supplies facts through the implemented /lookup', async ({ page }) => {
    const applied = clone(unknown);
    applied.evaluations = clone(examples.decisive.response.question_plan.questions[0].alternatives[1].evaluations);
    applied.address.facts.units = 12;
    applied.address.provenance.units = 'User-supplied supplemental fact (not independently verified)';
    applied.address.missing_facts = [];
    const calls = await mockApi(page, { ...baseHandlers(), 'POST /lookup': ({ body }) => ({ json: body.supplemental_facts ? applied : unknown }) });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();

    const questions = page.getByRole('region', { name: 'Useful questions' });
    await expect(questions).toContainText('Question planning is not available on this backend');
    await expect(questions).toContainText('POST /lookup/assist is not available on this backend');
    await expect(questions).toContainText('No questions are ranked and no alternatives are shown.');
    await expect(questions.getByText('Hypothetical', { exact: true })).toHaveCount(0);

    await questions.getByRole('textbox', { name: 'Units' }).fill('12');
    await questions.getByRole('button', { name: 'Evaluate with this fact' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Sent as supplemental fact');
    await openPropertyRecord(page);
    await expect(page.getByRole('region', { name: 'Property facts' })).toContainText('User-supplied supplemental fact (not independently verified)');

    const lookups = calls.filter((call) => call.path === '/lookup');
    expect(lookups.map((call) => call.body)).toEqual([
      { address_id: 'SYNTH-003', as_of: '2026-10-01' },
      { address_id: 'SYNTH-003', as_of: '2026-10-01', supplemental_facts: { units: 12 } },
    ]);
    expect(calls.filter((call) => call.path === '/lookup/assist')).toHaveLength(1);

    // Evidence still works; the six checks say the service has not run them.
    const panel = await openEvidence(page);
    await panel.getByRole('tab', { name: /Checks/ }).click();
    await expect(panel).toContainText('GET /rules/{id}/evidence is not available on this backend');
    await expect(panel.getByText('Not checked by the service')).toHaveCount(6);
  });

  test('with the assist route: answers are resent in full, evidence statuses stay separate, rendering is shown beside the source', async ({ page }) => {
    const sourceHash = unknown.sources[0].sha256;
    const span = { doc_id: 'SYNTHETIC-42', source_hash: sourceHash, start: 147, end: 287, text: unknown.rules[0].quoted_span, section: 'section 2' };
    // Test doubles shaped by contracts/research.schema.json. Platform has not published examples of these yet.
    const report = {
      rule_id: RULE_ID,
      rule_hash: 'test-double-rule-hash',
      checks: [
        { kind: 'source_availability', status: 'pass', message: 'Test double: snapshot text is present.', field: null, spans: [] },
        { kind: 'source_identity', status: 'stale', message: 'Test double: snapshot differs from the latest retrieval.', field: null, spans: [] },
        { kind: 'citation_anchor', status: 'pass', message: 'Test double: section anchor found.', field: null, spans: [] },
        { kind: 'quote_presence', status: 'pass', message: 'Test double: quote occurs at the recorded offsets.', field: null, spans: [span] },
        { kind: 'semantic_support', status: 'insufficient', message: 'Test double: the passage does not establish the exemption.', field: 'exemption_conditions', spans: [] },
        { kind: 'dependencies', status: 'missing', message: 'Test double: referenced exception section 9 is not in the corpus.', field: null, spans: [] },
      ],
      context: {
        spans: [span],
        dependencies: [{ reference: 'section 9', origin: span, status: 'missing', target_doc_id: null, target_section: null, spans: [], explanation: 'Test double: not supplied.' }],
        status: 'partial',
        limits: { max_spans: 8 },
        limits_hit: [],
        retrieval_method: 'exact_anchors_and_bounded_lexical_retrieval',
        semantic_verification: false,
      },
      semantic_review: null,
      blocking_issues: ['Test double: unresolved dependency on section 9'],
      disclaimer: unknown.disclaimer,
    };
    const rendering = { rule_id: RULE_ID, text: 'Test double rendering: applies when residential is true AND units is at least 8.', expression_hash: 'abcdef0123456789', renderer_version: 'test-double-1', unresolved_nodes: [], kind: 'encoded_rule_not_legal_validation' };
    const fixture = examples.decisive.response;
    const calls = await mockApi(page, {
      ...baseHandlers(),
      'POST /lookup/assist': ({ body }) => {
        const response = clone(fixture);
        response.mode = 'synthetic';
        response.capabilities = { question_planner: 'implemented', rule_renderer: 'implemented', evidence_checks: 'implemented' };
        response.evidence_reports = [report];
        response.encoded_rules = [rendering];
        response.answers_applied = body.answers;
        const units = body.answers.find((answer: { field: string }) => answer.field === 'units');
        if (units?.value === 8) {
          response.lookup.evaluations = fixture.question_plan.questions[0].alternatives[1].evaluations;
          response.question_plan.questions = [];
        }
        return { json: response };
      },
    });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByLabel('As of date').fill('2026-11-15');
    await page.getByRole('button', { name: 'Run lookup' }).click();

    await expect(page.getByText('This plan is an authored contract fixture')).toHaveCount(0);
    const question = questionCard(page, 'Number of dwelling units in this building?');
    // Demo answers are offered here only because this dataset declares itself synthetic.
    await showHypotheticals(question);
    await expect(question.getByRole('button', { name: /as a demo answer/ })).toHaveCount(2);
    await question.getByRole('textbox').fill('8');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    expect(calls.filter((call) => call.path === '/lookup/assist').map((call) => call.body)).toEqual([
      { address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] },
      { address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: 8, provenance: 'user_provided' }] },
    ]);
    expect(calls.filter((call) => call.path === '/lookup')).toHaveLength(0);

    const panel = await openEvidence(page, RULE_TITLE);
    await panel.getByRole('tab', { name: /Checks/ }).click();
    const status = (kind: string) => panel.locator(`.check[data-check="${kind}"] .check__tags`);
    await expect(status('source_availability')).toHaveText('Pass');
    await expect(status('source_identity')).toHaveText('Stale');
    await expect(status('citation_anchor')).toHaveText('Pass');
    await expect(status('quote_presence')).toHaveText('Pass');
    await expect(status('semantic_support')).toHaveText('Insufficient');
    await expect(panel.locator('.check[data-check="semantic_support"] .check__result')).toContainText('Insufficient · exemption conditions — Test double: the passage does not establish the exemption.');
    await expect(status('dependencies')).toHaveText('Missing');
    await expect(panel.getByText('Blocking issues reported')).toBeVisible();
    await expect(panel).toContainText('Test double: unresolved dependency on section 9');
    await expect(panel).toContainText('Retrieval finds passages; it does not verify meaning.');
    await expect(panel.getByText('Not checked by the service')).toHaveCount(0);

    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    await expect(panel.locator('.compare__rendering')).toHaveText(rendering.text);
    await expect(panel).toContainText('Deterministic rendering · renderer test-double-1');
    await expect(panel).toContainText('Showing it is not legal validation of that reading.');
  });

  test('Core absent: the response is a successful partial capability, and facts can still be supplied with their definitions', async ({ page }) => {
    const units = examples.assist.response.question_plan.questions[0].fact;
    const calls = await mockApi(page, {
      ...baseHandlers(),
      'GET /facts': () => ({ json: { units } }),
      'POST /lookup/assist': ({ body }) => {
        const response = clone(examples.assist.response);
        response.capabilities = { lookup: 'implemented', evidence: 'implemented', question_planner: 'dependency_unavailable', rule_renderer: 'dependency_unavailable' };
        response.encoded_rules = [];
        response.question_plan = {
          status: 'unavailable',
          questions: [],
          remaining_uncertainty: [{ kind: 'service_dependency', message: 'Core question planner has not been integrated', remedy: 'Complete CORE-03/04 and supply navigator.core_assist.plan_questions', rule_ids: [], predicate_ids: [], field: null, source_refs: [] }],
          traces: [],
          limits: response.question_plan.limits,
          evaluations_used: 0,
          limits_hit: [],
          algorithm_version: 'unavailable',
          exhaustive: false,
        };
        response.answers_applied = body.answers;
        if (body.answers.some((answer: { field: string; value: unknown }) => answer.field === 'units' && answer.value === 12)) {
          response.lookup.evaluations = examples.assist.response.question_plan.questions[0].alternatives[2].evaluations;
        }
        return { json: response };
      },
    });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByLabel('As of date').fill('2026-11-15');
    await page.getByRole('button', { name: 'Run lookup' }).click();

    const questions = page.getByRole('region', { name: /Useful questions/ });
    await expect(questions.getByText('Planner unavailable', { exact: true })).toBeVisible();
    await expect(questions).toContainText('The question planner is not available');
    await expect(page.getByRole('alert')).toHaveCount(0);
    const dependency = page.getByRole('region', { name: /What remains uncertain/ }).locator('.uncertainty__item[data-kind="service_dependency"]');
    await expect(dependency.locator('.uncertainty__head')).toContainText('A backend service was not available');
    await dependency.locator('.uncertainty__original > summary').click();
    await expect(dependency.locator('.statement__message')).toHaveText('Core question planner has not been integrated');
    await expect(dependency).toContainText('Complete CORE-03/04 and supply navigator.core_assist.plan_questions');
    // The fact definition comes from GET /facts, not from inference.
    await expect(questions).toContainText('Number of dwelling units in this building (dwelling units)');
    await questions.getByRole('textbox', { name: 'Units' }).fill('12');
    await questions.getByRole('button', { name: 'Evaluate with this fact' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    expect(calls.filter((call) => call.path === '/lookup/assist').at(-1)?.body).toEqual({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: 12, provenance: 'user_provided' }] });

    const panel = await openEvidence(page);
    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    await expect(panel).toContainText('rule_renderer: dependency unavailable');
  });

  test('probe values are never offered as answers on a non-synthetic dataset', async ({ page }) => {
    const response = clone(examples.decisive.response);
    response.mode = 'dataset';
    response.lookup.warnings = [];
    response.lookup.metadata = { ...response.lookup.metadata, dataset: { mode: 'real' }, rule_modes: ['live'] };
    response.lookup.rules[0].evidence_mode = 'live';
    await mockApi(page, { ...baseHandlers(), 'POST /lookup/assist': ({ body }) => ({ json: { ...response, lookup: { ...response.lookup, as_of: body.as_of } } }) });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    const question = questionCard(page, 'Number of dwelling units in this building?');
    await showHypotheticals(question);
    await expect(question.getByText('Hypothetical', { exact: true })).toHaveCount(2);
    await expect(question.getByRole('button', { name: /as a demo answer/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Result context' })).not.toContainText('Synthetic data');
  });

  test('a rejected answer keeps the earlier result on screen and says it predates the answer', async ({ page }) => {
    await mockApi(page, {
      ...baseHandlers(),
      'POST /lookup': ({ body }) => (body.supplemental_facts ? { status: 422, json: { detail: { code: 'invalid_input', message: 'units is below its valid minimum' } } } : { json: unknown }),
    });
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    const questions = page.getByRole('region', { name: 'Useful questions' });
    await questions.getByRole('textbox', { name: 'Units' }).fill('3');
    await questions.getByRole('button', { name: 'Evaluate with this fact' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The request was not accepted' });
    await expect(alert).toContainText('units is below its valid minimum');
    await expect(alert).toContainText('The result below is from before this answer and does not include it.');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Not applied');
  });
});
