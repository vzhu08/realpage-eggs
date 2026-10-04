/**
 * FIXTURE / MOCKED CHECKS of live mode. Every /api/v1 request is intercepted with page.route
 * and answered from the checked-in contract examples (contracts/examples, contracts/
 * evidence_examples). These tests show what the interface does with contract-shaped responses,
 * delays and failures. They are NOT checks of the actual API: no backend runs here. The checks
 * that need a real backend are listed in docs/QA_HACKATHON.md.
 */
import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import {
  type Handler,
  banner,
  clone,
  comparisonResult,
  contract,
  contractHandlers,
  defect,
  fullText,
  gate,
  health,
  mockLive,
  openLive,
  packageFileName,
  packageFor,
  resultContext,
  runLiveLookup,
  settle,
  shownDate,
} from './hackathon-helpers';

const REQUEST: { address_id: string; as_of: string } = contract.assist.request;
const STREET: string = contract.assist.response.lookup.address.raw_address.street_address;
const QUESTION = contract.assist.response.question_plan.questions[0];
/** The one answer the evidence-package example was recorded with. */
const ANSWER: { field: string; value: number } = contract.propertyPackage.response.response.answers_applied[0];

/**
 * A transport can deliver a response after the page has withdrawn the request. Dropping the
 * abort signal makes every held response arrive late, so the page's own stale-response guards
 * are what is tested, not fetch's.
 */
const deliverLateResponses = (page: Page) =>
  page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => original(input, { ...init, signal: undefined });
  });

const packageReply = (body: unknown) => {
  const pack = packageFor(body);
  return { pack, text: JSON.stringify(pack), headers: { 'Content-Disposition': `attachment; filename="${packageFileName(pack)}"`, 'Cache-Control': 'no-store' } };
};

async function answerTheQuestion(page: Page) {
  const card = page.locator(`[data-question="${QUESTION.question_id}"]`);
  await card.getByRole('textbox').fill(String(ANSWER.value));
  await card.getByRole('button', { name: 'Apply answer' }).click();
  await expect(page.getByRole('region', { name: /^Your answers/ }).locator(`[data-field="${ANSWER.field}"]`)).toContainText('Applied');
}

const keep = (page: Page) => page.getByRole('region', { name: 'Keep this result' });
const packageCard = (page: Page) => keep(page).getByRole('article', { name: 'Evidence package' });

