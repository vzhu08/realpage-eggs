import { type Request, expect, test } from '@playwright/test';
import { clone, comparisonResult, devFixture, devHandlers, expectNoHorizontalOverflow, mockApi, openLive, openPortfolio } from './helpers';

test.describe('portfolio changes: timeline, summaries and drill-down', () => {
  test('the development portfolio is labeled as a fixture and its headline counts are the comparison’s own', async ({ page }) => {
    const result = await openPortfolio(page);
    const context = result.getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText('From Oct 1, 2026 to Jan 15, 2027');
    await expect(context).toContainText('Development fixture · fictional law');
    await expect(context).toContainText('Actual law');
    await expect(context).toContainText('UX development fixture');
    await expect(result.getByRole('note').filter({ hasText: 'UX development fixture: fictional sources and properties' })).toContainText('not legal evidence');
    await expect(result).toHaveAttribute('data-status', 'partial');

    await expect(result.locator('[data-impact="Definitely affected"]')).toHaveAttribute('data-count', '11');
    await expect(result.locator('[data-impact="Uncertain"]')).toHaveAttribute('data-count', '10');
    await expect(result.locator('[data-impact="Conflict flagged"]')).toHaveAttribute('data-count', '10');
    await expect(result).toContainText('A property is counted under both “definitely affected” and “uncertain”');
    await expectNoHorizontalOverflow(page);
  });

  test('the timeline shows each stated date with its precision and marks the two compared dates', async ({ page }) => {
    const result = await openPortfolio(page);
    const timeline = result.locator('[data-timeline]');
    const items = timeline.locator('.timeline__item');
    await expect(items).toHaveCount(9);
    await expect(items.nth(3)).toHaveAttribute('data-query', 'from');
    await expect(items.nth(3)).toContainText('Oct 1, 2026');
    await expect(items.nth(3)).toContainText('First compared date');
    await expect(items.last()).toHaveAttribute('data-query', 'to');
    await expect(items.last()).toContainText('Jan 15, 2027');

    // Enacted before the first date: already reflected on both sides.
    await expect(items.nth(0)).toContainText('Jun 10, 2026');
    await expect(items.nth(0)).toContainText('Enacted');
    await expect(items.nth(0)).toContainText('Zenith state deposit cap (fictional)');
    await expect(items.nth(0)).toHaveAttribute('data-position', 'earlier');

    // Two records of one provision are named once.
    const fee = timeline.locator('[data-event="effective::2026-10-15"]');
    await expect(fee).toContainText('Takes effect');
    await expect(fee).toContainText('Larch Point screening fee cap (fictional) (2 records)');
    await expect(fee).toContainText('6 properties have a changed result under these rules');

    // A month stated by the source stays a month.
    const month = timeline.locator('[data-event="effective::2026-12"]');
    await expect(month.locator('time')).toHaveText('Dec 2026');
    await expect(month).toContainText('month only');
    await expect(month).toContainText('The source states only the month: Dec 1, 2026 to Dec 31, 2026.');
    await expect(month).toContainText('the interface does not pick a day');
    await month.getByText('Source text for this date (1)').click();
    await expect(month.locator('blockquote')).toHaveText('Section 5 takes effect in December 2026.');
    await expect(month.getByRole('button', { name: /Compare the day before with the first possible day/ })).toBeVisible();
    await expect(month.getByRole('button', { name: /Compare the day before with the last possible day/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('comparing across a date from the timeline runs that comparison and keeps the form in step', async ({ page }) => {
    const result = await openPortfolio(page);
    await result.locator('[data-event="effective::2026-11-01"]').getByRole('button', { name: /Compare the day before with this day/ }).click();
    const context = comparisonResult(page).getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText('From Oct 31, 2026 to Nov 1, 2026');
    await expect(page.getByLabel('From date')).toHaveValue('2026-10-31');
    await expect(page.getByLabel('To date')).toHaveValue('2026-11-01');
    await expect(page.locator('.changes__result')).toBeFocused();
    // One rule changes on that day, for the buildings it covers.
    await expect(comparisonResult(page).locator('[data-impact="Definitely affected"]')).toHaveAttribute('data-count', '3');
    const next = comparisonResult(page);
    await expect(next.locator('.rule-node')).toHaveCount(1);
    await expect(next.locator('.rule-node')).toContainText('Cedar Landing deposit cap (fictional)');

    // Inside a month the source did not pin to a day, the result is uncertain rather than guessed.
    await page.getByRole('button', { name: 'Oct 1, 2026 → Dec 15, 2026', exact: true }).click();
    const inside = comparisonResult(page);
    await expect(inside.getByRole('group', { name: 'Comparison context' })).toContainText('to Dec 15, 2026');
    await expect(inside.locator('[data-event="effective::2026-12"]')).toHaveAttribute('data-position', 'overlaps');
    await expect(inside.locator('[data-event="effective::2026-12"]')).toContainText('overlaps a compared date');
    // Only rules whose result changes between the two dates are on the timeline.
    await expect(inside.locator('[data-event="effective::2027-01-01"]')).toHaveCount(0);
    await expect(inside.locator('[data-impact="Uncertain"]')).toHaveAttribute('data-count', '11');
  });

  test('summaries group by legal municipality and by category, and filter the detail', async ({ page }) => {
    const result = await openPortfolio(page);
    const places = result.locator('[data-summary="Legal municipality"]');
    await expect(places.getByRole('row')).toHaveCount(6);
    await expect(places.getByRole('row', { name: /Cedar Landing, ZZ/ })).toContainText('5444');
    await expect(places.getByRole('row', { name: /Port Alder, ZZ/ })).toContainText('2200');
    const open = places.getByRole('row', { name: /Municipality unresolved · ZZ/ });
    await expect(open).toContainText('Legal municipality not established; the postal city is not used.');
    await expect(open).toContainText('1011');
    const categories = result.locator('[data-summary="Category"]');
    await expect(categories.getByRole('row', { name: /Security deposits/ })).toContainText('14866');
    await expect(categories.getByRole('row', { name: /Just-cause eviction/ })).toContainText('7430');

    const shown = result.locator('#change-diffs').locator('..').getByText(/changed results?$/);
    await expect(shown).toHaveText('14 properties · 39 changed results');

    // Keyboard: a group name is a button that toggles a filter.
    const larch = places.getByRole('button', { name: 'Larch Point, ZZ' });
    await larch.focus();
    await page.keyboard.press('Enter');
    await expect(larch).toHaveAttribute('aria-pressed', 'true');
    await expect(shown).toHaveText('5 properties · 13 changed results');
    await categories.getByRole('button', { name: 'Application and screening fees' }).click();
    await expect(shown).toHaveText('4 properties · 8 changed results');
    await expect(result.locator('.source-node')).toHaveCount(2);

    // The definite count narrows further; nothing matches, and the view says so instead of showing zero impact.
    await result.locator('[data-impact="Definitely affected"]').getByRole('button').click();
    await expect(result.getByText('No changed result matches the selected filters')).toBeVisible();
    const filters = result.getByRole('group', { name: 'Active filters' });
    await expect(filters.getByRole('button')).toHaveCount(4);
    await filters.getByRole('button', { name: /Definitely affected/ }).click();
    await expect(shown).toHaveText('4 properties · 8 changed results');
    await filters.getByRole('button', { name: 'Clear filters' }).click();
    await expect(shown).toHaveText('14 properties · 39 changed results');
    await expect(larch).toHaveAttribute('aria-pressed', 'false');
    await expectNoHorizontalOverflow(page);
  });

  test('drill-down: source → changed rule → impacted property → evidence, then on to the conflicting sources', async ({ page }) => {
    const result = await openPortfolio(page);
    const sources = result.locator('.source-node');
    await expect(sources).toHaveCount(4);
    const ordinance = result.locator('.source-node[data-source="DEV-CL-ORD-07"]');
    await expect(ordinance).toContainText('Official · legal text');
    await expect(ordinance).toContainText('2 changed rules · 7 properties');
    await expect(ordinance).toContainText('retrieved Oct 3, 2026, 00:00 UTC');
    await expect(ordinance).toContainText('synthetic source, not actual law');
    await expect(ordinance.getByRole('link', { name: 'https://example.invalid/ux-dev-fixture/dev-cl-ord-07' })).toBeVisible();

    // The first rule is open: its exact source text, then the properties it reaches.
    const rule = ordinance.locator('.rule-node').first();
    await expect(rule).toContainText('Cedar Landing deposit cap (fictional)');
    await expect(rule).toContainText('Cedar Landing Ordinance DEV-07, section 3 · Cedar Landing, ZZ · Security deposits');
    await expect(rule.locator('.rule-node__quote')).toHaveText("Beginning November 1, 2026, residential rental buildings containing at least five units must limit a security deposit to one month's rent.");
    await expect(rule).toContainText('characters 154–292 · exact source text');
    await expect(rule.locator('.impact-row')).toHaveCount(6);

    const row = rule.locator('.impact-row[data-address="DEV-P01"]');
    await expect(row).toContainText('12 Alder Row');
    await expect(row).toContainText('Cedar Landing, ZZ');
    await expect(row).toContainText('Uncertain');
    await expect(row).toContainText('Conflict');
    // An unresolved location is stated, never replaced by the postal city.
    await expect(rule.locator('.impact-row[data-address="DEV-P13"]')).toContainText('Municipality unresolved · ZZ');

    // Keyboard: the row is a native disclosure.
    await row.locator('summary').first().focus();
    await page.keyboard.press('Enter');
    await expect(row).toContainText('Before · Oct 1, 2026');
    await expect(row).toContainText('After · Jan 15, 2027');
    await expect(row).toContainText('Possible interaction');
    await expect(row.getByRole('link', { name: 'Open lookup as of Jan 15, 2027' })).toBeVisible();

    // A second source stays closed until asked for.
    const act = result.locator('.source-node[data-source="DEV-ZZ-ACT-11"]');
    await expect(act.locator('.rule-node__quote')).toBeHidden();
    await act.locator('summary').first().click();
    await act.locator('.rule-node summary').first().click();
    await expect(act.locator('.rule-node__quote')).toContainText("may not collect a security deposit greater than two months' rent");
    await expectNoHorizontalOverflow(page);

    await row.getByRole('link', { name: 'Compare the conflicting sources' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Where two sources say different things, and what would settle it.' })).toBeVisible();
    const card = page.locator('.disagreement');
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('data-basis', 'interaction');
    await expect(card).toContainText('does not state which limit controls');
  });

  test('grouping by property uses names, keeps IDs secondary and switches with the arrow keys', async ({ page }) => {
    const result = await openPortfolio(page);
    const bySource = result.getByRole('tab', { name: 'By source and rule' });
    await bySource.focus();
    await page.keyboard.press('ArrowRight');
    await expect(result.getByRole('tab', { name: 'By property' })).toHaveAttribute('aria-selected', 'true');
    const nodes = result.locator('.property-node');
    await expect(nodes).toHaveCount(14);
    const larch = result.locator('.property-node[data-address="DEV-P07"]');
    await expect(larch).toContainText('25 Dune Lane');
    await expect(larch).toContainText('Conflict flagged');
    // The two records of the same provision are told apart by their source document.
    await expect(larch.locator('.impact-row')).toHaveCount(3);
    await expect(larch).toContainText('DEV-LP-CODE-03');
    await expect(larch).toContainText('DEV-LP-ORD-03');
    await expect(larch.getByRole('link', { name: 'Open lookup as of Jan 15, 2027' }).first()).toHaveAttribute('href', /address=DEV-P07.*as_of=2027-01-15/);
    await expectNoHorizontalOverflow(page);
  });

  test('a hypothetical comparison is labeled, and only the pending rule’s rows differ from actual law', async ({ page }) => {
    const result = await openPortfolio(page, 'Oct 1, 2026 → Jan 15, 2027 · if enacted');
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Hypothetical · if enacted');
    await expect(result.getByRole('group', { name: 'Comparison context' })).not.toContainText('Actual law');
    await expect(result).toContainText('Stored law is unchanged, and nothing here says the rules will be enacted.');
    const bill = result.locator('.source-node[data-source="DEV-LP-BILL-19"]');
    await expect(bill).toContainText('Official · status record');
    await bill.locator('summary').first().click();
    await bill.locator('.rule-node summary').first().click();
    await expect(bill.locator('.rule-node')).toContainText('Larch Point proposed rent increase limit (fictional)');
    const row = bill.locator('.impact-row[data-address="DEV-P07"]');
    await expect(row).toContainText('Pending');
    await expect(row).toContainText('Applies');
    // The timeline shows the recorded status date; no effective date is invented for a proposal.
    const pending = result.locator('[data-event="status:pending:2026-09-22"]');
    await expect(pending).toContainText('Recorded as pending');
    await expect(result.locator('.timeline__item').filter({ hasText: 'Larch Point proposed rent increase limit' }).filter({ hasText: 'Takes effect' })).toHaveCount(0);
  });
});

test.describe('portfolio changes against the live API (double built from recorded backend output)', () => {
  test('names are read from /addresses, /rules and /sources; a failed read keeps IDs and can be retried', async ({ page }) => {
    const handlers = devHandlers();
    let failRules = true;
    const rules = handlers['GET /rules/*']!;
    const calls = await mockApi(page, { ...handlers, 'GET /rules/*': (request) => (failRules ? { status: 500, json: { detail: 'boom' } } : rules(request)) });
    await openLive(page, '#/changes?mode=live');
    await page.getByLabel('To date').fill('2027-01-15');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const result = comparisonResult(page);
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Live API');
    // The payload says its rules are synthetic; once rule records load that is shown even in live mode.
    await expect(result.locator('[data-impact="Definitely affected"]')).toHaveAttribute('data-count', '11');

    const status = result.getByRole('note').filter({ hasText: 'Some names could not be read' });
    await expect(status).toContainText('5 rule records');
    await expect(status).toContainText('The comparison itself is unaffected.');
    // Without rule records there is one "source not known" group and rules keep their IDs.
    await expect(result.locator('.source-node')).toHaveCount(1);
    await expect(result.locator('.source-node')).toContainText('Source not known yet');
    await expect(result.locator('.rule-node').first()).toContainText('Rule record not loaded');
    await expect(result.locator('[data-summary="Category"]')).toContainText('Rule details not loaded');
    // Properties are still named.
    await expect(result.locator('[data-summary="Legal municipality"]')).toContainText('Cedar Landing, ZZ');

    failRules = false;
    await status.getByRole('button', { name: 'Try again' }).click();
    await expect(result.locator('.source-node')).toHaveCount(4);
    await expect(result.getByRole('note').filter({ hasText: 'Some names could not be read' })).toHaveCount(0);
    await expect(result.getByRole('group', { name: 'Comparison context' })).toContainText('Synthetic data · not actual law');
    await expect(result.locator('[data-summary="Category"]')).toContainText('Security deposits');

    expect(calls.find((call) => call.method === 'POST' && call.path === '/changes')?.body).toEqual({ before: '2026-10-01', after: '2027-01-15', scenario: 'actual' });
    // The whole sample list is paged through once, not once per property.
    expect(calls.filter((call) => call.path.startsWith('/addresses')).length).toBeLessThanOrEqual(3);
    await expectNoHorizontalOverflow(page);
  });

  test('a slower earlier comparison never replaces a newer one', async ({ page }) => {
    // A transport can finish after cancellation; exercise the view's own stale-response guard.
    await page.addInitScript(() => {
      const fetch = window.fetch.bind(window);
      window.fetch = (input, init) => fetch(input, { ...init, signal: undefined });
    });
    const fixture = devFixture();
    await mockApi(page, devHandlers(fixture));
    let release!: () => void;
    let held!: Request;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const bodies: Array<{ before: string; after: string }> = [];
    await page.route('**/api/v1/changes', async (route) => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      if (bodies.length === 1) {
        held = route.request();
        await pending;
      }
      const entry = fixture.changes.find((candidate) => candidate.request.before === body.before && candidate.request.after === body.after && (candidate.request.scenario ?? 'actual') === 'actual');
      await route.fulfill({ json: clone(entry!.response) });
    });
    await openLive(page, '#/changes?mode=live');
    await page.getByLabel('To date').fill('2027-01-15');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);

    // While the first request hangs, the dates are edited: that withdraws the pending comparison.
    await expect(page.getByRole('button', { name: 'Comparing…' })).toBeDisabled();
    await page.getByLabel('From date').fill('2026-10-31');
    await page.getByLabel('To date').fill('2026-11-01');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const context = comparisonResult(page).getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText('From Oct 31, 2026 to Nov 1, 2026');

    const returned = page.waitForResponse((response) => response.request() === held);
    release();
    await (await returned).finished();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(context).toContainText('From Oct 31, 2026 to Nov 1, 2026');
    await expect(context).not.toContainText('Jan 15, 2027');
    await expect(comparisonResult(page).locator('[data-impact="Definitely affected"]')).toHaveAttribute('data-count', '3');
    expect(bodies.map((body) => `${body.before}→${body.after}`)).toEqual(['2026-10-01→2027-01-15', '2026-10-31→2026-11-01']);
  });
});
