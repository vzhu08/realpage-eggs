import { expect, test, type Page, type Request } from '@playwright/test';
import { baseHandlers, clone, examples, mockApi, openLive, ruleRow, selectProperty } from './helpers';

/** Hold a lookup while allowing later requests to finish first. */
async function delayedLookup(page: Page, completion: 'success' | 'failure', holdRequest = 1) {
  // A transport can finish after cancellation. Exercise the session's own stale-response
  // guard instead of relying on fetch to discard the canceled network response.
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => fetch(input, { ...init, signal: undefined });
  });
  await mockApi(page, baseHandlers());
  let release!: () => void;
  let received!: () => void;
  let heldRequest!: Request;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { received = resolve; });
  const calls: { address_id: string; as_of: string; answers: { field: string; value: unknown }[] }[] = [];
  await page.route('**/api/v1/lookup/assist', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const held = calls.length === holdRequest;
    if (held) {
      heldRequest = route.request();
      received();
      await pending;
    }
    if (held && completion === 'failure') {
      await route.fulfill({ status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Delayed failure from the previous lookup' } } });
      return;
    }
    // Responses are explicitly synthetic API doubles, adapted only to the requested context.
    const response = clone(examples.decisive.response);
    response.lookup = clone(body.address_id === 'SYNTH-002' ? examples.empty.response : examples.unknown.response);
    response.lookup.as_of = body.as_of;
    response.answers_applied = body.answers;
    if (body.address_id === 'SYNTH-002') response.question_plan.questions = [];
    if (body.answers.length) {
      response.lookup.evaluations[0].result = 'applies';
      response.question_plan.questions = [];
    }
    await route.fulfill({ json: response });
  });
  return {
    started,
    calls,
    finish: async () => {
      const returned = page.waitForResponse((response) => response.request() === heldRequest);
      release();
      await (await returned).finished();
      // Let the response's promise handlers and React render finish before asserting absence.
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    },
  };
}

for (const completion of ['success', 'failure'] as const) {
  for (const change of ['property', 'date'] as const) {
    test(`changing ${change} discards a delayed lookup ${completion} and permits a fresh lookup`, async ({ page }) => {
      const delayed = await delayedLookup(page, completion);
      await openLive(page);
      await selectProperty(page, '3 Test Street');
      await page.getByLabel('As of date').fill('2026-11-15');
      await page.getByRole('button', { name: 'Run lookup', exact: true }).click();
      await delayed.started;

      if (change === 'property') await selectProperty(page, '2 Test Street');
      else await page.getByLabel('As of date').fill('2027-01-01');
      const run = page.getByRole('button', { name: 'Run lookup', exact: true });
      await expect(run).toBeEnabled();
      await expect(page.locator('.results')).toHaveCount(0);
      await delayed.finish();
      await expect(page.locator('.results')).toHaveCount(0);
      await expect(page.getByText('Delayed failure from the previous lookup')).toHaveCount(0);
      await expect(run).toBeEnabled();
      await run.click();
      await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
      if (change === 'property') await expect(page.locator('.rule')).toHaveCount(0);
      else await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Jan 1, 2027');
      await expect(page.getByRole('button', { name: 'Run lookup again', exact: true })).toBeEnabled();
      expect(delayed.calls.map(({ address_id, as_of, answers }) => ({ address_id, as_of, answers }))).toEqual([
        { address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] },
        { address_id: change === 'property' ? 'SYNTH-002' : 'SYNTH-003', as_of: change === 'date' ? '2027-01-01' : '2026-11-15', answers: [] },
      ]);
    });
  }

  test(`changing date during answer reevaluation retains a labeled previous result after delayed ${completion}`, async ({ page }) => {
    const delayed = await delayedLookup(page, completion, 2);
    await openLive(page);
    await selectProperty(page, '3 Test Street');
    await page.getByLabel('As of date').fill('2026-11-15');
    await page.getByRole('button', { name: 'Run lookup', exact: true }).click();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    const question = page.getByRole('article', { name: "What is the property's units?" });
    await question.getByRole('textbox').fill('8');
    await question.getByRole('button', { name: 'Apply answer' }).click();
    await delayed.started;
    await page.getByLabel('As of date').fill('2027-01-01');
    const stale = page.getByText('The date above was changed and has not been looked up yet.');
    await expect(stale).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run lookup again', exact: true })).toBeEnabled();
    await delayed.finish();
    await expect(stale).toBeVisible();
    await expect(ruleRow(page)).toHaveAttribute('data-result', 'unknown');
    await expect(page.getByRole('region', { name: /Your answers/ })).toHaveCount(0);
    await expect(page.getByText('Delayed failure from the previous lookup')).toHaveCount(0);

    await page.getByRole('button', { name: 'Run lookup again', exact: true }).click();
    await expect(stale).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('Jan 1, 2027');
    expect(delayed.calls[2]).toEqual({ address_id: 'SYNTH-003', as_of: '2027-01-01', answers: [] });
  });
}