test.describe('mocked live API (fixture check) · step 8: the evidence package', () => {
  test('"Download evidence package" POSTs the displayed property, date and every request-local answer, and saves the service\'s response under the service\'s file name', async ({ page }, testInfo) => {
    let served = '';
    let expectedName = '';
    const calls = await mockLive(page, {
      ...contractHandlers(),
      'POST /lookup/evidence-package': ({ body }) => {
        const reply = packageReply(body);
        served = reply.text;
        expectedName = packageFileName(reply.pack);
        return { text: reply.text, headers: reply.headers };
      },
    });
    await openLive(page);
    await expect(banner(page)).toHaveCount(0);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await answerTheQuestion(page);

    // The section states exactly which request the package will be for.
    await expect(keep(page)).toContainText(REQUEST.address_id);
    await expect(keep(page)).toContainText(`as of ${shownDate(REQUEST.as_of)}`);
    await expect(keep(page)).toContainText('1 request-local answer');
    await expect(resultContext(page)).toContainText(`As of ${shownDate(REQUEST.as_of)}`);

    const [download] = await Promise.all([page.waitForEvent('download'), packageCard(page).getByRole('button', { name: 'Download evidence package' }).click()]);

    // One request, for the request on screen: the saved property, the displayed date, the answer with its provenance.
    const sent = calls.filter((call) => call.path === '/lookup/evidence-package');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.method).toBe('POST');
    expect(sent[0]!.body).toEqual({ address_id: REQUEST.address_id, as_of: REQUEST.as_of, answers: [{ field: ANSWER.field, value: ANSWER.value, provenance: 'user_provided' }] });

    // The file is the service's response, byte for byte, under the service's file name.
    expect(download.suggestedFilename()).toBe(expectedName);
    expect(expectedName).toMatch(/^evidence-package-[0-9a-f]{12}\.json$/);
    const path = testInfo.outputPath('package.json');
    await download.saveAs(path);
    expect(readFileSync(path, 'utf8')).toBe(served);

    // The receipt names the file, the artifact label in words and as sent, and the disclaimer.
    const pack = JSON.parse(served);
    const receipt = packageCard(page).getByRole('status').filter({ hasText: 'Saved as' });
    await expect(receipt).toContainText(expectedName);
    await expect(receipt).toContainText(pack.artifact_label);
    await expect(receipt).toContainText(/Synthetic data · not for submission/);
    await expect(receipt).toContainText(pack.disclaimer);
    // Hashes and limitations are one disclosure away, not on the reading path.
    await expect(receipt.getByText(pack.package_sha256)).toBeHidden();
    const text = await fullText(receipt);
    for (const hash of [pack.package_sha256, pack.input_sha256, pack.response_sha256]) expect(text).toContain(hash);
    for (const limitation of pack.limitations) expect(text).toContain(limitation);
    expect(text).toMatch(/Hashes identify content; they are not signatures/);

    // The working export stays a separate thing with a different name.
    const [working] = await Promise.all([page.waitForEvent('download'), keep(page).getByRole('button', { name: 'Download working export (JSON)' }).click()]);
    expect(working.suggestedFilename()).not.toBe(expectedName);
    expect(working.suggestedFilename()).toMatch(/working-export/);
    // In it, the answer is a request-local answer with its provenance, not a stored fact.
    const workingPath = testInfo.outputPath('working.json');
    await working.saveAs(workingPath);
    const file = JSON.parse(readFileSync(workingPath, 'utf8'));
    expect(file.request_answers.answers).toEqual([expect.objectContaining({ field: ANSWER.field, value: ANSWER.value, provenance: 'user_provided', disposition: 'applied' })]);
    expect(file.stored_facts.facts).not.toHaveProperty(ANSWER.field);
    expect(file.data_origin.mode).toBe('live');
  });

  // DEFECT (major, lane A: features/property/PropertySummary.tsx).
  // Reproduction (needs a contract-true service; the demo replay does not reproduce it): live mode,
  // SYNTH-003 on 2026-11-15, answer units = 8. The service echoes the request-local value into
  // lookup.address.facts (contracts/evidence_examples/property_package.json: facts.units = 8 with
  // provenance "Demo answer (synthetic scenario)"). The property header then shows "Units 8" as a
  // plain cell beside "Residential Yes" — an unverified answer presented like a recorded fact. Its
  // provenance is only inside the collapsed "Property record" disclosure.
  defect('DEFECT: mocked live API (fixture check): a request-local answer echoed into the property facts is labeled as an unverified answer in the property header (repro: live SYNTH-003, 2026-11-15, units = 8 → header cell "Units 8" with no label)', async ({ page }) => {
    await mockLive(page, contractHandlers());
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await answerTheQuestion(page);
    const facts = page.locator('[data-jurisdiction]').locator('xpath=..');
    const cell = facts.locator('> div').filter({ has: page.getByRole('term').filter({ hasText: new RegExp(`^${ANSWER.field}$`, 'i') }) });
    await expect(cell).toContainText(String(ANSWER.value));
    await expect(cell).toContainText(/unverified|your answer|this request/i);
  });

  // DEFECT (major, lane B: features/lookup/KeepResult.tsx → lib/exportPackage.ts).
  // Reproduction: live mode, SYNTH-003 on 2026-11-15, answer units = 8, then change the date control
  // without running the lookup, then "Download working export (JSON)". The session's answers were
  // cleared by the date change, so the file has request_answers.answers = [] and lists units = 8 under
  // stored_facts.facts: an unverified request-local answer exported as a stored property fact.
  defect('DEFECT: mocked live API (fixture check): a working export never lists a request-local answer as a stored fact (repro: live, answer units = 8 → change date, no rerun → export has stored_facts.facts.units = 8 and no request answers)', async ({ page }, testInfo) => {
    await mockLive(page, contractHandlers());
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await answerTheQuestion(page);
    await page.getByLabel('As of date').fill('2026-12-01');
    await expect(page.getByRole('note').filter({ hasText: 'These results are for' })).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), keep(page).getByRole('button', { name: 'Download working export (JSON)' }).click()]);
    const path = testInfo.outputPath('stale-working.json');
    await download.saveAs(path);
    const file = JSON.parse(readFileSync(path, 'utf8'));
    expect(file.query.as_of).toBe(REQUEST.as_of);
    expect(file.stored_facts.facts).not.toHaveProperty(ANSWER.field);
    expect(file.request_answers.answers.map((answer: { field: string; value: unknown }) => [answer.field, answer.value])).toEqual([[ANSWER.field, ANSWER.value]]);
  });

  test('with no answers the package request carries an empty answers list', async ({ page }) => {
    const calls = await mockLive(page, { ...contractHandlers(), 'POST /lookup/evidence-package': ({ body }) => packageReply(body) });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await expect(keep(page)).toContainText('no answers');
    await Promise.all([page.waitForEvent('download'), packageCard(page).getByRole('button', { name: 'Download evidence package' }).click()]);
    expect(calls.find((call) => call.path === '/lookup/evidence-package')!.body).toEqual({ address_id: REQUEST.address_id, as_of: REQUEST.as_of, answers: [] });
  });

  test('a package that arrives after the result changed is not saved: the answer is removed while the package is being built', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    let packageRequests = 0;
    await mockLive(page, {
      ...contractHandlers(),
      'POST /lookup/evidence-package': async ({ body }) => {
        packageRequests += 1;
        await held.wait;
        return packageReply(body);
      },
    });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await answerTheQuestion(page);

    await packageCard(page).getByRole('button', { name: 'Download evidence package' }).click();
    // Truthful waiting: it says the service is assembling the package, and offers a way out.
    await expect(packageCard(page)).toHaveAttribute('data-package', 'loading');
    await expect(packageCard(page).getByRole('status')).toContainText('The service is assembling the package');
    await expect(packageCard(page).getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect.poll(() => packageRequests).toBe(1);

    // The result changes under the pending request.
    await page.getByRole('region', { name: /^Your answers/ }).getByRole('button', { name: /^Remove/ }).click();
    await expect(keep(page)).toContainText('no answers');
    await expect(packageCard(page)).toHaveAttribute('data-package', 'idle');

    const late = page.waitForResponse((response) => response.url().includes('/lookup/evidence-package'));
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);

    expect(downloads).toBe(0);
    await expect(packageCard(page)).toHaveAttribute('data-package', 'idle');
    await expect(packageCard(page).getByText(/Saved as/)).toHaveCount(0);
  });

  test('Cancel withdraws a package request; a response that still arrives is not saved', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await mockLive(page, {
      ...contractHandlers(),
      'POST /lookup/evidence-package': async ({ body }) => {
        await held.wait;
        return packageReply(body);
      },
    });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await packageCard(page).getByRole('button', { name: 'Download evidence package' }).click();
    await packageCard(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(packageCard(page)).toHaveAttribute('data-package', 'idle');

    const late = page.waitForResponse((response) => response.url().includes('/lookup/evidence-package'));
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);
    await expect(packageCard(page).getByText(/Saved as/)).toHaveCount(0);
    await expect(packageCard(page).getByRole('button', { name: 'Download evidence package' })).toBeEnabled();
  });

  test('a package for a different request than the one on screen is refused and nothing is saved', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    // The unmodified example describes a request WITH one answer; the screen has none.
    await mockLive(page, { ...contractHandlers(), 'POST /lookup/evidence-package': () => ({ json: contract.propertyPackage.response }) });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await packageCard(page).getByRole('button', { name: 'Download evidence package' }).click();
    const alert = packageCard(page).getByRole('alert');
    await expect(alert).toContainText('different property, date or set of answers');
    await expect(alert).toContainText('Nothing was saved.');
    expect(downloads).toBe(0);
  });

  test('a failed or missing package route says so, saves nothing, and leaves the result on screen', async ({ page }) => {
    let mode: '503' | '404' = '503';
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await mockLive(page, {
      ...contractHandlers(),
      'POST /lookup/evidence-package': () => (mode === '503' ? { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Test double: dataset unavailable' } } } : { status: 404, json: { detail: 'Not Found' } }),
    });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    const button = packageCard(page).getByRole('button', { name: 'Download evidence package' });

    await button.click();
    const unavailable = packageCard(page).getByRole('alert');
    await expect(unavailable).toContainText('The dataset is not ready');
    await expect(unavailable).toContainText('Test double: dataset unavailable');
    await expect(unavailable).toContainText('Nothing was saved. The result on screen is unaffected.');
    await expect(unavailable.getByRole('button', { name: 'Try again' })).toBeVisible();

    mode = '404';
    await button.click();
    const missing = packageCard(page).getByRole('alert');
    await expect(missing).toContainText('This capability is not available on the connected backend');
    await expect(missing).toContainText('The working export beside it is still available.');

    expect(downloads).toBe(0);
    await expect(page.locator('[data-rule-id][data-result]')).toHaveCount(contract.assist.response.lookup.evaluations.length);
    await expect(banner(page)).toHaveCount(0);
  });
});

