/**
 * The evidence package download in the browser, against a mocked live service that answers
 * with the synthetic contract example (contracts/evidence_examples/property_package.json).
 */
import { expect, test } from '@playwright/test';
import {
  PACKAGE_NAME,
  type Reply,
  clone,
  contract,
  downloadPackageButton,
  downloadedText,
  expectNoSidewaysScroll,
  gate,
  leadQuestion,
  mapleHarbor,
  mockService,
  openLiveResult,
  packageCard,
  packageFor,
  packageReply,
  packageText,
  watchDownloads,
  workingCard,
} from './integration-helpers';

const PACKAGE = 'POST /lookup/evidence-package';
const packageCalls = (calls: Array<{ method: string; path: string; body: any }>) => calls.filter((call) => call.path === '/lookup/evidence-package');

test.describe('evidence package download (live API, mocked)', () => {
  test('downloads the service’s package for the result on screen, byte for byte, with its label, disclaimer and hashes', async ({ page }) => {
    let served = '';
    const calls = await mockService(
      page,
      mapleHarbor({
        [PACKAGE]: ({ body }) => {
          served = packageText(packageFor(body));
          return packageReply(packageFor(body));
        },
      }),
    );
    await openLiveResult(page);
    const card = packageCard(page);
    await expect(card).toContainText('Built by the service for exactly the result on screen');
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('3 Test Street · as of Nov 15, 2026 · no answers');

    // Answer the planner's question; the package must describe the answered result, not the first one.
    await leadQuestion(page).getByRole('textbox').fill('8');
    await leadQuestion(page).getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('1 answer of yours');

    // What will be sent is inspectable before anything is sent.
    const sent = card.locator('details', { hasText: 'What is sent to the service' });
    await expect(sent.locator('summary')).toBeVisible();
    await expect(card.getByText('SYNTH-003', { exact: true })).toBeHidden();
    await sent.locator('summary').click();
    await expect(sent).toContainText('POST /lookup/evidence-package');
    await expect(sent).toContainText('SYNTH-003');
    await expect(sent).toContainText('2026-11-15');
    await expect(sent).toContainText('units = 8 · user provided');
    expect(packageCalls(calls)).toHaveLength(0);

    const [download] = await Promise.all([page.waitForEvent('download'), downloadPackageButton(page).click()]);
    expect(packageCalls(calls)).toHaveLength(1);
    expect(packageCalls(calls)[0]!.body).toEqual({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: 8, provenance: 'user_provided' }] });
    expect(download.suggestedFilename()).toBe(PACKAGE_NAME);
    const saved = await downloadedText(download);
    expect(saved).toBe(served);
    expect(JSON.parse(saved).package_sha256).toBe(contract.package.response.package_sha256);

    const receipt = card.locator('.keep__receipt');
    await expect(receipt).toContainText(`Saved as ${PACKAGE_NAME}`);
    await expect(receipt).toContainText('exactly as the service sent it');
    // The label in words and raw; the package's own disclaimer.
    await expect(receipt).toContainText('Synthetic data · not for submission');
    await expect(receipt).toContainText('SYNTHETIC_NOT_FOR_SUBMISSION');
    await expect(receipt).toContainText(contract.package.response.disclaimer);
    await expect(receipt.locator('[data-package-contents]')).toContainText('1 rule, 1 source text, and the full response as of Nov 15, 2026 with 1 answer applied (units: 8, user provided)');
    // Hashes and limitations are one step away, not on the reading path.
    const detail = receipt.locator('details', { hasText: 'Hashes and limitations (6)' });
    await expect(receipt.getByText(contract.package.response.package_sha256)).toBeHidden();
    await detail.locator('summary').click();
    for (const hash of [contract.package.response.package_sha256, contract.package.response.input_sha256, contract.package.response.response_sha256, contract.package.response.code.fingerprint]) await expect(detail).toContainText(hash);
    for (const limitation of contract.package.response.limitations) await expect(detail).toContainText(limitation);
    await expect(detail).toContainText('Hashes identify content; they are not signatures.');
    // Nothing on the card claims more than the package does ("unverified" is the package's own word).
    await expect(card).not.toContainText(/\b(verified|certified|compliant|validated)\b/i);
    await expectNoSidewaysScroll(page);
  });

  test('an explicit “I don’t know” is sent as a null answer, and the research label is shown in words and raw', async ({ page }) => {
    const calls = await mockService(
      page,
      mapleHarbor({
        [PACKAGE]: ({ body }) => packageReply({ ...packageFor(body), artifact_label: 'RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION' }, { headers: { 'Content-Disposition': 'attachment; filename="../../evidence.json"' } }),
      }),
    );
    await openLiveResult(page);
    await leadQuestion(page).getByRole('button', { name: 'I don’t know' }).click();
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('1 answer of yours (1 marked unknown)');
    await packageCard(page).locator('details', { hasText: 'What is sent to the service' }).locator('summary').click();
    await expect(packageCard(page)).toContainText('units = unknown (sent as null) · user provided');

    const [download] = await Promise.all([page.waitForEvent('download'), downloadPackageButton(page).click()]);
    expect(packageCalls(calls)[0]!.body).toEqual({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: null, provenance: 'user_provided' }] });
    // A file name that is not a plain JSON name is not used.
    expect(download.suggestedFilename()).toBe('evidence-package.json');
    const receipt = packageCard(page).locator('.keep__receipt');
    await expect(receipt).toContainText('Research evidence · not legal validation');
    await expect(receipt).toContainText('RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION');
    await expect(receipt).toContainText('1 answer applied (units: unknown, user provided)');
    expect(JSON.parse(await downloadedText(download)).request.answers).toEqual([{ field: 'units', value: null, provenance: 'user_provided', note: null }]);
  });

  test('a package that arrives after the result changed is neither saved nor shown', async ({ page }) => {
    const hold = gate();
    const calls = await mockService(page, mapleHarbor({ [PACKAGE]: ({ body }) => packageReply(packageFor(body), { hold: hold.promise }) }));
    const downloads = watchDownloads(page);
    await openLiveResult(page);
    await downloadPackageButton(page).click();
    const card = packageCard(page);
    await expect(card.getByRole('button', { name: 'Building the package…' })).toBeDisabled();
    await expect(card.getByRole('status').filter({ hasText: 'The service is assembling the package' })).toBeVisible();
    expect(packageCalls(calls)[0]!.body).toEqual({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] });

    // The reader answers a question while the first package is still being built.
    await leadQuestion(page).getByRole('textbox').fill('8');
    await leadQuestion(page).getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('1 answer of yours');
    await expect(card.locator('[data-package-withdrawn]')).toContainText('withdrawn because the result was being updated. Nothing was saved.');
    hold.open();
    await page.waitForTimeout(600);
    expect(downloads).toHaveLength(0);
    await expect(card.locator('.keep__receipt')).toHaveCount(0);
    await expect(card).toHaveAttribute('data-package', 'idle');

    // Asking again sends the request for the result now on screen.
    const [download] = await Promise.all([page.waitForEvent('download'), downloadPackageButton(page).click()]);
    expect(packageCalls(calls).at(-1)!.body).toEqual({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: 8, provenance: 'user_provided' }] });
    expect(JSON.parse(await downloadedText(download)).request.answers).toEqual([{ field: 'units', value: 8, provenance: 'user_provided', note: null }]);
    await expect(card.locator('[data-package-withdrawn]')).toHaveCount(0);
    expect(downloads).toHaveLength(1);
  });

  test('a package that arrives after the page moved on, or after Cancel, is not saved', async ({ page }) => {
    let hold = gate();
    await mockService(page, mapleHarbor({ [PACKAGE]: ({ body }) => packageReply(packageFor(body), { hold: hold.promise }) }));
    const downloads = watchDownloads(page);
    await openLiveResult(page);
    const card = packageCard(page);

    await downloadPackageButton(page).click();
    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(card).toHaveAttribute('data-package', 'idle');
    await expect(downloadPackageButton(page)).toBeEnabled();
    hold.open();
    await page.waitForTimeout(400);
    expect(downloads).toHaveLength(0);

    // Leaving the lookup for another view while a package is being built.
    hold = gate();
    await downloadPackageButton(page).click();
    await expect(card).toHaveAttribute('data-package', 'loading');
    await page.getByRole('link', { name: 'Compare sources' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Two sources, side by side.' })).toBeVisible();
    hold.open();
    await page.waitForTimeout(600);
    expect(downloads).toHaveLength(0);
  });

  test('a package for another property, date or answer state is refused and not saved', async ({ page }) => {
    let variant: 'answers' | 'date' | 'property' | 'ok' = 'answers';
    await mockService(
      page,
      mapleHarbor({
        [PACKAGE]: ({ body }) => {
          const pack = packageFor(body);
          if (variant === 'answers') {
            pack.request.answers = [{ field: 'units', value: 8, provenance: 'demo', note: null }];
            pack.response.answers_applied = clone(pack.request.answers);
          }
          if (variant === 'date') pack.request.as_of = '2026-10-01';
          if (variant === 'property') pack.inputs.original_property.address_id = 'SYNTH-001';
          return packageReply(pack);
        },
      }),
    );
    const downloads = watchDownloads(page);
    await openLiveResult(page);
    const card = packageCard(page);
    for (const [which, detail] of [
      ['answers', 'request.answers does not match the 0 answers that were sent'],
      ['date', 'request.as_of is "2026-10-01"; "2026-11-15" was sent.'],
      ['property', 'inputs.original_property is "SYNTH-001", not the property that was sent.'],
    ] as const) {
      variant = which;
      await (which === 'answers' ? downloadPackageButton(page) : card.getByRole('button', { name: 'Try again' })).click();
      const alert = card.getByRole('alert').filter({ hasText: 'The response did not match the contract' });
      await expect(alert).toContainText('a package for a different property, date or set of answers than the one on screen, so it was not saved');
      await expect(alert).toContainText(detail);
      await expect(alert).toContainText('The result on screen is unaffected.');
      await expect(card.locator('.keep__receipt')).toHaveCount(0);
    }
    expect(downloads).toHaveLength(0);

    variant = 'ok';
    const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: 'Try again' }).click()]);
    expect(download.suggestedFilename()).toBe(PACKAGE_NAME);
    await expect(card.getByRole('alert')).toHaveCount(0);
    await expect(card.locator('.keep__receipt')).toContainText('Saved as');
  });

  test('each failure has its own honest state, offers a retry only where one can help, and saves nothing', async ({ page }) => {
    let reply: Reply | 'abort' = { status: 404, json: { detail: { code: 'unknown_id', message: 'Unknown address ID SYNTH-003' } } };
    await mockService(page, mapleHarbor({ [PACKAGE]: () => reply }));
    const downloads = watchDownloads(page);
    await openLiveResult(page);
    const card = packageCard(page);
    const cases: Array<{ reply: Reply | 'abort'; title: string; texts: string[]; retry: boolean }> = [
      { reply, title: 'That selection is no longer in the dataset', texts: ['Unknown address ID SYNTH-003', 'The service no longer has this property, so it built no package.', 'HTTP 404', 'unknown_id'], retry: false },
      { reply: { status: 422, json: { detail: { code: 'invalid_input', message: 'Demo answers require the separate synthetic dataset' } } }, title: 'The request was not accepted', texts: ['Demo answers require the separate synthetic dataset', 'would be rejected again', 'HTTP 422'], retry: false },
      { reply: { status: 502, json: { detail: { code: 'core_contract_error', message: 'Core output did not satisfy the shared contract' } } }, title: 'A backend dependency failed', texts: ['Core output did not satisfy the shared contract', 'A partial package is never produced.', 'HTTP 502', 'core_contract_error'], retry: true },
      { reply: { status: 503, json: { detail: { code: 'core_unavailable', message: 'Core service failed; no substitute analysis generated' } } }, title: 'A backend dependency failed', texts: ['no substitute analysis generated', 'the package depends on failed', 'core_unavailable'], retry: true },
      { reply: { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Dataset changed while packaging; retry against a stable snapshot' } } }, title: 'The dataset is not ready', texts: ['Dataset changed while packaging', 'ask again once the dataset is stable', 'dataset_unavailable'], retry: true },
      { reply: { status: 404, json: { detail: 'Not Found' } }, title: 'This capability is not available on the connected backend', texts: ['no evidence-package route', 'The working export beside this card is still available; it is a different file and not a substitute.'], retry: false },
      { reply: { json: { ...clone(contract.package.response), artifact_label: 'VERIFIED_LEGAL_PACKAGE' } }, title: 'The response did not match the contract', texts: ['does not match the EvidencePackage contract', 'artifact_label', 'The response was not saved.'], retry: true },
      { reply: 'abort', title: 'The service could not be reached', texts: ['Could not reach the API', 'so nothing was saved'], retry: true },
    ];
    for (const [index, item] of cases.entries()) {
      reply = item.reply;
      // After a failure with no retry, the action itself is still there to be used again.
      const again = card.getByRole('button', { name: 'Try again' });
      await (index > 0 && (await again.count()) ? again : downloadPackageButton(page)).click();
      const alert = card.getByRole('alert').filter({ hasText: item.title });
      await expect(alert).toBeVisible();
      for (const text of item.texts) await expect(alert).toContainText(text);
      await expect(alert).toContainText('The result on screen is unaffected.');
      await expect(alert).toContainText('POST /lookup/evidence-package');
      await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(item.retry ? 1 : 0);
      await expect(card.locator('.keep__receipt')).toHaveCount(0);
      // The result itself is still on screen, and no failure reads as an empty or settled result.
      await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
    }
    expect(downloads).toHaveLength(0);
    // The separate working export is unaffected by any of these.
    await expect(workingCard(page).getByRole('button', { name: 'Download working export (JSON)' })).toBeEnabled();
  });

  test('the working export is a different file and says so', async ({ page }) => {
    const calls = await mockService(page, mapleHarbor({ [PACKAGE]: ({ body }) => packageReply(packageFor(body)) }));
    await openLiveResult(page);
    await expect(workingCard(page)).toContainText('Assembled in this browser from what is on screen');
    await expect(workingCard(page)).toContainText('It is not the evidence package.');
    const [download] = await Promise.all([page.waitForEvent('download'), workingCard(page).getByRole('button', { name: 'Download working export (JSON)' }).click()]);
    expect(download.suggestedFilename()).toBe('navigator-working-export_SYNTH-003_2026-11-15.json');
    const file = JSON.parse(await downloadedText(download));
    expect(file.export_kind).toBe('ux_working_export');
    expect(file.notice).toContain('It is not the evidence package the service builds (POST /lookup/evidence-package)');
    expect(file.package_sha256).toBeUndefined();
    expect(packageCalls(calls)).toHaveLength(0);
    await expect(page.getByRole('region', { name: 'Keep this result' })).not.toContainText(/no evidence package|does not (yet )?(have|offer) an evidence package/i);
  });
});

test.describe('evidence package in the synthetic demo', () => {
  test('is not offered for recordings or contract examples, and says why; the working export still is', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) requests.push(request.url());
    });
    await page.goto('/#/lookup?mode=demo&address=DEV-P04&as_of=2026-12-15&run=1');
    await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
    const card = packageCard(page);
    await expect(card.locator('[data-package-unavailable]')).toContainText('Not available in the synthetic demo: the package is built by the live service for a saved property, and the demo only replays recordings.');
    await expect(card.getByRole('button')).toHaveCount(0);
    await expect(workingCard(page).getByRole('button', { name: 'Download working export (JSON)' })).toBeEnabled();

    // A new page load, so the deep link is read again.
    await page.goto('about:blank');
    await page.goto('/#/lookup?mode=demo&case=decisive_question');
    await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
    await expect(packageCard(page).locator('[data-package-unavailable]')).toContainText('Not available for a contract example');
    expect(requests).toEqual([]);
  });
});
