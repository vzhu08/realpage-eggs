import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { recordedAssist } from './hackathon-helpers';
import { expectNoHorizontalOverflow, openDemo, questionCard, showHypotheticals } from './helpers';

const OWNER = 'Whether the owner occupies the property?';

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
    const question = questionCard(page, OWNER);
    await expect(question.locator('.question__consequence')).toHaveText('Depending on the answer, 2 of the 3 results above can change.');
    // Same title, two source documents: the two records are told apart.
    await expect(question.getByRole('button', { name: 'Larch Point screening fee cap (fictional) · DEV-LP-CODE-03' })).toBeVisible();
    await expect(question.getByRole('button', { name: 'Larch Point screening fee cap (fictional) · DEV-LP-ORD-03' })).toBeVisible();

    // What each answer would do is hypothetical, so it stays closed until asked for.
    await showHypotheticals(question);
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
    const notice = page.locator('.cue[data-cue="conflict"]');
    await expect(notice).toContainText('Sources conflict for 2 rules here');
    await expect(notice).toContainText('No answer about the property resolves a disagreement between sources.');

    const question = questionCard(page, OWNER);
    await showHypotheticals(question);
    await question.getByRole('button', { name: 'Answer with No as a demo answer' }).click();

    const changed = page.getByRole('region', { name: /Re-evaluated/ });
    await expect(changed.getByRole('heading')).toHaveText('Re-evaluated with your answers');
    const still = changed.locator('[data-still-unknown]');
    await expect(still).toHaveCount(2);
    await expect(still.first()).toContainText('Still unknown:');
    await expect(still.first()).toContainText('Conflicting evidence: Different supported interpretations of the same provision/version; no automatic precedence');
    // The answer is on screen with its provenance and how it was treated.
    const answers = page.getByRole('region', { name: /Your answers/ });
    await expect(answers).toContainText('Demo answer · synthetic');
    await expect(answers).toContainText('Applied');

    const remaining = page.getByRole('region', { name: /What remains uncertain/ });
    await expect(remaining.getByText('A fact about the property can close these')).toHaveCount(0);
    await expect(remaining.getByText('Needs evidence, interpretation or more analysis')).toBeVisible();
    const conflict = remaining.locator('.uncertainty__item[data-kind="conflict"]');
    // One topic for the conflict, however many statements the service made about it.
    await expect(conflict).toHaveCount(1);
    await expect(conflict.locator('.uncertainty__head')).toContainText('Review of conflicting sources');
    await expect(conflict.locator('.uncertainty__head')).toContainText('Sources conflict and no precedence is established');
    await expect(conflict).toContainText('Holds back');
    await expect(conflict).toContainText('Next step Interpretation review: compare both authorities and their dated support; factual answers do not resolve legal conflicts');
    // The complete, version-specific planner statements already carry this evaluator reason.
    // Do not repeat it as a standalone item; retain every original statement below instead.
    const conflictMessage = 'Different supported interpretations of the same provision/version; no automatic precedence';
    await expect(remaining.getByText(conflictMessage, { exact: true })).toHaveCount(0);
    await expect(remaining.getByText(/more statements? concerns? (a rule|rules) that do not reach this property/)).toBeVisible();
    await expect(notice).toBeVisible();
    // Every statement behind the topic is kept, with the rule ID and encoding hash it names.
    const statements = conflict.locator('.statement');
    await expect(statements.first()).toBeHidden();
    await conflict.locator('summary').click();
    await expect(statements).toHaveCount(Number(await conflict.getAttribute('data-statements')));
    expect(await statements.count()).toBeGreaterThan(1);
    await expect(statements.first().locator('.statement__message')).toContainText(/\[r-[0-9a-f-]+; encoding [0-9a-f]{64}\]/);
    const recorded = recordedAssist('DEV-P08', '2027-01-15');
    const no = recorded.question_plan.questions.find((item) => item.fact.field === 'owner_occupied')!.alternatives.find((alternative) => alternative.probe_facts.owner_occupied === false)!;
    const expectedMessages = [...new Set(no.remaining_uncertainty.filter((item) => item.kind === 'conflict' && item.message.includes(conflictMessage)).map((item) => item.message))];
    expect(expectedMessages.length).toBeGreaterThan(1);
    for (const message of expectedMessages) {
      await expect(statements.locator('.statement__message').filter({ hasText: message })).toHaveCount(1);
      await expect(statements.locator('.statement__message').filter({ hasText: message })).toBeVisible();
    }

    await conflict.getByRole('link', { name: 'Compare the conflicting sources' }).click();
    await expect(page.locator('.disagreement[data-basis]')).toHaveAttribute('data-basis', 'same_provision');
    await expectNoHorizontalOverflow(page);
  });

  test('an answer that takes the property out of the disputed rule removes the conflict from this result', async ({ page }) => {
    await openEmberRoad(page);
    const question = questionCard(page, OWNER);
    await expect(page.locator('.cue[data-cue="conflict"]')).toBeVisible();
    await showHypotheticals(question);
    await question.getByRole('button', { name: 'Answer with Yes as a demo answer' }).click();
    const changed = page.getByRole('region', { name: /Re-evaluated/ });
    await expect(changed.locator('[data-change="no_longer_listed"]')).toHaveCount(2);
    await expect(changed).toContainText('does not cover this property on this date');
    await expect(page.locator('.rule')).toHaveCount(1);
    await expect(page.locator('.cue[data-cue="conflict"]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Demo answer · synthetic');
  });

  test('the working export keeps stored facts, request answers and review status apart', async ({ page }) => {
    await openEmberRoad(page);
    await showHypotheticals(questionCard(page, OWNER));
    await questionCard(page, OWNER).getByRole('button', { name: 'Answer with No as a demo answer' }).click();
    await expect(page.getByRole('region', { name: /Your answers/ })).toContainText('Applied');

    const section = page.getByRole('region', { name: /Keep this result/ });
    // The working export is its own thing; the service-built package is not offered by the replay.
    await expect(section.getByRole('article', { name: 'Working export' })).toContainText(/not the evidence package/i);
    await expect(section.locator('[data-package-unavailable]')).toContainText('synthetic demo');
    await expect(section.getByRole('button', { name: 'Download evidence package' })).toHaveCount(0);
    const download = page.waitForEvent('download');
    await section.getByRole('button', { name: 'Download working export (JSON)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('navigator-working-export_DEV-P08_2027-01-15.json');
    await expect(section.getByRole('status')).toHaveText('Download started.');

    const data = JSON.parse(readFileSync(await file.path(), 'utf8'));
    expect(data.export_kind).toBe('ux_working_export');
    expect(data.notice).toContain('not the evidence package the service builds (POST /lookup/evidence-package)');
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
