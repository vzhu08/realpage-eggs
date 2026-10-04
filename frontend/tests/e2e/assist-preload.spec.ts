import { test, expect } from '@playwright/test';
import { baseHandlers, examples, mockApi, clone } from './helpers';

test('cancelled analysis and property changes cannot display a stale completion', async ({ page }) => {
  await mockApi(page, baseHandlers());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route('**/api/v1/lookup/assist', async (route) => {
    requests++;
    await gate;
    await route.fulfill({ json: examples.assist.response }).catch(() => undefined);
  });
  await page.goto('/#/lookup?mode=live&address=SYNTH-003&as_of=2026-11-15');
  await page.getByRole('button', { name: 'Run lookup', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Looking up…', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel analysis', exact: true }).click();
  await expect(page.getByText(/Analysis cancelled/)).toBeVisible();
  release();
  await expect(page.locator('#outcome-heading')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Run lookup', exact: true })).toBeEnabled();
  expect(requests).toBe(1);
});

test('server results keep partial states and closed evidence remains available when opened', async ({ page }) => {
  const response = clone(examples.assist.response);
  response.question_plan.status = 'partial';
  response.question_plan.exhaustive = false;
  response.question_plan.limits_hit = ['max_evaluations'];
  // Exercise the large-result lazy path without a large fixture on disk.
  response.question_plan.remaining_uncertainty[0]!.source_refs.push({
    doc_id: 'SYNTHETIC-LARGE', start: 0, end: 66000,
    text: 'Synthetic large quote. '.repeat(3000), source_hash: '0'.repeat(64),
  });
  await mockApi(page, { ...baseHandlers(), 'POST /lookup/assist': ({ body }) => ({ json: { ...response, answers_applied: body.answers } }) });
  await page.goto('/#/lookup?mode=live&address=SYNTH-003&as_of=2026-11-15');
  await page.getByRole('button', { name: 'Run lookup', exact: true }).click();
  await expect(page.locator('#outcome-heading')).toBeVisible();
  await expect(page.getByText(/does not claim.*exhaustive/)).toBeVisible();
  const evidence = page.locator('.uncertainty__original').first();
  await expect(evidence.locator('.disclosure__content')).toHaveCount(0);
  await evidence.locator('summary').click();
  await expect(evidence.locator('.disclosure__content')).toBeVisible();
});
