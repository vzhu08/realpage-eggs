import { expect, test } from '@playwright/test';
import { addressPage, baseHandlers, clone, examples, expectNoHorizontalOverflow, mockApi, openEvidence, openLive, selectProperty } from './helpers';

test('all-unknown results can be browsed, filtered and inspected without changing coverage', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = clone(examples.unknown.response);
  const rule = response.rules[0];
  rule.title = 'Fictional receipt provision';
  rule.requirement = 'Provide an itemized receipt.';
  rule.category = 'application_screening_fees';
  const otherRule = { ...rule, team_rule_id: 'fictional-notice-rule', title: 'Fictional written notice', requirement: 'Provide a written notice.', category: 'just_cause_eviction' };
  response.rules.push(otherRule);
  response.evaluations.push({ ...clone(response.evaluations[0]), team_rule_id: otherRule.team_rule_id });
  await mockApi(page, {
    ...baseHandlers(),
    'GET /addresses': () => ({ json: addressPage([response]) }),
    'POST /lookup': () => ({ json: response }),
    'GET /rules/*': ({ url }) => url.pathname.endsWith('/evidence') ? { status: 404, json: { detail: 'Not Found' } } : { json: { rule, versions: [rule], disclaimer: response.disclaimer } },
  });
  await openLive(page);
  await selectProperty(page, response.address.raw_address.street_address);
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('button', { name: 'Browse 2 returned rules' })).toBeVisible();
  await page.locator('.verdict').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('result-summary.png') });
  await page.getByRole('button', { name: 'Browse 2 returned rules' }).click();
  await expect(page.getByRole('heading', { name: 'Returned rules and source evidence' })).toBeFocused();
  const search = page.getByRole('searchbox', { name: 'Search returned rules', exact: true });
  await expect(page.locator('.rule[data-result="unknown"]')).toHaveCount(2);
  await search.fill('itemized');
  await expect(page.locator('.rule')).toHaveCount(1);
  await expect(page.locator('.rule')).toContainText('Coverage unknown');
  await expect(page.getByRole('status').filter({ hasText: 'Showing 1 of 2 returned rules' })).toBeVisible();
  await page.locator('.rules').screenshot({ path: testInfo.outputPath('rule-browser.png') });
  await expectNoHorizontalOverflow(page);
  const evidence = await openEvidence(page, rule.title);
  await expect(evidence.getByRole('tab', { name: 'Source text' })).toBeVisible();
  await evidence.getByRole('button', { name: 'Close evidence' }).click();
  await search.fill('no-such-provision');
  await expect(page.locator('.rule')).toHaveCount(0);
  await expect(page.getByText(/No returned rules match these filters/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('just_cause_eviction');
  await expect(page.locator('.rule')).toHaveCount(1);
  await expect(page.locator('.rule')).toContainText('Fictional written notice');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.rule[data-result="unknown"]')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
});
