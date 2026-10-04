/**
 * Judge journey, step 7: two sources side by side, in the synthetic demo.
 *
 * Claim observations are compared with the recorded GET /source-comparisons response; evaluator
 * conflicts with the recorded lookup they come from. Recordings only; not a check of the actual API.
 */
import { expect, test } from '@playwright/test';
import { type Claim, banner, dev, example, fullText, openDemo, recordedAssist, shownDate, shownTimestamp } from './hackathon-helpers';

/** The interface's heading for each classification the service can return. */
const CLASSIFICATION_HEADING = {
  different_claims: 'The two texts state different things',
  missing_support: 'Support is missing on one side',
  same_claim: 'Both texts state the same thing',
} as const;

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}(-\d{2}){0,2}$/.test(value);
const words = (value: string) => value.replace(/[_-]+/g, ' ');

test.describe('recorded demo · step 7: compare sources', () => {
  test('every recorded claim observation shows both exact texts, each side\'s authority and retrieval date, its classification and the service\'s remedy — and no preferred source', async ({ page }) => {
    await openDemo(page);
    await example(page, 'source_comparison').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Two sources, side by side');
    await expect(banner(page)).toBeVisible();

    const recorded = dev().source_comparisons;
    const observations = Object.entries(recorded.observations);
    const section = page.locator('[data-comparisons]');
    await expect(section).toHaveAttribute('data-comparisons', 'ready');
    await expect(section.locator('[data-comparison]')).toHaveCount(observations.length);
    await expect(section).toContainText(/fictional sources/);

    // The three outcomes are counted apart, never as one number of "conflicts".
    const counts = page.getByRole('list', { name: 'Comparisons by outcome' });
    for (const kind of ['different_claims', 'missing_support', 'same_claim'] as const) {
      const expected = observations.filter(([, observation]) => observation.classification === kind).length;
      if (expected > 0) await expect(counts.locator(`[data-kind="${kind}"]`)).toContainText(String(expected));
      else await expect(counts.locator(`[data-kind="${kind}"]`)).toHaveCount(0);
    }

    for (const [id, observation] of observations) {
      const card = section.locator(`[data-comparison="${id}"]`);
      await expect(card).toHaveAttribute('data-classification', observation.classification);
      await expect(card.getByRole('heading')).toHaveText(CLASSIFICATION_HEADING[observation.classification]);
      await expect(card).toContainText('No source is preferred');
      await expect(card).toContainText('Meaning not checked');
      // The remedy is the service's own sentence.
      await expect(card.getByRole('region', { name: 'What would resolve it' })).toContainText(observation.remedy);
      // An unresolved observation is labeled unresolved; a matching one is not called verified.
      await expect(card).toContainText(observation.status === 'unresolved' ? 'Unresolved' : 'meaning not verified');

      for (const key of ['before', 'after'] as const) {
        const claim: Claim = observation[key];
        const side = card.locator(`[data-side="${key}"]`);
        // The claimed value, with a date kept at the precision it was recorded in.
        await expect(side).toContainText(isDate(claim.value) ? shownDate(claim.value) : String(claim.value));
        if (claim.support.length === 0) {
          await expect(side).toHaveAttribute('data-support', 'none');
          await expect(side).toContainText('No captured passage supports this claim');
          await expect(side.locator('blockquote')).toHaveCount(0);
          continue;
        }
        await expect(side.locator('blockquote')).toHaveCount(claim.support.length);
        for (const [index, support] of claim.support.entries()) {
          await expect(side.locator('blockquote').nth(index)).toHaveText(support.span.text);
          await expect(side).toContainText(`characters ${support.span.start}–${support.span.end}`);
          await expect(side).toContainText(new RegExp(words(support.source!.authority), 'i'));
          await expect(side).toContainText(shownTimestamp(support.source!.retrieved_at));
          await expect(side.getByRole('link', { name: support.source!.url })).toHaveAttribute('href', support.source!.url);
          // Hashes are reachable in a disclosure, not on the reading path.
          await expect(side.getByText(support.source!.sha256).first()).toBeHidden();
          expect(await fullText(side)).toContain(support.source!.sha256);
          expect(await fullText(side)).toContain(support.span.source_hash);
        }
      }

      // Nothing on the card ranks the two sides or asserts an amendment.
      const text = await fullText(card);
      expect(text).not.toMatch(/prevails|takes precedence|controlling source|is correct|supersedes|winner:|preferred source:/i);
      expect(text).toMatch(/Precedence\s*None selected/);
      expect(text).toMatch(/Meaning\s*Not checked/);
      for (const ruleId of observation.rule_ids) expect(text).toContain(ruleId);
    }

    // The service's own notes and disclaimer stay reachable.
    const about = await fullText(section);
    for (const note of recorded.notes) expect(about).toContain(note);
    expect(about).toContain(recorded.disclaimer);
  });

  test('evaluator conflicts for one property and date are reached from the lookup\'s "Compare the conflicting sources"', async ({ page }) => {
    // Any recorded lookup in which the evaluator flagged a conflict.
    const entry = dev().assists.find((candidate) => candidate.response.lookup.evaluations.some((evaluation) => evaluation.conflict_flag))!;
    const { lookup } = entry.response;
    const flagged = lookup.evaluations.filter((evaluation) => evaluation.conflict_flag);
    await openDemo(page, `#/lookup?mode=demo&address=${entry.request.address_id}&as_of=${entry.request.as_of}&run=1`);

    // The lookup says how many results the conflict holds open, and that no answer settles it.
    const cue = page.locator('[data-cue="conflict"]');
    await expect(cue).toContainText(`Sources conflict for ${flagged.length} ${flagged.length === 1 ? 'rule' : 'rules'}`);
    await expect(cue).toContainText('No answer about the property resolves a disagreement between sources.');
    for (const evaluation of flagged) await expect(page.locator(`[data-rule-id="${evaluation.team_rule_id}"][data-result]`)).toContainText('Conflict flagged');

    await cue.getByRole('link', { name: 'Compare the conflicting sources' }).click();
    await expect(page).toHaveURL(new RegExp(`#/disagreements\\?.*address=${entry.request.address_id}.*as_of=${entry.request.as_of}`));

    const context = page.getByRole('group', { name: 'Conflict context' });
    await expect(context).toContainText(`As of ${shownDate(lookup.as_of)}`);
    await expect(context).toContainText('Synthetic data · not actual law');
    await expect(context).toContainText(lookup.disclaimer);
    await expect(page.getByText(lookup.address.raw_address.street_address).first()).toBeVisible();

    const conflicts = page.locator('[data-disagreement]');
    await expect(conflicts).not.toHaveCount(0);
    const titles = new Map(lookup.rules.map((rule) => [rule.team_rule_id, rule.title]));
    for (const card of await conflicts.all()) {
      await expect(card).toContainText('Unresolved');
      await expect(card).toContainText('No source is preferred');
      await expect(card).toContainText('A fact about the property cannot settle it.');
      // Each record shown carries its exact source text and when it was retrieved.
      for (const claim of await card.locator('[data-claim]').all()) {
        await expect(claim.locator('blockquote')).not.toHaveCount(0);
        await expect(claim).toContainText('Exact source text');
        await expect(claim).toContainText(/Retrieved\s*\w{3} \d{1,2}, \d{4}, \d{2}:\d{2} UTC/);
      }
    }
    // Every flagged rule is named on some conflict card, by title and ID.
    const all = await fullText(page.locator('[data-disagreement]').first().locator('xpath=..'));
    for (const evaluation of flagged) {
      expect(all).toContain(evaluation.team_rule_id);
      expect(all).toContain(titles.get(evaluation.team_rule_id)!);
    }

    // The claim observations are still listed, and the way back to the lookup keeps the property and date.
    await expect(page.locator('[data-comparison]')).toHaveCount(Object.keys(dev().source_comparisons.observations).length);
    await expect(page.getByRole('link', { name: 'Open the full lookup' })).toHaveAttribute('href', new RegExp(`#/lookup\\?.*address=${entry.request.address_id}.*as_of=${entry.request.as_of}`));
  });

  test('a property with no conflict flag says so without claiming the sources agree', async ({ page }) => {
    const entry = dev().assists.find((candidate) => candidate.response.lookup.evaluations.length > 0 && !candidate.response.lookup.evaluations.some((evaluation) => evaluation.conflict_flag))!;
    expect(recordedAssist(entry.request.address_id, entry.request.as_of).lookup.evaluations.some((evaluation) => evaluation.conflict_flag)).toBe(false);
    await openDemo(page, `#/disagreements?mode=demo&address=${entry.request.address_id}&as_of=${entry.request.as_of}`);
    await expect(page.getByText('No conflict is flagged for this property on this date')).toBeVisible();
    await expect(page.getByText(/That is not a finding that every source agrees/)).toBeVisible();
    await expect(page.locator('[data-disagreement]')).toHaveCount(0);
  });
});
