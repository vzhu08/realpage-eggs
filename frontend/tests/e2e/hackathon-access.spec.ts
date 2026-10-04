/**
 * Cross-cutting checks for the judge journey: a keyboard-only pass, dialogs that trap and
 * restore focus, stale-request races, and wrapping at a 390px-wide phone.
 *
 * Demo-mode tests replay recordings. Tests titled "mocked live API (fixture check)" intercept
 * /api/v1 with page.route and answer from checked-in contract examples; none of them is a
 * check of the actual API (see docs/QA_HACKATHON.md).
 */
import { type Locator, type Page, expect, test } from '@playwright/test';
import {
  banner,
  clone,
  contract,
  contractHandlers,
  defect,
  dev,
  evidenceDialog,
  example,
  expectNoHorizontalOverflow,
  gate,
  mockLive,
  openAllDisclosures,
  openDemo,
  openLive,
  packageFor,
  recordedAssist,
  resultContext,
  runLiveLookup,
  settle,
  shownDate,
} from './hackathon-helpers';

/** Press Tab until the focused element matches, within a bound. Fails if it is never reached. */
async function tabTo(page: Page, matches: (element: Element) => boolean, limit: number, key = 'Tab'): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await page.keyboard.press(key);
    if (await page.evaluate((source) => new Function('element', `return (${source})(element)`)(document.activeElement) as boolean, matches.toString())) return presses;
  }
  throw new Error(`Not reached within ${limit} presses of ${key}: ${matches.toString()}`);
}

/** The keyboard focus indicator: an outline or a ring drawn on the focused element. */
async function expectVisibleFocus(page: Page) {
  const style = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const computed = getComputedStyle(element);
    return { tag: element.tagName, outline: computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0, ring: computed.boxShadow !== 'none' };
  });
  expect(style.outline || style.ring, `visible focus on <${style.tag.toLowerCase()}>`).toBe(true);
}

const focusInside = (dialog: Locator) => dialog.evaluate((element) => element.contains(document.activeElement));

