import { expect, test } from '@playwright/test';
import { RULE_TITLE, expectNoHorizontalOverflow, openCase, openDemo, openEvidence, ruleRow, selectProperty, showFinder } from './helpers';

test.describe('synthetic demo: the complete journey', () => {
  test('lookup → useful question → labeled answer → reevaluation → supporting evidence', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');

    // The result states its date, its synthetic status and the disclaimer.
    const context = page.getByRole('group', { name: 'Result context' });
    await expect(context).toContainText('As of Nov 15, 2026');
    await expect(context).toContainText('Synthetic data · not actual law');
    await expect(context).toContainText('Not legal advice. Coverage is not a finding of compliance or a violation.');
    await expect(page.getByText('Contract fixture: Decisive question')).toBeVisible();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');

    // The question explains itself and offers hypothetical outcomes.
    const question = page.getByRole('article', { name: "What is the property's units?" });
    await expect(question).toContainText('Number of dwelling units in this building');
    await expect(question).toContainText('Why this matters');
    await expect(question.getByText('Hypothetical', { exact: true })).toHaveCount(2);
    await expect(question).toContainText('If units is 7');
    await expect(question).toContainText('Does not cover');

    // A typed, labeled answer re-evaluates.
    await question.getByRole('textbox', { name: "What is the property's units?" }).fill('8');
    await question.getByRole('button', { name: 'Apply answer' }).click();

    const changed = page.getByRole('region', { name: 'Re-evaluated with your answers' });
    await expect(changed).toContainText('Unknown');
    await expect(changed).toContainText('Applies');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');

    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Units');
    await expect(answers.locator('.answers__value')).toHaveText('8');
    await expect(answers).toContainText('You provided · unverified');
    await expect(answers).toContainText('Applied');
    await expect(answers).toContainText('none changes the stored property record');
    await expect(page.getByText('The demo does not evaluate rules itself.').first()).toBeVisible();

    // Supporting evidence: exact quote, source, retrieval time, context.
    const panel = await openEvidence(page);
    await expect(panel.getByRole('heading', { name: RULE_TITLE })).toBeVisible();
    await expect(panel.locator('.quote__text').first()).toHaveText('Beginning November 15, 2026, residential rental buildings containing at least eight units must limit a security deposit to one month\'s rent.');
    await expect(panel).toContainText('characters 147–287');
    await expect(panel).toContainText('https://example.invalid/synthetic-42');
    await expect(panel).toContainText('Oct 3, 2026, 00:00 UTC');
    await panel.getByRole('button', { name: 'Show surrounding text' }).first().click();
    const passage = panel.getByRole('group', { name: 'Surrounding source text' });
    await expect(passage.locator('mark')).toHaveText(/^Beginning November 15, 2026/);
    await expect(passage).toContainText('SYNTHETIC TEST DOCUMENT');
    await expect(passage).toContainText('There are no exemptions to this section.');

    // Encoded rule beside the source; rule-level encoding kept apart from this property's evaluation.
    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    await expect(panel).toContainText('The source says');
    await expect(panel).toContainText('The rule is encoded as');
    await expect(panel).toContainText('units ≥ 8');
    await expect(panel).toContainText('No exemption is encoded.');
    await expect(panel).toContainText('rule_renderer: dependency unavailable');
    await expect(panel).toContainText('For this property on Nov 15, 2026');

    // Six separate checks; none is presented as verified.
    await panel.getByRole('tab', { name: /Checks/ }).click();
    const checks = panel.locator('.check');
    await expect(checks).toHaveCount(6);
    await expect(checks.locator('.check__title')).toHaveText(['Source availability', 'Source identity and version', 'Citation anchor', 'Exact quote', 'Semantic support', 'Dependencies']);
    await expect(panel.getByText('Not checked by the service')).toHaveCount(6);
    await expect(panel).toContainText('3 of 3 quotes equal the source text at their recorded offsets');
    await expect(panel).toContainText('it does not show they support the rule');

    await panel.getByRole('tab', { name: /Versions/ }).click();
    await expect(panel).toContainText('Effective Nov 15, 2026');
    await expect(panel).toContainText('Shown in this result');
    await expectNoHorizontalOverflow(page);
  });

  test('a case that correctly stays unknown after the ranked question is answered', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Two unresolved exemptions');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('heading', { name: 'Useful questions 1' })).toBeVisible();
    await expect(page.getByText('Partial analysis', { exact: true })).toBeVisible();

    const question = page.getByRole('article', { name: "What is the property's certificate of occupancy?" });
    await expect(question).toContainText('not the year built');
    await question.getByRole('textbox').fill('2020-06-30');
    await question.getByRole('button', { name: 'Apply answer' }).click();

    const changed = page.getByRole('region', { name: 'Re-evaluated with your answers' });
    await expect(changed).toContainText('Result unchanged; what it needs has changed');
    await expect(changed).toContainText('Still needs: exemption filed, owner occupied.');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(ruleRow(page)).toContainText('Needs: exemption filed, owner occupied');

    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    await expect(remaining.locator('.uncertainty__item')).toHaveCount(2);
    await expect(remaining).toContainText('Still need exemption_filed');
    await expect(remaining).toContainText('Still need owner_occupied');
    await expect(page.getByRole('heading', { name: 'Useful questions 0' })).toBeVisible();
  });

  test('"I don\'t know" is recorded as an explicit unknown and supplies no certainty', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    await page.getByRole('button', { name: 'I don’t know' }).click();
    await expect(page.getByRole('region', { name: 'Re-evaluated: nothing changed' })).toContainText('Still needs: units.');
    await expect(page.locator('.answers__value')).toHaveText('I don’t know');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('region', { name: /What remains uncertain/ })).toContainText('Units is not on record.');
  });

  test('a value the demo has no evaluator output for is labeled "not evaluated", never guessed', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    const question = page.getByRole('article', { name: "What is the property's units?" });
    await question.getByRole('textbox').fill('12');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Not evaluated');
    await expect(answers).toContainText('No recorded evaluator output for units = 12. Recorded values: 7, 8.');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByText('Some answers could not be evaluated in the synthetic demo.')).toBeVisible();
  });

  test('typed input is validated before anything is sent', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    const question = page.getByRole('article', { name: "What is the property's units?" });
    const input = question.getByRole('textbox');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await expect(question.getByRole('alert')).toHaveText('Enter a value, or choose “I don’t know”.');
    await input.fill('eight');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await expect(question.getByRole('alert')).toHaveText('Enter a whole number using digits only.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('0');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await expect(question.getByRole('alert')).toHaveText('Enter 1 or more.');
    await expect(page.getByRole('region', { name: /Your answers/ })).toHaveCount(0);

    await openCase(page, 'Two unresolved exemptions');
    const date = page.getByRole('article', { name: "What is the property's certificate of occupancy?" });
    await date.getByRole('textbox').fill('2020-06-31');
    await date.getByRole('button', { name: 'Apply answer' }).click();
    await expect(date.getByRole('alert')).toHaveText('Use YYYY, YYYY-MM or YYYY-MM-DD, with a real calendar date.');
  });

  test('answers can be edited and removed, with a visible history; each change re-evaluates', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    await page.getByRole('button', { name: 'Answer with 8 as a demo answer' }).click();
    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Demo answer · synthetic');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');

    await answers.getByRole('button', { name: 'Edit answer for Units' }).click();
    const edit = answers.getByRole('textbox', { name: 'New answer for Units' });
    await expect(edit).toHaveValue('8');
    await edit.fill('7');
    await answers.getByRole('button', { name: 'Re-evaluate' }).click();

    const changed = page.getByRole('region', { name: 'Re-evaluated with your answers' });
    await expect(changed).toContainText('Does not cover');
    await expect(changed).toContainText('does not cover this property on this date');
    await expect(page.getByText('No rules were returned for this property on this date')).toBeVisible();
    await expect(answers.locator('.answers__value')).toHaveText('7');

    await answers.getByText(/Answer history \(2 changes\)/).click();
    await expect(answers.locator('.history li')).toHaveText([/Answered units: 8 · Demo answer · synthetic/, /Changed units: 8 → 7 · You provided · unverified/]);

    await answers.getByRole('button', { name: 'Remove answer for Units' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('article', { name: "What is the property's units?" })).toBeVisible();
    await expect(page.getByText('No answers are in play.')).toBeVisible();
  });

  test('all five research fixtures are explorable and say what kind of gap remains', async ({ page }) => {
    await openDemo(page);
    await showFinder(page);
    await expect(page.getByRole('region', { name: 'Contract fixtures' }).getByRole('button')).toHaveCount(6);

    await openCase(page, 'Irrelevant missing fact');
    await expect(page.getByText('No rules were returned for this property on this date')).toBeVisible();
    await expect(page.getByText('it is not a statement that no law applies')).toBeVisible();
    await expect(page.getByText('Nothing to ask: the plan found no missing property fact that could change a result.')).toBeVisible();

    await openCase(page, 'Unresolved source coverage');
    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    await expect(remaining).toContainText('Source gap');
    await expect(remaining).toContainText('Referenced exception source is not supplied');
    await expect(remaining).toContainText('do not ask the renter to decide the law');
    await expect(remaining.locator('[data-kind="source_gap"]')).toContainText('Needs: a source to be obtained');
    await expect(remaining.getByText('Needs evidence, interpretation or more analysis')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Useful questions 0' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);

    await openCase(page, 'Bounded partial analysis');
    await expect(page.getByText('The analysis stopped at an explicit limit')).toBeVisible();
    await expect(page.getByText(/Limit reached: max evaluations\. 1 of 1 allowed evaluations were used\./)).toBeVisible();
    await expect(page.getByRole('region', { name: /What remains uncertain/ })).toContainText('Only one alternative evaluated');
    await expect(page.getByRole('article').getByText('Hypothetical', { exact: true })).toHaveCount(1);

    await openCase(page, 'Two unresolved exemptions');
    await expect(page.getByRole('article', { name: "What is the property's certificate of occupancy?" })).toBeVisible();
    await openCase(page, 'Decisive question');
    await expect(page.getByRole('article', { name: "What is the property's units?" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('ordinary examples: date default, not-yet-effective, applies, empty and unknown', async ({ page }) => {
    // The clock is far from the contract default; the date field must not follow it.
    await page.clock.setFixedTime(new Date('2031-05-05T12:00:00Z'));
    await openDemo(page);
    await selectProperty(page, '1 Test Street');
    const date = page.getByLabel('As of date');
    await expect(date).toHaveValue('2026-10-01');
    await expect(page.getByText('Choose the date to evaluate, then run the lookup')).toBeVisible();

    await page.getByRole('button', { name: 'Run lookup' }).click();
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('As of Oct 1, 2026');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'not_yet_effective');
    await expect(page.getByRole('region', { name: 'Enacted, not yet effective: 1' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Recorded backend output');

    // Changing the date does not silently change the result on screen.
    await page.getByRole('button', { name: 'Nov 15, 2026', exact: true }).click();
    await expect(page.getByText('These results are for Oct 1, 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Run lookup for Nov 15, 2026' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    await expect(page.getByText('Applicability is not a finding of compliance or violation.')).toBeVisible();

    await selectProperty(page, '2 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    await expect(page.getByText('No rules were returned for this property on this date')).toBeVisible();
    await expect(page.locator('.rule')).toHaveCount(0);

    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(ruleRow(page)).toContainText('Needs: units');
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Checked-in API example');
    // The contract fixtures recorded for this property and date are one click away.
    await page.locator('.case-link', { hasText: 'Decisive question' }).click();
    await expect(page.getByText('Contract fixture: Decisive question')).toBeVisible();
  });

  test('the implemented API\'s own example: ranked question, interval alternatives, real evidence checks, rendering and trace', async ({ page }) => {
    await openDemo(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Nov 15, 2026', exact: true }).click();
    await page.getByRole('button', { name: 'Run lookup' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByText('This plan is an authored contract fixture')).toHaveCount(0);

    const question = page.getByRole('article', { name: /Number of dwelling units in this building\?/ });
    await expect(question).toContainText('Feasible evaluator probes show this fact can change a result');
    await expect(question.locator('.alternative')).toHaveCount(3);
    await expect(question).toContainText('If units is in [1, 7]');
    await expect(question).toContainText('Covers 1 to 7 dwelling units. Evaluated at the probe value 1, which stands in for the whole range.');
    await expect(question).toContainText('Covers 9 dwelling units or more.');
    await expect(page.getByText('Partial analysis', { exact: true })).toBeVisible();

    // An answer the planner's interval covers is replayed and labeled as such.
    await question.getByRole('textbox').fill('12');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');
    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Applied');
    await expect(answers).toContainText('the planner’s interval that contains this answer');
    await expect(answers).toContainText('recorded for its probe value 9');

    // What still is not established after the answer stays on screen, by kind.
    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    await expect(remaining.locator('[data-kind="source_gap"]').first()).toContainText('Needs: a source to be obtained');
    await expect(remaining.getByText('Needs evidence, interpretation or more analysis')).toBeVisible();
    await expect(remaining).toContainText('Exact quote/retrieval is not semantic verification');
    await expect(remaining.locator('[data-kind="property_fact"]')).toHaveCount(0);

    const panel = await openEvidence(page);
    await panel.getByRole('tab', { name: /Checks/ }).click();
    const status = (kind: string) => panel.locator(`.check[data-check="${kind}"] .check__tags`);
    await expect(status('source_availability')).toHaveText('Pass');
    await expect(status('source_identity')).toHaveText('Pass');
    await expect(status('quote_presence')).toHaveText('Pass × 5');
    await expect(status('citation_anchor')).toHaveText('Not checked');
    await expect(status('semantic_support')).toHaveText('Not checked');
    await expect(status('dependencies')).toHaveText('Pass');
    await expect(panel.locator('.check[data-check="citation_anchor"]')).toContainText('no unique structured section anchor in this snapshot');
    await expect(panel.locator('.check[data-check="quote_presence"]')).toContainText('requirement, key value, coverage conditions, effective date');
    await expect(panel.getByText('Not checked by the service')).toHaveCount(0);

    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    await expect(panel.locator('.compare__rendering')).toContainText('Coverage: (residential == true AND units [dwelling units] >= 8).');
    await expect(panel.locator('.compare__rendering')).toContainText('Effective boundary (inclusive): 2026-11-15');
    await expect(panel).toContainText('Deterministic rendering · renderer encoded-rule-v1');
    await expectNoHorizontalOverflow(page);
  });

  test('the evaluation trace shows each encoded condition with its result before any answer', async ({ page }) => {
    await openDemo(page);
    await selectProperty(page, '3 Test Street');
    await page.getByRole('button', { name: 'Nov 15, 2026', exact: true }).click();
    await page.getByRole('button', { name: 'Run lookup' }).click();
    const panel = await openEvidence(page);
    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    const trace = panel.getByRole('region', { name: 'Evaluation trace' });
    await expect(trace.locator('.trace__node[data-predicate$=":coverage_conditions"]')).toHaveAttribute('data-result', 'unknown');
    await expect(trace.locator('.trace__node[data-predicate$=":coverage_conditions/args/0"]')).toContainText('residential = Yes');
    await expect(trace.locator('.trace__node[data-predicate$=":coverage_conditions/args/0"]')).toHaveAttribute('data-result', 'true');
    await expect(trace.locator('.trace__node[data-predicate$=":coverage_conditions/args/1"]')).toContainText('units ≥ 8');
    await expect(trace.locator('.trace__node[data-predicate$=":coverage_conditions/args/1"]')).toHaveAttribute('data-result', 'unknown');
  });

  test('evidence failure: a missing source keeps the result unknown and each check says why', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Missing source support');
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Partial data');
    await expect(page.getByText('Missing source material: 1 documents; no-rule conclusions are not established')).toBeVisible();
    await expect(page.getByText('Nothing to ask: the plan found no missing property fact that could change a result.')).toBeVisible();

    const panel = await openEvidence(page);
    // The exact quote recorded with the rule is still shown; only its surrounding text is unavailable.
    await expect(panel.locator('.quote__text').first()).toContainText('Beginning November 15, 2026');
    await panel.getByRole('button', { name: 'Show surrounding text' }).first().click();
    await expect(panel).toContainText('That is a coverage gap, not evidence about the law.');

    await panel.getByRole('tab', { name: /Checks/ }).click();
    const status = (kind: string) => panel.locator(`.check[data-check="${kind}"] .check__tags`);
    await expect(status('source_availability')).toHaveText('Missing');
    await expect(status('source_identity')).toHaveText('Stale');
    await expect(status('dependencies')).toHaveText('Insufficient');
    await expect(status('semantic_support')).toHaveText('Not checked');
    // The report has no quote check when there is no text to check against; the row says so.
    await expect(panel.locator('.check[data-check="quote_presence"] .check__head')).toContainText('No result in the report');
    await expect(panel.getByText('Blocking issues reported')).toBeVisible();
    await expect(panel).toContainText('missing_source:SYNTHETIC-42');
    await expect(panel).toContainText('this is a coverage gap, not a fabrication verdict');

    await panel.getByRole('tab', { name: 'Encoded rule' }).click();
    await expect(panel.getByText('Parts of the rule could not be rendered')).toBeVisible();
  });

  test('a date with no recording is refused with the recorded dates, and invalid dates are caught', async ({ page }) => {
    await openDemo(page);
    await selectProperty(page, '1 Test Street');
    const date = page.getByLabel('As of date');
    await date.fill('2027-03-01');
    await page.getByRole('button', { name: 'Run lookup' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Not available in the synthetic demo' });
    await expect(alert).toContainText('holds no recorded lookup for SYNTH-001 on 2027-03-01');
    await expect(page.locator('.rule')).toHaveCount(0);
    await alert.getByRole('button', { name: 'Use Nov 15, 2026' }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'applies');

    await date.fill('');
    await expect(page.getByText('Choose the date to evaluate the rules on.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run lookup/ }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(date).toHaveValue('2026-10-01');
  });

  test('property search: results, empty search and selection', async ({ page }) => {
    await openDemo(page);
    await showFinder(page);
    const search = page.getByRole('searchbox', { name: 'Sample properties' });
    // Three Maple Harbor properties from the contract examples and fourteen from the development fixture.
    await expect(page.getByText('17 properties')).toBeVisible();
    const list = page.getByRole('list', { name: 'Sample properties' });
    await expect(list.getByText('Development fixture')).toHaveCount(14);
    await expect(list.getByRole('button', { name: /3 Test Street/ })).not.toContainText('Development fixture');
    await search.fill('synth-002');
    await expect(page.getByText('1 property matching “synth-002”')).toBeVisible();
    await search.fill('zzz');
    await expect(page.getByText('No sample properties match')).toBeVisible();
    await search.fill('');
    await selectProperty(page, '3 Test Street');
    await expect(page.getByRole('heading', { level: 1, name: '3 Test Street, Maple Harbor, CA' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Jurisdiction' })).toContainText('Resolved');
    await expect(page.getByRole('region', { name: 'Property facts' })).toContainText('Not on record: units');
  });
});
