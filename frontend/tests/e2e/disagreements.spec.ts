import { expect, test } from '@playwright/test';
import { devFixture, devHandlers, expectNoHorizontalOverflow, mockApi, openDemo, openLive } from './helpers';

const card = (page: import('@playwright/test').Page) => page.locator('.disagreement');

test.describe('source disagreements', () => {
  test('a conflict the evaluator flagged shows both records side by side and prefers neither', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo&address=DEV-P07&as_of=2027-01-15');
    const context = page.getByRole('group', { name: 'Conflict context' });
    await expect(context).toContainText('As of Jan 15, 2027');
    await expect(context).toContainText('Synthetic data · not actual law');
    await expect(context).toContainText('UX development fixture');
    await expect(page.locator('.disagreements__property')).toContainText('25 Dune Lane');
    await expect(page.getByRole('heading', { name: 'Conflicts flagged by the evaluator 1' })).toBeVisible();

    await expect(card(page)).toHaveCount(1);
    await expect(card(page)).toHaveAttribute('data-basis', 'same_provision');
    await expect(card(page).getByRole('heading', { level: 3 })).toHaveText('The sources differ on: requirement, key value');
    await expect(card(page)).toContainText('Unresolved');
    await expect(card(page)).toContainText('No source is preferred');

    const claims = card(page).locator('.claim');
    await expect(claims).toHaveCount(2);
    const code = card(page).locator('.claim', { hasText: 'DEV-LP-CODE-03' });
    const ordinance = card(page).locator('.claim', { hasText: 'DEV-LP-ORD-03' });
    for (const [claim, amount, offsets] of [[code, '$50', 'characters 197–330'], [ordinance, '$35', 'characters 152–285']] as const) {
      await expect(claim).toContainText('Official · legal text · synthetic, not actual law');
      await expect(claim.locator('.claim__stated')).toContainText(`A landlord may not charge an applicant a screening fee greater than ${amount}.`);
      await expect(claim.locator('.claim__stated')).toContainText(`Key value${amount}`);
      await expect(claim.locator('blockquote')).toHaveText(`Beginning October 15, 2026, a landlord of a residential rental property may not charge an applicant a screening fee greater than ${amount}.`);
      await expect(claim).toContainText(`Exact source text · ${offsets}`);
      await expect(claim.locator('.claim__meta')).toContainText('EnactedSep 9, 2026');
      await expect(claim.locator('.claim__meta')).toContainText('Takes effectOct 15, 2026');
      await expect(claim.locator('.claim__meta')).toContainText('RetrievedOct 3, 2026, 00:00 UTC');
      // Under either record this property's result stays unknown.
      await expect(claim.locator('.claim__result')).toContainText('Unknown');
    }

    await expect(card(page).getByRole('region', { name: 'Why this is unresolved' })).toContainText('Different supported interpretations of the same provision/version; no automatic precedence');
    const next = card(page).getByRole('region', { name: 'What would resolve it' });
    await expect(next).toContainText('Interpretation review: compare both authorities and their dated support; factual answers do not resolve legal conflicts');
    await expect(next).toContainText('A fact about the property cannot settle it.');
    await expect(card(page)).not.toContainText(/preferred source|more likely|confidence/i);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Open the full lookup' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '25 Dune Lane, Larch Point, ZZ' })).toBeVisible();
    await expect(page.getByLabel('As of date')).toHaveValue('2027-01-15');
  });

  test('an unsettled interaction shows what the source says about the two rules', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo&address=DEV-P01&as_of=2027-01-15');
    await expect(card(page)).toHaveAttribute('data-basis', 'interaction');
    await expect(card(page)).toContainText('Two rules, precedence not established');
    await expect(card(page).locator('.claim')).toHaveCount(2);
    await expect(card(page).locator('.claim', { hasText: 'DEV-CL-ORD-07' }).locator('.claim__stated')).toContainText("one month's rent");
    await expect(card(page).locator('.claim', { hasText: 'DEV-ZZ-ACT-11' }).locator('.claim__stated')).toContainText("two months' rent");
    const relation = card(page).getByRole('region', { name: 'What the source says about the two rules' });
    await expect(relation).toContainText('Recorded as “conflicts with”');
    await expect(relation.locator('blockquote')).toContainText('this ordinance does not state which limit controls');

    // The same property a month earlier: the state rule is not yet in force, and nothing is flagged.
    await page.getByLabel('As of').fill('2026-12-15');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByText('No conflict is flagged for this property on this date')).toBeVisible();
    await expect(page.getByText('That is not a finding that every source agrees')).toBeVisible();
    await expect(card(page)).toHaveCount(0);

    // A date the demo holds no recording for is refused, with the recorded dates offered.
    await page.getByLabel('As of').fill('2026-11-20');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Not available in the synthetic demo' });
    await expect(alert.getByRole('link', { name: 'Use Jan 15, 2027' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('without a property the demo lists recorded conflicts and a labeled development fixture in a proposed shape', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo');
    await expect(page.getByRole('heading', { level: 3, name: 'Recorded lookups with a conflict flag' })).toBeVisible();
    await expect(page.locator('.disagreements__examples a')).toHaveCount(6);

    const section = page.getByRole('region', { name: 'Field-level claims' });
    const notice = section.getByRole('note').filter({ hasText: 'Development fixture in a proposed shape' });
    await expect(notice).toContainText('needs a contract that does not exist yet (PLAT-06)');
    await expect(notice).toContainText('the backend did not produce or evaluate it');
    const proposed = section.locator('.disagreement');
    await expect(proposed).toHaveAttribute('data-basis', 'proposed_fixture');
    await expect(proposed).toContainText('Development fixture · proposed shape');
    await expect(proposed.getByRole('heading', { level: 3 })).toHaveText('The sources differ on: effective date');
    const adopted = proposed.locator('.claim', { hasText: 'DEV-CL-ORD-07' });
    const notified = proposed.locator('.claim', { hasText: 'DEV-CL-NOTICE-07' });
    await expect(adopted).toContainText('Official · legal text');
    await expect(adopted.locator('.claim__stated')).toContainText('Effective dateNov 1, 2026');
    await expect(notified).toContainText('Secondary · secondary');
    await expect(notified.locator('.claim__stated')).toContainText('Effective dateDec 1, 2026');
    await expect(notified.locator('blockquote')).toContainText('takes effect on December 1, 2026');
    await expect(notified.locator('.claim__meta')).toContainText('PostedSep 2, 2026');
    await expect(proposed).toContainText('Rule this concerns');
    await expect(proposed).toContainText('Cedar Landing deposit cap (fictional)');
    await expect(proposed).toContainText('ux_proposed_shape_awaiting_PLAT-06');
    await expect(proposed).not.toContainText('This property, under this record');
    await expectNoHorizontalOverflow(page);

    await page.locator('.disagreements__examples a').first().click();
    await expect(page.getByRole('group', { name: 'Conflict context' })).toBeVisible();
    await expect(card(page).first()).toBeVisible();
  });

  test('live API: reached from a result, explained when opened bare, and failures are not agreement', async ({ page }) => {
    const fixture = devFixture();
    const handlers = devHandlers(fixture);
    let unavailable = false;
    const calls = await mockApi(page, {
      ...handlers,
      'POST /lookup/assist': (request) => (unavailable ? { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'No completed extraction; configure provider and run navigator extract' } } } : handlers['POST /lookup/assist']!(request)),
    });
    await openLive(page, '#/disagreements?mode=live');
    await expect(page.getByRole('note').filter({ hasText: 'Open this view from a result that carries a conflict flag' })).toContainText('No route lists disagreements across the whole dataset yet');
    await expect(page.getByText('Field-level claims')).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a property ID.' })).toBeVisible();
    await page.getByLabel('Property ID').fill('DEV-P09');
    await page.getByLabel('As of').fill('2027-01-15');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByRole('group', { name: 'Conflict context' })).toContainText('Live API');
    await expect(card(page)).toHaveCount(1);
    await expect(card(page).locator('.claim')).toHaveCount(2);
    expect(calls.filter((call) => call.path === '/lookup/assist').at(-1)?.body).toEqual({ address_id: 'DEV-P09', as_of: '2027-01-15', answers: [] });
    await expect(page).toHaveURL(/#\/disagreements\?mode=live&address=DEV-P09&as_of=2027-01-15/);

    unavailable = true;
    await page.getByLabel('Property ID').fill('DEV-P07');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The dataset is not ready' });
    await expect(alert).toContainText('not a finding that the sources agree');
    await expect(card(page)).toHaveCount(0);
  });
});