test.describe('recorded demo · keyboard only', () => {
  test('the journey can be driven without a pointer: skip link, example, question, answer, evidence dialog and back', async ({ page }) => {
    await openDemo(page);

    // The first stop is the skip link, and it works.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    // From the content, the first example is the first control.
    const presses = await tabTo(page, (element) => element.getAttribute('data-example') === 'consequential_fact', 3);
    expect(presses).toBe(1);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(resultContext(page)).toBeVisible();
    await expect.poll(() => page.url()).toContain('address=');
    const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '');
    const assist = recordedAssist(params.get('address') ?? '', params.get('as_of') ?? '');
    const question = assist.question_plan.questions[0]!;

    // The result takes the keyboard; the next action is reachable in order, before the detail.
    await tabTo(page, (element) => element.textContent?.trim() === 'Go to the question', 20);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /^Useful questions/ })).toBeFocused();

    // The answer field follows; typing and Enter submit it.
    await tabTo(page, (element) => element instanceof HTMLInputElement && element.type === 'text' && !!element.closest('[data-question]'), 8);
    await expectVisibleFocus(page);
    await page.keyboard.type(String(question.alternatives[0]!.probe_facts[question.fact.field]));
    await page.keyboard.press('Enter');
    // The outcome of answering takes the keyboard, so a screen reader hears it.
    await expect(page.getByRole('heading', { name: /^Re-evaluated/ })).toBeFocused();

    // Evidence: opened from the keyboard, focus moves in, Tab stays in, Escape returns to the opener.
    await tabTo(page, (element) => (element.getAttribute('aria-label') ?? '').startsWith('Inspect evidence for'), 60);
    await expectVisibleFocus(page);
    const openerLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await page.keyboard.press('Enter');
    const dialog = evidenceDialog(page);
    await expect(dialog).toBeVisible();
    await expect.poll(() => focusInside(dialog)).toBe(true);
    for (let index = 0; index < 25; index += 1) {
      await page.keyboard.press('Tab');
      expect(await focusInside(dialog), `Tab ${index + 1} stays in the dialog`).toBe(true);
    }
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInside(dialog), `Shift+Tab ${index + 1} stays in the dialog`).toBe(true);
    }
    // The tabs are one stop with arrow keys.
    await dialog.getByRole('tab', { name: /^Source text/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('tab', { name: 'Encoded rule' })).toBeFocused();
    await expect(dialog.getByRole('tab', { name: 'Encoded rule' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: openerLabel! })).toBeFocused();
  });

  test('the property chooser and the data-source panel close with Escape and give focus back', async ({ page }) => {
    await openDemo(page);
    await example(page, 'consequential_fact').click();
    await expect(resultContext(page)).toBeVisible();

    const change = page.getByRole('button', { name: 'Change property' });
    await change.focus();
    await page.keyboard.press('Enter');
    const chooser = page.getByRole('dialog', { name: 'Choose a property' });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('searchbox')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(chooser.getByRole('button', { name: 'Close the property chooser' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(chooser).toHaveCount(0);
    await expect(change).toBeFocused();
    // Closing the chooser changes nothing.
    await expect(resultContext(page)).toBeVisible();

    const status = page.getByRole('button', { name: /Replaying recorded data/ });
    await status.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Data source details' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Data source details' })).toHaveCount(0);
    await expect(status).toBeFocused();
  });

  // DEFECT (major for keyboard and screen-reader users; integrator: components/usePanelFocus.ts).
  // Reproduction: open example 1 → "Change property" → press Tab 19 times. Focus leaves the modal
  // chooser and lands on the page behind the scrim (document body, then "Skip to content", "Switch
  // to live API", …). Cause: the trap takes the LAST match of its focusable selector as the end of
  // the cycle, and that match is a button inside the closed "Contract examples" disclosure, which
  // cannot take focus; the real last stop is the disclosure's summary, so Tab is never wrapped.
  test('regression: Tab stays inside the modal property chooser (repro: example 1 → Change property → Tab ×19 → focus is on the page behind the dialog)', async ({ page }) => {
    await openDemo(page);
    await example(page, 'consequential_fact').click();
    await expect(resultContext(page)).toBeVisible();
    await page.getByRole('button', { name: 'Change property' }).click();
    const chooser = page.getByRole('dialog', { name: 'Choose a property' });
    await expect(chooser.getByRole('list', { name: 'Sample properties' })).toBeVisible();
    for (let index = 0; index < 30; index += 1) {
      await page.keyboard.press('Tab');
      expect(await focusInside(chooser), `Tab ${index + 1} stays in the chooser`).toBe(true);
    }
  });

  test('portfolio and compare views: tabs, drill-down levels and disclosures work from the keyboard', async ({ page }) => {
    const change = dev().changes[0]!;
    await openDemo(page, `#/changes?mode=demo&before=${change.request.before}&after=${change.request.after}`);
    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result).toBeVisible();

    await result.getByRole('tab', { name: 'By property' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(result.getByRole('tab', { name: 'By source and rule' })).toBeFocused();
    await expect(result.locator('[data-source]').first()).toBeVisible();
    await page.keyboard.press('End');
    await expect(result.getByRole('tab', { name: /^Timeline/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(result.getByRole('tab', { name: 'By property' })).toHaveAttribute('aria-selected', 'true');

    // A row opens with Enter on its summary and shows both dates.
    const row = result.locator('[data-rule][data-address]').first();
    await row.locator('summary').first().focus();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(row).toContainText(`Before · ${shownDate(change.response.before)}`);
  });
});

test.describe('mocked live API (fixture check) · stale requests never overwrite a newer state', () => {
  const REQUEST: { address_id: string; as_of: string } = contract.assist.request;
  const STREET: string = contract.assist.response.lookup.address.raw_address.street_address;
  const QUESTION = contract.assist.response.question_plan.questions[0];
  const ANSWER: { field: string; value: number } = contract.propertyPackage.response.response.answers_applied[0];
  const RULE_ID: string = contract.assist.response.lookup.evaluations[0].team_rule_id;
  const BASELINE: string = contract.assist.response.lookup.evaluations[0].result;
  const ANSWERED: string = contract.propertyPackage.response.response.lookup.evaluations[0].result;

  /** Late responses are delivered even after the page withdrew the request. */
  const deliverLateResponses = (page: Page) =>
    page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => original(input, { ...init, signal: undefined });
    });

  test('the date is changed while an answer is being re-evaluated: the late "answered" response does not replace the result or bring the answer back', async ({ page }) => {
    expect(ANSWERED).not.toBe(BASELINE);
    await deliverLateResponses(page);
    const held = gate();
    const handlers = contractHandlers();
    const assist = handlers['POST /lookup/assist']!;
    await mockLive(page, {
      ...handlers,
      'POST /lookup/assist': async (request) => {
        if (request.body.answers.length > 0) await held.wait;
        return assist(request);
      },
    });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    const rule = page.locator(`[data-rule-id="${RULE_ID}"][data-result]`);
    await expect(rule).toHaveAttribute('data-result', BASELINE);

    const card = page.locator(`[data-question="${QUESTION.question_id}"]`);
    await card.getByRole('textbox').fill(String(ANSWER.value));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    // While it waits, the earlier result stays and is marked busy; nothing is predicted.
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(rule).toHaveAttribute('data-result', BASELINE);

    // The date is changed before the answer's response arrives: a new question, with no answers.
    const other = '2026-12-01';
    await page.getByLabel('As of date').fill(other);
    await expect(page.getByRole('region', { name: /^Your answers/ })).toHaveCount(0);

    const late = page.waitForResponse((response) => response.url().includes('/lookup/assist') && response.request().postDataJSON().answers.length > 0);
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);

    // The answered response is for a request that is no longer being asked.
    await expect(rule).toHaveAttribute('data-result', BASELINE);
    await expect(page.getByRole('region', { name: /^Re-evaluated/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /^Your answers/ })).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: `These results are for ${shownDate(REQUEST.as_of)}` })).toBeVisible();
  });

  test('the lookup is run again without answers while an answer is still being re-evaluated: the late "answered" response does not bring the answered result back', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    const handlers = contractHandlers();
    const assist = handlers['POST /lookup/assist']!;
    const calls = await mockLive(page, {
      ...handlers,
      'POST /lookup/assist': async (request) => {
        if (request.body.answers.length > 0) await held.wait;
        return assist(request);
      },
    });
    await openLive(page);
    await runLiveLookup(page, STREET, REQUEST.as_of);
    const rule = page.locator(`[data-rule-id="${RULE_ID}"][data-result]`);
    const card = page.locator(`[data-question="${QUESTION.question_id}"]`);
    await card.getByRole('textbox').fill(String(ANSWER.value));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);

    // The date is changed and changed back, which clears the answer, and the lookup is run again.
    await page.getByLabel('As of date').fill('2026-12-01');
    await page.getByLabel('As of date').fill(REQUEST.as_of);
    await page.getByRole('button', { name: /^Run lookup/ }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(rule).toHaveAttribute('data-result', BASELINE);
    // The newest request carried no answers.
    expect(calls.filter((call) => call.path === '/lookup/assist').at(-1)!.body.answers).toEqual([]);

    const late = page.waitForResponse((response) => response.url().includes('/lookup/assist') && response.request().postDataJSON().answers.length > 0);
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);
    await expect(rule).toHaveAttribute('data-result', BASELINE);
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('no answers');
    await expect(page.getByRole('region', { name: /^Re-evaluated/ })).toHaveCount(0);
  });

  test('the property is changed while a lookup is in flight: the late result for the first property never appears under the second', async ({ page }) => {
    await deliverLateResponses(page);
    const held = gate();
    const handlers = contractHandlers();
    const assist = handlers['POST /lookup/assist']!;
    await mockLive(page, {
      ...handlers,
      'POST /lookup/assist': async (request) => {
        await held.wait;
        return assist(request);
      },
    });
    await openLive(page);
    await page.getByRole('list', { name: 'Sample properties' }).getByRole('button', { name: new RegExp(STREET) }).click();
    await page.getByLabel('As of date').fill(REQUEST.as_of);
    await page.getByRole('button', { name: /^Run lookup/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Looking up rules' })).toBeAttached();

    // Choose another property through the chooser while the first lookup is pending.
    const second = contract.normal.response.address;
    await page.getByRole('button', { name: 'Change property' }).click();
    await page.getByRole('dialog', { name: 'Choose a property' }).getByRole('button', { name: new RegExp(second.raw_address.street_address) }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(second.raw_address.street_address);

    const late = page.waitForResponse((response) => response.url().includes('/lookup/assist'));
    held.open();
    await (await late).finished();
    await settle(page);
    await page.waitForTimeout(300);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(second.raw_address.street_address);
    await expect(resultContext(page)).toHaveCount(0);
    await expect(page.locator('[data-rule-id][data-result]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run lookup', exact: true })).toBeEnabled();
  });
});

