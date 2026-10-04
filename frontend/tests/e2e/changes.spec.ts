import { expect, test } from '@playwright/test';
import { baseHandlers, clone, examples, expectNoHorizontalOverflow, mockApi, openDemo, openLive, ruleRow } from './helpers';

test.describe('changes view', () => {
  test('synthetic date comparison keeps definite and uncertain impacts apart, with before/after evidence', async ({ page }) => {
    await openDemo(page, '#/changes?mode=demo');
    await page.getByRole('button', { name: 'Oct 1, 2026 → Nov 15, 2026', exact: true }).click();

    const result = page.getByRole('article', { name: 'Comparison result' });
    const context = result.getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText('From Oct 1, 2026 to Nov 15, 2026');
    await expect(context).toContainText('Partial');
    await expect(context).toContainText('Actual law');
    await expect(context).toContainText('Not legal advice.');
    await expect(result).toContainText('Uncertain impacts are separate from definitely affected addresses');

    const definite = result.locator('[data-impact="Definitely affected"]');
    const uncertain = result.locator('[data-impact="Uncertain"]');
    const conflict = result.locator('[data-impact="Conflict flagged"]');
    await expect(definite).toHaveAttribute('data-count', '1');
    await expect(uncertain).toHaveAttribute('data-count', '1');
    await expect(conflict).toHaveAttribute('data-count', '0');
    await expect(conflict.locator('.impact__count')).toHaveText('0');

    // Names replace IDs once the address and rule records have been read.
    await result.getByRole('tab', { name: 'By property' }).click();
    const first = result.locator('.property-node[data-address="SYNTH-001"]');
    await expect(first).toContainText('1 Test Street');
    await expect(first).toContainText('Maple Harbor, CA');
    await expect(first.locator('.impact-row')).toHaveAttribute('data-certainty', 'definite');
    await expect(first.locator('.impact-row')).toContainText('Synthetic Maple Harbor deposit cap');
    await expect(first).toContainText('Not yet effective');
    await expect(first).toContainText('Applies');
    await first.locator('.impact-row summary').first().click();
    await expect(first).toContainText('Before · Oct 1, 2026');
    await expect(first).toContainText('After · Nov 15, 2026');
    await first.getByText('Evidence (3 quotes)').last().click();
    await expect(first.locator('blockquote').first()).toContainText('Beginning November 15, 2026');

    const second = result.locator('.property-node[data-address="SYNTH-003"]');
    await expect(second.locator('.impact-row')).toHaveAttribute('data-certainty', 'uncertain');
    await second.locator('.impact-row summary').first().click();
    await expect(second).toContainText('Needs: units');
    await expect(result.locator('.property-node[data-address="SYNTH-002"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // From a changed property straight to its lookup on the later date.
    await second.getByRole('link', { name: 'Open lookup as of Nov 15, 2026' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: '3 Test Street, Maple Harbor, CA' })).toBeVisible();
    await expect(page.getByLabel('As of date')).toHaveValue('2026-11-15');
  });

  test('a blocked published scenario is shown as blocked, never as an empty affected set', async ({ page }) => {
    await openDemo(page, '#/changes?mode=demo');
    await page.getByRole('button', { name: 'Scenario T1', exact: true }).click();
    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result).toHaveAttribute('data-status', 'blocked');
    await expect(result.getByText('Blocked: this comparison could not be established')).toBeVisible();
    await expect(result).toContainText('Do not read this as a verified empty set.');
    await expect(result).toContainText('Recorded against a store with no extracted rules');
    for (const column of ['Definitely affected', 'Uncertain', 'Conflict flagged']) {
      await expect(result.locator(`[data-impact="${column}"] .impact__count`)).toHaveText('—');
      await expect(result.locator(`[data-impact="${column}"]`)).toContainText('Not established: the comparison is blocked.');
    }
    await expect(result).toContainText('Missing extracted legal evidence for CA-ALG-01');
    await expect(result.getByRole('row', { name: /CA-ALG-01/ })).toContainText('No extracted rule matches this reference');
    await expect(result).not.toContainText('No differences between these dates');
  });

  test('the if-enacted scenario is labeled hypothetical', async ({ page }) => {
    await openDemo(page, '#/changes?mode=demo');
    await page.getByRole('button', { name: 'Scenario T4', exact: true }).click();
    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Hypothetical · if enacted');
    await expect(result).toContainText('Hypothetical: assumes the selected pending rules are enacted');
    await expect(result).toContainText('Stored law is unchanged');
    await expect(result).toHaveAttribute('data-status', 'blocked');

    await page.getByRole('button', { name: 'Oct 1, 2026 → Nov 15, 2026 · if enacted' }).click();
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Hypothetical · if enacted');
    await expect(result).toHaveAttribute('data-status', 'partial');
  });

  test('a same-day comparison reports no differences as a complete result', async ({ page }) => {
    await openDemo(page, '#/changes?mode=demo');
    await page.getByRole('button', { name: 'Nov 15, 2026 → Nov 15, 2026' }).click();
    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result).toHaveAttribute('data-status', 'complete');
    await expect(result).toContainText('No differences between these dates');
  });

  test('form validation, the contract default date, and comparisons the demo cannot compute', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2031-05-05T12:00:00Z'));
    await openDemo(page, '#/changes?mode=demo');
    await expect(page.getByLabel('From date')).toHaveValue('2026-10-01');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByText('Enter the later date.')).toBeVisible();
    await page.getByLabel('To date').fill('2026-01-01');
    await expect(page.getByText('The second date is earlier than the first.')).toBeVisible();
    await page.getByLabel('To date').fill('2027-01-01');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Not available in the synthetic demo' });
    await expect(alert).toContainText('holds no recorded comparison for 2026-10-01 → 2027-01-01');

    await page.getByRole('radio', { name: 'Published scenario' }).check();
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByText('Enter a scenario ID.')).toBeVisible();
    await page.getByLabel('Scenario ID').fill('T5');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Comparison result' })).toContainText('Scenario T5');
  });

  test('live API: request bodies follow the contract; conflicts and hypotheticals are labeled', async ({ page }) => {
    const evaluation = examples.normal.response.evaluations[0];
    const calls = await mockApi(page, {
      ...baseHandlers(),
      'POST /changes': ({ body }) => {
        if (body.test_id === 'NOPE') return { status: 404, json: { detail: { code: 'unknown_id', message: 'Unknown test ID NOPE' } } };
        return {
          json: {
            test_id: null,
            scenario: body.scenario,
            status: 'partial',
            before: body.before,
            after: body.after,
            affected_address_ids: ['SYNTH-001'],
            uncertain_address_ids: [],
            conflict_flag_address_ids: ['SYNTH-001'],
            differences: {
              'SYNTH-001': [
                { team_rule_id: evaluation.team_rule_id, certainty: 'definite', before: { ...clone(evaluation), result: 'pending', temporal_status: 'pending' }, after: { ...clone(evaluation), conflict_flag: true } },
              ],
            },
            mapped_rule_ids: {},
            notes: ['Hypothetical only: selected pending rules are assumed enacted and effective on the comparison date; stored law is unchanged'],
            disclaimer: examples.normal.response.disclaimer,
          },
        };
      },
    });
    await openLive(page, '#/changes?mode=live');
    await page.getByLabel('To date').fill('2027-07-02');
    await page.getByLabel('Treat pending rules as').selectOption('if_enacted');
    // Raw rule IDs are an advanced filter, behind a disclosure.
    await expect(page.getByLabel(/Limit to rule IDs/)).toBeHidden();
    await page.getByText('Limit to specific rules (optional)').click();
    await page.getByLabel(/Limit to rule IDs/).fill(`${evaluation.team_rule_id}, r-other`);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();

    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Hypothetical · if enacted');
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Live API');
    await expect(result.locator('[data-impact="Conflict flagged"]')).toHaveAttribute('data-count', '1');
    // The comparison opens property by property: the property is named, then each rule's before → after.
    const property = result.locator('.property-node[data-address="SYNTH-001"]');
    await expect(property.locator('.property-name')).toContainText('1 Test Street');
    await expect(property.locator('.property-node__counts')).toContainText('1 definite');
    const row = property.locator('.impact-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Conflict');
    await expect(row).toContainText('Pending');
    await row.locator('summary').first().click();
    await expect(row.getByRole('link', { name: 'Compare the conflicting sources' })).toHaveAttribute('href', /#\/disagreements\?.*address=SYNTH-001.*as_of=2027-07-02/);
    // This double has no summary route: it is tried once with the same body, then the plain route answers.
    const body = { before: '2026-10-01', after: '2027-07-02', scenario: 'if_enacted', rule_ids: [evaluation.team_rule_id, 'r-other'] };
    expect(calls.filter((call) => call.method === 'POST').map((call) => [call.path, call.body])).toEqual([['/changes/summary', body], ['/changes', body]]);
    await expect(result.getByRole('status').filter({ hasText: 'POST /changes/summary is not available on this backend' })).toBeVisible();

    await page.getByRole('radio', { name: 'Published scenario' }).check();
    await page.getByLabel('Scenario ID').fill('NOPE');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That selection is no longer in the dataset' })).toContainText('Unknown test ID NOPE');
    expect(calls.at(-1)?.body).toEqual({ test_id: 'NOPE' });
    await expect(ruleRow(page)).toHaveCount(0);
  });
});
