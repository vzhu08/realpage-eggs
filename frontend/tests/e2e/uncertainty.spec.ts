import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, openDemo } from './helpers';

/** 61 Ember Road: owner occupancy is not on record, and two captured sources disagree about the fee cap. */
async function openEmberRoad(page: import('@playwright/test').Page) {
  await openDemo(page, '#/lookup?mode=demo&address=DEV-P08&as_of=2027-01-15');
  await expect(page.getByRole('heading', { level: 1, name: '61 Ember Road, Larch Point, ZZ' })).toBeVisible();
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('group', { name: 'Result context' })).toContainText('As of Jan 15, 2027');
}

test.describe('consequential questions and what stays uncertain after an answer', () => {
  test('a question says how many results it can move, and each hypothetical shows exactly which', async ({ page }) => {
    await openEmberRoad(page);
    await expect(page.getByRole('group', { name: 'Result context' })).toContainText('UX development fixture');
    const question = page.getByRole('article', { name: /Whether the owner occupies the property/ });
    await expect(question.locator('.question__consequence')).toHaveText('Depending on the answer, 2 of 6 results can change.');
    // Same title, two source documents: the two records are told apart.
    await expect(question.getByRole('button', { name: 'Larch Point screening fee cap (fictional) · DEV-LP-CODE-03' })).toBeVisible();
    await expect(question.getByRole('button', { name: 'Larch Point screening fee cap (fictional) · DEV-LP-ORD-03' })).toBeVisible();

    const yes = question.locator('.alternative', { hasText: 'If owner_occupied: Yes (true)' });
    await expect(yes.getByRole('list', { name: 'Results this answer would change' }).getByRole('listitem')).toHaveCount(2);
    await expect(yes.locator('[data-moved]').first()).toContainText('Unknown');
    await expect(yes.locator('[data-moved]').first()).toContainText('Does not cover');
    await expect(yes).toContainText('4 results would stay the same');
    await expect(yes).toContainText('Hypothetical');

    const no = question.locator('.alternative', { hasText: 'If owner_occupied: No (false)' });
    await expect(no).toContainText('This answer would not change any result by itself.');
    await expect(no).toContainText('6 results would stay the same');
    await expect(no.locator('.alternative__remaining')).toContainText('Conflicting authority');
    await expectNoHorizontalOverflow(page);
  });

  test('after an answer the result that stays unknown says why, and that no property fact can close it', async ({ page }) => {
    await openEmberRoad(page);
    const notice = page.getByRole('note').filter({ hasText: 'Sources conflict for 2 rules here' });
    await expect(notice).toContainText('No answer about the property resolves a disagreement between sources.');

    const question = page.getByRole('article', { name: /Whether the owner occupies the property/ });
    await question.getByRole('button', { name: 'Answer with No as a demo answer' }).click();

    const changed = page.getByRole('region', { name: /Re-evaluated/ });
    await expect(changed.getByRole('heading')).toHaveText('Re-evaluated with your answers');
    const still = changed.locator('[data-still-unknown]');
    await expect(still).toHaveCount(2);
    await expect(still.first()).toContainText('Still unknown, and not for want of a property fact');
    await expect(still.first()).toContainText('Conflicting evidence: Different supported interpretations of the same provision/version; no automatic precedence');
    // The answer is on screen with its provenance and how it was treated.
    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Demo answer · synthetic');
    await expect(answers).toContainText('Applied');

    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    await expect(remaining.getByText('A fact about the property can close these')).toHaveCount(0);
    await expect(remaining.getByText('No answer about the property can close these')).toBeVisible();
    const conflict = remaining.locator('[data-kind="conflict"]').first();
    await expect(conflict).toContainText('Needs: review of conflicting sources');
    await expect(conflict).toContainText('Holds back');
    await expect(conflict).toContainText('Next step Review source authority; factual answers do not resolve legal conflicts');
    // Identical statements are listed once, and items about rules that do not reach this property are set aside.
    await expect(remaining.getByText('Different supported interpretations of the same provision/version; no automatic precedence')).toHaveCount(1);
    await expect(remaining.getByText(/more items? concerns? rules? that do not reach this property/)).toBeVisible();
    await expect(notice).toBeVisible();

    await conflict.getByRole('link', { name: 'Compare the conflicting sources' }).click();
    await expect(page.locator('.disagreement')).toHaveAttribute('data-basis', 'same_provision');
    await expectNoHorizontalOverflow(page);
  });

  test('an answer that takes the property out of the disputed rule removes the conflict from this result', async ({ page }) => {
    await openEmberRoad(page);
    const question = page.getByRole('article', { name: /Whether the owner occupies the property/ });
    await question.getByRole('button', { name: 'Answer with Yes as a demo answer' }).click();
    const changed = page.getByRole('region', { name: /Re-evaluated/ });
    await expect(changed.locator('[data-change="no_longer_listed"]')).toHaveCount(2);
    await expect(changed).toContainText('does not cover this property on this date');
    await expect(page.locator('.rule')).toHaveCount(1);
    await expect(page.getByRole('note').filter({ hasText: /Sources conflict for/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Demo answer · synthetic');
  });

  test('the working export keeps stored facts, request answers and review status apart', async ({ page }) => {
    await openEmberRoad(page);
    await page.getByRole('article', { name: /Whether the owner occupies the property/ }).getByRole('button', { name: 'Answer with No as a demo answer' }).click();
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Applied');

    const section = page.getByRole('region', { name: 'Keep this result' });
    await expect(section).toContainText('It is not the reproducible evidence package');
    const download = page.waitForEvent('download');
    await section.getByRole('button', { name: 'Download working export (JSON)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('navigator-working-export_DEV-P08_2027-01-15.json');
    await expect(section.getByRole('status')).toHaveText('Download started.');

    const data = JSON.parse(readFileSync(await file.path(), 'utf8'));
    expect(data.export_kind).toBe('ux_working_export');
    expect(data.notice).toContain('not the reproducible evidence package (PLAT-06)');
    expect(data.query).toEqual({ address_id: 'DEV-P08', as_of: '2027-01-15' });
    expect(data.data_origin).toMatchObject({ mode: 'demo', label: 'UX development fixture', synthetic: true, api_base: null });
    expect(data.stored_facts.facts).toEqual({ residential: true, units: 4, year_built: 2010 });
    expect(data.request_answers.answers).toEqual([{ field: 'owner_occupied', value: false, provenance: 'demo', disposition: 'applied', disposition_note: expect.anything() }]);
    expect(data.request_answers.history).toHaveLength(1);
    expect(data.evaluator_results.evaluations).toHaveLength(3);
    expect(data.rules.map((rule: { quoted_span: string }) => rule.quoted_span).every((quote: string) => quote.length > 20)).toBe(true);
    expect(data.sources.every((source: Record<string, unknown>) => !('text' in source) && typeof source.sha256 === 'string' && typeof source.retrieved_at === 'string')).toBe(true);
    expect(data.review_status.independent_human_review.recorded).toBe(false);
    expect(data.review_status.model_review.rules).toHaveLength(3);
    expect(data.remaining_uncertainty.length).toBeGreaterThan(0);
    expect(data.disclaimer).toContain('Not legal advice');
  });
});