test.describe('390px-wide phone: nothing scrolls sideways and the labels stay', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('recorded demo: every step of the journey fits the width, with everything expanded', async ({ page }) => {
    await openDemo(page);
    await expectNoHorizontalOverflow(page);

    await example(page, 'consequential_fact').click();
    await expect(resultContext(page)).toBeVisible();
    await openAllDisclosures(page.locator('#main'));
    await expectNoHorizontalOverflow(page);
    await expect(banner(page)).toBeVisible();
    await expect(resultContext(page)).toContainText('Synthetic data · not actual law');
    await expect(resultContext(page)).toContainText('Not legal advice.');

    // The evidence dialog, on each of its views.
    await page.locator('[aria-label^="Inspect evidence for"]').first().click();
    const dialog = evidenceDialog(page);
    for (const tab of await dialog.getByRole('tab').all()) {
      await tab.click();
      await openAllDisclosures(dialog);
      await expectNoHorizontalOverflow(page);
      const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, 'the dialog itself does not scroll sideways').toBeLessThanOrEqual(1);
    }
    await page.keyboard.press('Escape');

    // Portfolio, with every level and every piece of evidence open, on each tab.
    const change = dev().changes[0]!;
    await page.goto(`/#/changes?mode=demo&before=${change.request.before}&after=${change.request.after}`);
    const result = page.getByRole('article', { name: 'Comparison result' });
    await expect(result).toBeVisible();
    await expect(result.getByText(/^Reading .* records/)).toHaveCount(0);
    for (const tab of await result.getByRole('tab').all()) {
      await tab.click();
      await openAllDisclosures(page.locator('#main'));
      await expectNoHorizontalOverflow(page);
    }
    await expect(page.getByRole('group', { name: 'Comparison context' })).toContainText(change.response.disclaimer);

    // Compare sources, with the hashes open.
    await page.goto('/#/disagreements?mode=demo');
    await expect(page.locator('[data-comparisons="ready"]')).toBeVisible();
    await openAllDisclosures(page.locator('#main'));
    await expectNoHorizontalOverflow(page);
    await expect(banner(page)).toBeVisible();
  });

  /**
   * A contract-shaped lookup whose title, citation, street address and open statements carry
   * `filler`, walked through the result, the package receipt and the evidence dialog with
   * everything expanded. Test-double text only; the shapes are the contract examples'.
   */
  async function walkLongContent(page: Page, filler: string) {
    const long = clone(contract.assist.response);
    const title = `Test double: a rule title that is far longer than any title in the recordings, to exercise wrapping on a narrow phone ${filler}`;
    const rule = long.lookup.rules[0];
    rule.title = title;
    rule.citation = `Test double citation ${filler}`;
    // RawAddress.street_address allows 200 characters; use all of them.
    long.lookup.address.raw_address.street_address = `12345 Extraordinarily Long Street ${filler}${filler}`.slice(0, 200);
    expect(long.lookup.address.raw_address.street_address).toHaveLength(200);
    long.question_plan.remaining_uncertainty = long.question_plan.remaining_uncertainty.map((item: any) => ({ ...item, message: `${item.message} ${filler}`, remedy: `${item.remedy} ${filler}` }));
    const handlers = contractHandlers();
    await mockLive(page, {
      ...handlers,
      'GET /addresses': async (request) => {
        const reply = (await handlers['GET /addresses']!(request)) as { json: any };
        const listed = clone(reply.json);
        for (const item of listed.items) if (item.property.address_id === long.lookup.address.address_id) item.property.raw_address = long.lookup.address.raw_address;
        return { json: listed };
      },
      'POST /lookup/assist': () => ({ json: long }),
      'POST /lookup/evidence-package': ({ body }) => ({ json: packageFor(body) }),
    });
    await openLive(page);
    await expect(page.getByRole('list', { name: 'Sample properties' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await runLiveLookup(page, 'Extraordinarily Long Street', contract.assist.request.as_of);
    await expect(page.locator('[data-rule-id][data-result]').first()).toContainText(title);
    await openAllDisclosures(page.locator('#main'));
    await expectNoHorizontalOverflow(page);

    // The package receipt shows three 64-character hashes and a code fingerprint.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download evidence package' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    await openAllDisclosures(page.locator('#main'));
    await expect(page.getByText(contract.propertyPackage.response.package_sha256)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator('[aria-label^="Inspect evidence for"]').first().click();
    const dialog = evidenceDialog(page);
    await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
    for (const tab of await dialog.getByRole('tab').all()) {
      await tab.click();
      await openAllDisclosures(dialog);
      await expectNoHorizontalOverflow(page);
      expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth), 'the dialog itself does not scroll sideways').toBeLessThanOrEqual(1);
    }
    // Nothing is cut off at the right edge either: the long title is inside the window.
    const box = (await dialog.getByRole('heading', { name: title }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(391);
  }

  test('mocked live API (fixture check): very long titles, a 200-character address, long statements, long IDs and 64-character hashes wrap', async ({ page }) => {
    await walkLongContent(page, 'with many ordinary words that can break between them '.repeat(4));
  });

  // DEFECT (minor, lane A: styles). Reproduction: 390px wide, live mode with a rule title, citation, street
  // address or statement that contains one long unbroken token (192 characters here; a long URL or
  // identifier in real data behaves the same). The chooser row, the subject title, the "Affects" link in
  // the question card and the evidence dialog title do not break inside the token: the card grows to
  // ≈1,580px, its right part is clipped, and with the disclosures open the page scrolls sideways by
  // ≈975px (the evidence dialog by ≈2,000px). Hashes and IDs in `.mono.break` already wrap.
  defect('DEFECT: mocked live API (fixture check): a long unbroken token in a title, address or statement wraps instead of widening the page (repro: 390px, rule title containing a 192-character token → page scrolls sideways ≈975px)', async ({ page }) => {
    await walkLongContent(page, 'Unbroken'.repeat(24));
  });

  // DEFECT (minor, lane A: styles/shell). Reproduction: 390px wide, any view. The three view links sit in a
  // horizontally scrolling strip and the third, "Compare sources", is cut off at the right edge
  // ("Compare sou") with nothing showing that the strip scrolls.
  defect('DEFECT: at 390px all three view links are fully inside the window (repro: #/lookup?mode=demo at 390x844; "Compare sources" is clipped to "Compare sou")', async ({ page }) => {
    await openDemo(page);
    for (const name of ['Property lookup', 'Portfolio changes', 'Compare sources']) {
      const box = (await page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name }).boundingBox())!;
      expect(box.x, `${name} starts inside the window`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} ends inside the window`).toBeLessThanOrEqual(390);
    }
  });
});