const summaryRequest: { before: string; after: string } = contract.changeSummary.request;
const summaryResponse = contract.changeSummary.response;

async function compareDates(page: Page) {
  await page.getByLabel('From date').fill(summaryRequest.before);
  await page.getByLabel('To date').fill(summaryRequest.after);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
}

async function expectTotals(page: Page, result: typeof summaryResponse.result) {
  const article = comparisonResult(page);
  await expect(article).toHaveAttribute('data-status', result.status);
  await expect(article.locator('[data-impact="Definitely affected"]')).toHaveAttribute('data-count', String(result.affected_address_ids.length));
  await expect(article.locator('[data-impact="Uncertain"]')).toHaveAttribute('data-count', String(result.uncertain_address_ids.length));
  await expect(article.locator('[data-impact="Conflict flagged"]')).toHaveAttribute('data-count', String(result.conflict_flag_address_ids.length));
}

test.describe('mocked live API (fixture check) · step 6: portfolio comparison states', () => {
  test('a slow POST /changes/summary shows a truthful wait with elapsed time and a working Cancel; a late response never appears', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    const calls = await mockLive(page, {
      ...contractHandlers(),
      'POST /changes/summary': async ({ call }) => {
        if (call === 1) await held.wait;
        return { json: summaryResponse };
      },
    });
    await openLive(page, '#/changes?mode=live');
    await compareDates(page);

    const waiting = page.locator('[data-waiting]');
    await expect(waiting).toBeVisible();
    await expect(waiting).toContainText(/Comparing… \d+ s/);
    // The clock moves; it is elapsed time, not a progress estimate.
    await expect(waiting).toContainText(/Comparing… [1-9]\d* s/, { timeout: 6000 });
    await expect(waiting).toContainText('Nothing is shown until it answers.');
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    expect(await fullText(waiting)).not.toMatch(/\d\s?%|almost|remaining/i);
    // Nothing stands in for the result while waiting.
    await expect(comparisonResult(page)).toHaveCount(0);
    await expect(page.locator('[data-impact]')).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);

    await waiting.getByRole('button', { name: 'Cancel' }).click();
    await expect(waiting).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The withdrawn comparison answers late; it must not appear.
    const late = page.waitForResponse((response) => response.url().includes('/changes/summary'));
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);
    await expect(comparisonResult(page)).toHaveCount(0);

    // Asking again works and shows the service's own lists.
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expectTotals(page, summaryResponse.result);
    expect(calls.filter((call) => call.path === '/changes/summary')).toHaveLength(2);
    expect(calls.filter((call) => call.path === '/changes')).toHaveLength(0);
  });

  test('editing the dates while a comparison is running withdraws it; its late response does not replace the newer comparison', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    // The second request is answered with the same example relabeled for the dates it asked for.
    await mockLive(page, {
      ...contractHandlers(),
      'POST /changes/summary': async ({ call, body }) => {
        if (call === 1) {
          await held.wait;
          return { json: summaryResponse };
        }
        const later = clone(summaryResponse);
        later.result.before = body.before;
        later.result.after = body.after;
        return { json: later };
      },
    });
    await openLive(page, '#/changes?mode=live');
    await compareDates(page);
    await expect(page.locator('[data-waiting]')).toBeVisible();

    const otherAfter = '2026-12-31';
    await page.getByLabel('To date').fill(otherAfter);
    await expect(page.locator('[data-waiting]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const context = page.getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText(shownDate(otherAfter));

    const late = page.waitForResponse((response) => response.url().includes('/changes/summary') && response.request().postDataJSON().after === summaryRequest.after);
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);
    await expect(context).toContainText(shownDate(otherAfter));
    await expect(context).not.toContainText(shownDate(summaryRequest.after));
  });

  test('when POST /changes/summary is missing (404) the comparison comes from POST /changes and the page says so', async ({ page }) => {
    const calls = await mockLive(page, { ...contractHandlers(), 'POST /changes': () => ({ json: summaryResponse.result }) });
    await openLive(page, '#/changes?mode=live');
    await compareDates(page);

    await expectTotals(page, summaryResponse.result);
    const notice = comparisonResult(page).getByRole('status').filter({ hasText: 'POST /changes/summary is not available on this backend' });
    await expect(notice).toContainText('The comparison comes from POST /changes');
    await expect(resultContextOf(page)).toContainText('Live API');
    expect(await fullText(comparisonResult(page))).toMatch(/POST \S*\/changes(?!\/summary)/);
    await expect(banner(page)).toHaveCount(0);
    expect(calls.filter((call) => call.path === '/changes/summary')).toHaveLength(1);
    expect(calls.filter((call) => call.path === '/changes')).toHaveLength(1);
    expect(calls.find((call) => call.path === '/changes')!.body).toMatchObject(summaryRequest);

    // The missing route is probed once, not on every comparison.
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expectTotals(page, summaryResponse.result);
    await expect.poll(() => calls.filter((call) => call.path === '/changes').length).toBe(2);
    expect(calls.filter((call) => call.path === '/changes/summary')).toHaveLength(1);
  });

  test('a blocked comparison from the service is shown as blocked with its notes, never as zero', async ({ page }) => {
    const blocked = clone(summaryResponse);
    blocked.result = { ...blocked.result, status: 'blocked', affected_address_ids: [], uncertain_address_ids: [], conflict_flag_address_ids: [], differences: {}, notes: ['Test double: missing extracted legal evidence; the comparison cannot be established'] };
    blocked.by_jurisdiction = {};
    blocked.by_category = {};
    await mockLive(page, { ...contractHandlers(), 'POST /changes/summary': () => ({ json: blocked }) });
    await openLive(page, '#/changes?mode=live');
    await compareDates(page);

    const article = comparisonResult(page);
    await expect(article).toHaveAttribute('data-status', 'blocked');
    await expect(article.getByRole('status').filter({ hasText: 'Blocked: this comparison could not be established' })).toContainText(blocked.result.notes[0]);
    for (const column of await article.locator('[data-impact]').all()) {
      await expect(column).toHaveAttribute('data-count', 'blocked');
      await expect(column).not.toContainText(/\b0\b/);
    }
    await expect(article).not.toContainText('No differences between these dates');
  });

  test('a failed comparison is an error with what it does not mean, not an empty result and not demo data', async ({ page }) => {
    let reply: 'unavailable' | 'server' | 'down' = 'unavailable';
    const failing: Handler = () =>
      reply === 'unavailable' ? { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Test double: no completed extraction' } } } : reply === 'server' ? { status: 500, json: { detail: 'Test double: internal error' } } : 'abort';
    await mockLive(page, { ...contractHandlers(), 'POST /changes/summary': failing });
    await openLive(page, '#/changes?mode=live');
    await compareDates(page);

    const unavailable = page.getByRole('alert').filter({ hasText: 'The dataset is not ready' });
    await expect(unavailable).toContainText('Test double: no completed extraction');
    await expect(unavailable).toContainText('This is a service state, not an empty result.');
    await expect(comparisonResult(page)).toHaveCount(0);

    reply = 'server';
    await unavailable.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The service returned an error' })).toContainText('Test double: internal error');

    reply = 'down';
    await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The service could not be reached' })).toBeVisible();

    await expect(comparisonResult(page)).toHaveCount(0);
    await expect(page.locator('[data-impact]')).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Live API' })).toBeChecked();
  });
});

