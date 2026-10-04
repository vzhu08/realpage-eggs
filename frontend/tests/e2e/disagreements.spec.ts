import { type Page, expect, test } from '@playwright/test';
import { devFixture, devHandlers, expectNoHorizontalOverflow, mockApi, openDemo, openLive } from './helpers';

/** A conflict the evaluator flagged in one lookup: two rule records it could not reconcile. */
const conflict = (page: Page) => page.locator('.disagreement[data-basis]');
/** A claim observation from GET /source-comparisons: two recorded claims about one field. */
const comparison = (page: Page, id?: string) => page.locator(id ? `.comparison[data-comparison="${id}"]` : '.comparison');
const claimsSection = (page: Page) => page.getByRole('region', { name: /^Claims compared across sources/ });
const REMEDY = 'Acquire missing support or re-anchor invalid spans, then review authority, scope, dates and the meaning of both claims; retrieval recency does not decide precedence.';

test.describe('source disagreements', () => {
  test('a conflict the evaluator flagged shows both records side by side and prefers neither', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo&address=DEV-P07&as_of=2027-01-15');
    const context = page.getByRole('group', { name: 'Conflict context' });
    await expect(context).toContainText('As of Jan 15, 2027');
    await expect(context).toContainText('Synthetic data · not actual law');
    await expect(context).toContainText('UX development fixture');
    await expect(page.locator('.disagreements__property')).toContainText('25 Dune Lane');
    await expect(page.getByRole('heading', { name: 'Conflicts flagged by the evaluator 1' })).toBeVisible();

    await expect(conflict(page)).toHaveCount(1);
    await expect(conflict(page)).toHaveAttribute('data-basis', 'same_provision');
    await expect(conflict(page).getByRole('heading', { level: 3 })).toHaveText('The sources differ on: requirement, key value');
    await expect(conflict(page)).toContainText('Unresolved');
    await expect(conflict(page)).toContainText('No source is preferred');

    const claims = conflict(page).locator('.claim');
    await expect(claims).toHaveCount(2);
    const code = conflict(page).locator('.claim', { hasText: 'DEV-LP-CODE-03' });
    const ordinance = conflict(page).locator('.claim', { hasText: 'DEV-LP-ORD-03' });
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

    await expect(conflict(page).getByRole('region', { name: 'Why this is unresolved' })).toContainText('Different supported interpretations of the same provision/version; no automatic precedence');
    const next = conflict(page).getByRole('region', { name: 'What would resolve it' });
    await expect(next).toContainText('Interpretation review: compare both authorities and their dated support; factual answers do not resolve legal conflicts');
    await expect(next).toContainText('A fact about the property cannot settle it.');
    await expect(conflict(page)).not.toContainText(/preferred source|more likely|confidence/i);

    // The claim observations follow; those about a rule in this conflict come first and say so.
    await expect(comparison(page)).toHaveCount(4);
    const related = comparison(page).filter({ hasText: 'Concerns a rule in this conflict' });
    await expect(related).toHaveCount(2);
    expect(await comparison(page).evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.getAttribute('data-comparison')))).toEqual(['larch_point_screening_fee_amount', 'larch_point_screening_fee_enactment']);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Open the full lookup' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /25 Dune Lane/ })).toBeVisible();
    await expect(page.getByLabel('As of date')).toHaveValue('2027-01-15');
  });

  test('an unsettled interaction shows what the source says about the two rules', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo&address=DEV-P01&as_of=2027-01-15');
    await expect(conflict(page)).toHaveAttribute('data-basis', 'interaction');
    await expect(conflict(page)).toContainText('Two rules, precedence not established');
    await expect(conflict(page).locator('.claim')).toHaveCount(2);
    await expect(conflict(page).locator('.claim', { hasText: 'DEV-CL-ORD-07' }).locator('.claim__stated')).toContainText("one month's rent");
    await expect(conflict(page).locator('.claim', { hasText: 'DEV-ZZ-ACT-11' }).locator('.claim__stated')).toContainText("two months' rent");
    const relation = conflict(page).getByRole('region', { name: 'What the source says about the two rules' });
    await expect(relation).toContainText('Recorded as “conflicts with”');
    await expect(relation.locator('blockquote')).toContainText('this ordinance does not state which limit controls');

    // The same property a month earlier: the state rule is not yet in force, and nothing is flagged.
    await page.getByLabel('As of').fill('2026-12-15');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByText('No conflict is flagged for this property on this date')).toBeVisible();
    await expect(page.getByText('That is not a finding that every source agrees')).toBeVisible();
    await expect(conflict(page)).toHaveCount(0);
    // The claim observations belong to the snapshot, not to the date: they are still listed.
    await expect(comparison(page)).toHaveCount(4);

    // A date the demo holds no recording for is refused, with the recorded dates offered.
    await page.getByLabel('As of').fill('2026-11-20');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Not available in the synthetic demo' });
    await expect(alert.getByRole('link', { name: 'Use Jan 15, 2027' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('without a property the demo lists the fixture’s claim observations, labeled, with both exact texts and no winner', async ({ page }) => {
    await openDemo(page, '#/disagreements?mode=demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Two sources, side by side.' })).toBeVisible();
    await expect(conflict(page)).toHaveCount(0);

    const section = claimsSection(page);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Claims compared across sources 4');
    await expect(section).toContainText('UX development fixture');
    const notice = section.getByRole('note').filter({ hasText: 'Development fixture · fictional sources' });
    await expect(notice).toContainText('These claims and sources are fictional and were written for layout development.');
    await expect(notice).toContainText('The anchor checks and each classification were computed by the backend.');
    await expect(section.locator('.comparison-counts li')).toHaveText(['2 differ', '1 with support missing or not checking out', '1 is the same']);
    await expect(comparison(page)).toHaveCount(4);
    for (const card of await comparison(page).all()) await expect(card.locator('.disagreement__tags')).toContainText('Development fixture · fictional sources');
    expect(await comparison(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-classification')))).toEqual(['different_claims', 'different_claims', 'missing_support', 'same_claim']);

    // Two claims that differ: both exact texts, each source's authority, type, place, date and address.
    const date = comparison(page, 'cedar_landing_deposit_effective_date');
    await expect(date.locator('.eyebrow')).toHaveText('Effective date');
    await expect(date.getByRole('heading', { level: 3 })).toHaveText('The two claims differ');
    await expect(date.locator('.disagreement__tags')).toContainText('Unresolved');
    await expect(date.locator('.disagreement__tags')).toContainText('No source is preferred');
    await expect(date.locator('.disagreement__tags')).toContainText('Meaning not checked');
    await expect(date).toContainText('whether the difference is a legal conflict has not been decided');
    const adopted = date.getByRole('region', { name: 'First claim' });
    const notified = date.getByRole('region', { name: 'Second claim' });
    await expect(adopted.locator('.claim__stated')).toContainText('Effective dateNov 1, 2026');
    await expect(adopted.locator('blockquote')).toHaveText("Beginning November 1, 2026, residential rental buildings containing at least five units must limit a security deposit to one month's rent.");
    await expect(adopted).toContainText('Exact source text · characters 154–292');
    await expect(adopted.locator('.claim__meta')).toContainText('AuthorityOfficial · synthetic, not actual law');
    await expect(adopted.locator('.claim__meta')).toContainText('Source typeLegal text');
    await expect(adopted.locator('.claim__meta')).toContainText('JurisdictionCedar Landing, ZZ');
    await expect(adopted.locator('.claim__meta')).toContainText('RetrievedOct 3, 2026, 00:00 UTC');
    await expect(adopted.getByRole('link', { name: 'https://example.invalid/ux-dev-fixture/dev-cl-ord-07' })).toBeVisible();
    await expect(notified.locator('.claim__stated')).toContainText('Effective dateDec 1, 2026');
    await expect(notified.locator('blockquote')).toContainText('takes effect on December 1, 2026');
    await expect(notified.locator('.claim__meta')).toContainText('AuthoritySecondary · synthetic, not actual law');
    await expect(notified.locator('.claim__meta')).toContainText('Source typeSecondary');
    // Identifiers and hashes are a step away, and reachable.
    await expect(adopted.getByText('DEV-CL-ORD-07', { exact: true })).toBeHidden();
    await adopted.locator('summary', { hasText: 'Source record and hashes' }).click();
    await expect(adopted.locator('details')).toContainText('DocumentDEV-CL-ORD-07');
    await expect(adopted.locator('details')).toContainText('Matches the recorded hash.');
    await expect(adopted.locator('details')).toContainText(/Recorded hash[0-9a-f]{64}/);

    const checked = date.getByRole('region', { name: 'What was checked' });
    await expect(checked).toContainText('First claim: Its passage was found at its recorded position, in a stored source whose hash matches.');
    await expect(checked).toContainText('Meaning: Semantic support not checked.');
    await expect(checked).toContainText('Precedence: No source preferred, no winner, and no amendment asserted.');
    await expect(date.getByRole('region', { name: 'Next action' })).toContainText(REMEDY);
    await expect(date.locator('.disagreement__affects')).toHaveText('Rules this concerns Cedar Landing deposit cap (fictional)');
    await date.locator('summary', { hasText: 'Observation record' }).click();
    const record = date.locator('details', { hasText: 'Observation record' });
    await expect(record).toContainText('Observationcedar_landing_deposit_effective_date');
    await expect(record).toContainText('Classificationdifferent_claims');
    await expect(record).toContainText('Winnernull');
    await expect(record).toContainText(/Rule IDsr-[0-9a-f]+/);

    const amount = comparison(page, 'larch_point_screening_fee_amount');
    await expect(amount.getByRole('region', { name: 'First claim' }).locator('.claim__stated')).toContainText('Key value$35');
    await expect(amount.getByRole('region', { name: 'Second claim' }).locator('.claim__stated')).toContainText('Key value$50');

    // One claim with a passage, the other with none: nothing is established about how they compare.
    const lifecycle = comparison(page, 'larch_point_rent_limit_enactment');
    await expect(lifecycle.getByRole('heading', { level: 3 })).toHaveText('One claim has no captured passage');
    await expect(lifecycle.getByRole('region', { name: 'First claim' }).locator('.claim__stated')).toContainText('Lifecycle statuspending as of 2026-09-22');
    await expect(lifecycle.getByRole('region', { name: 'Second claim' }).locator('.claim__stated')).toContainText('Lifecycle statusenactment not established');
    await expect(lifecycle.getByRole('region', { name: 'Second claim' }).locator('.claim__absent')).toContainText('No captured passage supports this claim.');
    await expect(lifecycle).toContainText('Nothing is established about how the two claims compare.');

    // The same observation on both sides is not called agreement about the law.
    const enactment = comparison(page, 'larch_point_screening_fee_enactment');
    await expect(enactment.getByRole('heading', { level: 3 })).toHaveText('The two claims are the same');
    await expect(enactment.locator('.disagreement__tags')).toContainText('Same observation · meaning not verified');
    await expect(enactment).toContainText('this is not a finding that the sources agree on the law');
    await expect(enactment.locator('.claim__stated')).toContainText(['Enactment dateSep 9, 2026', 'Enactment dateSep 9, 2026']);

    for (const card of await comparison(page).all()) await expect(card).not.toContainText(/preferred source|more likely|confidence|prevails/i);
    await expectNoHorizontalOverflow(page);

    // Evaluator conflicts are a separate thing, reached for one property and date.
    await expect(page.getByText('Recorded lookups with a conflict flag')).toBeVisible();
    await expect(page.locator('.disagreements__examples a')).toHaveCount(6);
    await page.locator('.disagreements__examples a').first().click();
    await expect(page.getByRole('group', { name: 'Conflict context' })).toBeVisible();
    await expect(conflict(page).first()).toBeVisible();
  });

  test('live API: conflicts for one property work without the comparisons route, and failures are not agreement', async ({ page }) => {
    const fixture = devFixture();
    const handlers = devHandlers(fixture);
    // An older backend: every other route answers, the claim-comparison route does not exist.
    delete handlers['GET /source-comparisons'];
    let unavailable = false;
    const calls = await mockApi(page, {
      ...handlers,
      'POST /lookup/assist': (request) => (unavailable ? { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'No completed extraction; configure provider and run navigator extract' } } } : handlers['POST /lookup/assist']!(request)),
    });
    await openLive(page, '#/disagreements?mode=live');
    // This backend double has no GET /source-comparisons: that is said, and it is not agreement.
    const missing = claimsSection(page).getByRole('alert').filter({ hasText: 'This capability is not available on the connected backend' });
    await expect(missing).toContainText('This backend has no GET /source-comparisons route, so no claim comparisons can be listed.');
    await expect(missing).toContainText('That is a missing capability, not a finding that the sources agree.');
    await expect(comparison(page)).toHaveCount(0);
    // The development fixture's observations are never shown against a live service.
    await expect(page.getByText('Development fixture · fictional sources')).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: 'Conflicts are reported per property and date' })).toContainText('No route lists evaluator conflicts across the whole dataset');
    await expect(conflict(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a property ID.' })).toBeVisible();
    await page.getByLabel('Property ID').fill('DEV-P09');
    await page.getByLabel('As of').fill('2027-01-15');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    await expect(page.getByRole('group', { name: 'Conflict context' })).toContainText('Live API');
    await expect(conflict(page)).toHaveCount(1);
    await expect(conflict(page).locator('.claim')).toHaveCount(2);
    expect(calls.filter((call) => call.path === '/lookup/assist').at(-1)?.body).toEqual({ address_id: 'DEV-P09', as_of: '2027-01-15', answers: [] });
    await expect(page).toHaveURL(/#\/disagreements\?mode=live&address=DEV-P09&as_of=2027-01-15/);

    unavailable = true;
    await page.getByLabel('Property ID').fill('DEV-P07');
    await page.getByRole('button', { name: 'Show conflicts' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'The dataset is not ready' });
    await expect(alert).toContainText('not a finding that the sources agree');
    await expect(conflict(page)).toHaveCount(0);
  });
});
