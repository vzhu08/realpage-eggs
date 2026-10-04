/**
 * Captures the documentation screenshots in docs/screenshots. Skipped in normal runs:
 *   SCREENSHOTS=1 npx playwright test screenshots
 */
import { type Page, expect, test } from '@playwright/test';
import { mockApi, openCase, openDemo, openEvidence, selectProperty } from './helpers';

test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to regenerate docs/screenshots');

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
};

/** Mobile keeps the views whose layout differs most from desktop, so the set stays small. */
const MOBILE_SET = new Set(['02-lookup-unknown', '03-useful-question', '04-reevaluated', '05-evidence-source', '08-stays-unknown', '10-changes-comparison', '11-changes-blocked', '14-evidence-failure']);

const shot = async (page: Page, name: string, isMobile: boolean) => {
  if (isMobile && !MOBILE_SET.has(name)) return;
  await settle(page);
  // JPEG keeps the documentation set small enough to live in the repository.
  await page.screenshot({ path: `docs/screenshots/${isMobile ? 'mobile' : 'desktop'}-${name}.jpg`, type: 'jpeg', quality: 72 });
};

test('lookup, question, re-evaluation and evidence', async ({ page, isMobile }) => {
  await openDemo(page);
  await shot(page, '01-start', isMobile);
  // The implemented API's own example: SYNTH-003 on 2026-11-15.
  await selectProperty(page, '3 Test Street');
  await page.getByRole('button', { name: 'Nov 15, 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
  await shot(page, '02-lookup-unknown', isMobile);
  await page.getByRole('heading', { name: /Useful questions/ }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, -90);
  await shot(page, '03-useful-question', isMobile);
  await page.getByRole('article').getByRole('textbox').fill('12');
  await page.getByRole('button', { name: 'Apply answer' }).click();
  await expect(page.getByRole('region', { name: 'Re-evaluated with your answers' })).toBeVisible();
  await page.waitForTimeout(700);
  await shot(page, '04-reevaluated', isMobile);
  const panel = await openEvidence(page);
  await panel.getByRole('button', { name: 'Show surrounding text' }).first().click();
  await shot(page, '05-evidence-source', isMobile);
  await panel.getByRole('tab', { name: 'Encoded rule' }).click();
  await shot(page, '06-evidence-encoded', isMobile);
  await panel.getByRole('tab', { name: /Checks/ }).click();
  await shot(page, '07-evidence-checks', isMobile);
});

test('a case that stays unknown', async ({ page, isMobile }) => {
  await openDemo(page);
  await openCase(page, 'Two unresolved exemptions');
  await page.getByRole('textbox', { name: "What is the property's certificate of occupancy?" }).fill('2020-06-30');
  await page.getByRole('button', { name: 'Apply answer' }).click();
  await expect(page.getByRole('region', { name: 'Re-evaluated with your answers' })).toBeVisible();
  await page.waitForTimeout(700);
  await shot(page, '08-stays-unknown', isMobile);
  await page.getByRole('heading', { name: /What remains uncertain/ }).evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await shot(page, '09-remaining-uncertainty', isMobile);
});

test('changes: comparison and blocked scenario', async ({ page, isMobile }) => {
  await openDemo(page, '#/changes?mode=demo');
  await page.getByRole('button', { name: 'Oct 1, 2026 → Nov 15, 2026', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Comparison result' })).toBeVisible();
  await page.getByRole('group', { name: 'Comparison context' }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, -70);
  await shot(page, '10-changes-comparison', isMobile);
  await page.getByRole('button', { name: 'Scenario T1', exact: true }).click();
  await expect(page.getByText('Blocked: this comparison could not be established')).toBeVisible();
  await page.getByRole('group', { name: 'Comparison context' }).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, -70);
  await shot(page, '11-changes-blocked', isMobile);
});

test('evidence failure: missing source support', async ({ page, isMobile }) => {
  await openDemo(page);
  await openCase(page, 'Missing source support');
  const panel = await openEvidence(page);
  await panel.getByRole('tab', { name: /Checks/ }).click();
  await shot(page, '14-evidence-failure', isMobile);
});

test('live API with no backend, and extraction unavailable', async ({ page, isMobile }) => {
  await mockApi(page, { 'GET /health': () => 'abort', 'GET /addresses': () => 'abort' });
  await page.goto('/#/lookup?mode=live');
  await expect(page.getByText('The service could not be reached').first()).toBeVisible();
  await shot(page, '12-live-unreachable', isMobile);
});

test('ordinary lookup at the contract default date', async ({ page, isMobile }) => {
  await openDemo(page);
  await selectProperty(page, '1 Test Street');
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
  await shot(page, '13-not-yet-effective', isMobile);
});