const resultContextOf = (page: Page) => page.getByRole('group', { name: 'Comparison context' });

test.describe('mocked live API (fixture check) · step 7: GET /source-comparisons states', () => {
  const comparisons = contract.claimComparison.response;

  test('an available response lists the service\'s observations, including a claim with no captured support', async ({ page }) => {
    await mockLive(page, { ...contractHandlers(), 'GET /source-comparisons': () => ({ json: comparisons }) });
    await openLive(page, '#/disagreements?mode=live');
    const section = page.locator('[data-comparisons]');
    await expect(section).toHaveAttribute('data-comparisons', 'ready');
    const observations = Object.entries(comparisons.observations) as Array<[string, any]>;
    await expect(section.locator('[data-comparison]')).toHaveCount(observations.length);
    for (const [id, observation] of observations) {
      const card = section.locator(`[data-comparison="${id}"]`);
      await expect(card).toHaveAttribute('data-classification', observation.classification);
      await expect(card).toContainText('No source is preferred');
      await expect(card).toContainText('Meaning not checked');
      await expect(card.getByRole('region', { name: 'What would resolve it' })).toContainText(observation.remedy);
      for (const key of ['before', 'after'] as const) {
        const side = card.locator(`[data-side="${key}"]`);
        if (observation[key].support.length === 0) await expect(side).toContainText('No captured passage supports this claim');
        else for (const support of observation[key].support) await expect(side.locator('blockquote').filter({ hasText: support.span.text })).toHaveCount(1);
      }
    }
    await expect(section).toContainText('Live API');
    await expect(banner(page)).toHaveCount(0);
  });

  test('status "unavailable" is reported as an absence of comparisons, not as agreement', async ({ page }) => {
    const unavailable = { ...clone(comparisons), status: 'unavailable', observations: {}, annotation_sha256: null, source_hashes: {}, notes: ['Test double: no source_comparisons.json in the selected snapshot'] };
    await mockLive(page, { ...contractHandlers(), 'GET /source-comparisons': () => ({ json: unavailable }) });
    await openLive(page, '#/disagreements?mode=live');
    const section = page.locator('[data-comparisons]');
    await expect(section).toHaveAttribute('data-comparisons', 'ready');
    await expect(section).toContainText('No claim comparisons are saved with this snapshot');
    await expect(section).toContainText('That is an absence of comparisons, not a finding that the sources agree.');
    await expect(section).toContainText(unavailable.notes[0]!);
    await expect(section.locator('[data-comparison]')).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
  });

  test('an error, an unreachable service or a missing route each say what happened; no recorded comparison is substituted', async ({ page }) => {
    let reply: '503' | 'down' | '404' = '503';
    await mockLive(page, {
      ...contractHandlers(),
      'GET /source-comparisons': () => (reply === '503' ? { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Test double: dataset unavailable' } } } : reply === 'down' ? 'abort' : { status: 404, json: { detail: 'Not Found' } }),
    });
    await openLive(page, '#/disagreements?mode=live');
    const section = page.locator('[data-comparisons]');

    const unavailable = section.getByRole('alert');
    await expect(unavailable).toContainText('The dataset is not ready');
    await expect(unavailable).toContainText('This is a service state, not a finding that the sources agree.');

    reply = 'down';
    await unavailable.getByRole('button', { name: 'Try again' }).click();
    await expect(section.getByRole('alert')).toContainText('The service could not be reached');

    reply = '404';
    await section.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
    await expect(section.getByRole('alert')).toContainText('This backend has no GET /source-comparisons route');

    await expect(section.locator('[data-comparison]')).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Live API' })).toBeChecked();
  });
});

test.describe('mocked live API (fixture check) · lookup states', () => {
  test('loading names the date being looked up; an empty result is not "no law applies"; a failure is not "no rules apply"', async ({ page }) => {
    const held = gate();
    let fail = false;
    await mockLive(page, {
      ...contractHandlers(),
      // No assist route on this double: the page must say it fell back to POST /lookup.
      'POST /lookup/assist': () => ({ status: 404, json: { detail: 'Not Found' } }),
      'POST /lookup': async ({ body, call }) => {
        if (call === 1) await held.wait;
        if (fail) return { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Test double: no completed extraction' } } };
        return { json: { ...clone(contract.empty.response), as_of: body.as_of } };
      },
    });
    await openLive(page);
    const empty = contract.empty.response;
    await page.getByRole('list', { name: 'Sample properties' }).getByRole('button', { name: new RegExp(empty.address.raw_address.street_address) }).click();
    await page.getByLabel('As of date').fill(empty.as_of);
    await page.getByRole('button', { name: /^Run lookup/ }).click();

    // Loading: a labeled wait, no result and no counts yet.
    await expect(page.getByRole('status').filter({ hasText: `Looking up rules as of ${shownDate(empty.as_of)}` })).toBeAttached();
    await expect(resultContext(page)).toHaveCount(0);
    held.open();

    // Empty: stated as a property of the extracted dataset.
    await expect(resultContext(page)).toContainText(`As of ${shownDate(empty.as_of)}`);
    await expect(page.getByText('No rules were returned for this property on this date')).toBeVisible();
    await expect(page.getByText(/it is not a statement that no law applies/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Results by status' })).toHaveCount(0);
    await expect(page.getByText('Question planning is not available on this backend')).toBeVisible();

    // Failure: an error that says what it does not mean; the earlier result is gone, not kept as if current.
    fail = true;
    await page.getByRole('button', { name: /^Run lookup/ }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The dataset is not ready' });
    await expect(alert).toContainText('It does not mean that no rules apply to this property.');
    await expect(resultContext(page)).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
  });

  test('partial data and a synthetic dataset label from the service stay on the result', async ({ page }) => {
    const partial = clone(contract.assist.response);
    partial.lookup.metadata = { ...partial.lookup.metadata, partial_data: true, missing_source_ids: ['TEST-DOC-1', 'TEST-DOC-2'], unprocessed_source_ids: ['TEST-DOC-3'] };
    await mockLive(page, { ...contractHandlers(), 'POST /lookup/assist': () => ({ json: partial }) });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    await expect(resultContext(page)).toContainText('Partial data');
    // The service says this dataset is synthetic, so a live result is labeled synthetic too.
    await expect(resultContext(page)).toContainText('Synthetic data · not actual law');
    await expect(resultContext(page)).toContainText('Live API');
    const notice = page.getByRole('note').filter({ hasText: 'Partial data: this result can be incomplete' });
    await expect(notice).toContainText('2 source documents have no captured text.');
    await expect(notice).toContainText('1 source documents have not completed extraction.');
    await expect(notice).toContainText('Missing sources are a coverage gap, not evidence that no law applies.');
  });
});

test.describe('live mode with no backend (the test server answers /api with an empty 500)', () => {
  test('says the service cannot be reached, shows no recorded example, and offers the demo only as an explicit, labeled choice', async ({ page }) => {
    await openLive(page);
    const alert = page.getByRole('alert').filter({ hasText: 'The service could not be reached' }).first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('The synthetic demo is a separate, labeled mode; it is never used automatically.');
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator('[data-example]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'API not reachable' })).toBeVisible();

    await alert.getByRole('button', { name: 'Open the synthetic demo' }).click();
    await expect(banner(page)).toBeVisible();
    await expect(page).toHaveURL(/mode=demo/);
    await expect(page.locator('[data-example]')).toHaveCount(3);
  });

  test('a healthy but partial dataset is announced above every view', async ({ page }) => {
    // Test-double counts; the sentence on screen must be computed from them.
    const counts = { rules: 140, sources: 87, addresses: 500, resolved_municipalities: 487 };
    await mockLive(page, { ...contractHandlers(), 'GET /health': () => ({ json: health({ dataset_readiness: 'partial', last_extraction_outcome: 'partial', ...counts }) }) });
    for (const hash of ['#/lookup?mode=live', '#/changes?mode=live', '#/disagreements?mode=live']) {
      await openLive(page, hash);
      const notice = page.getByRole('note').filter({ hasText: 'Partial dataset' });
      await expect(notice).toContainText('Coverage is incomplete, so an unlisted rule has not been ruled out.');
      await expect(notice).toContainText(`${counts.rules} rules are extracted from ${counts.sources} sources`);
      await expect(notice).toContainText(`${counts.addresses - counts.resolved_municipalities} of ${counts.addresses} sample properties have no resolved municipality`);
    }
  });
});
