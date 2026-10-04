/**
 * Judge journey, step 6: what changes across the portfolio, in the synthetic demo.
 *
 * Expected numbers are the lengths of the recorded lists and the recorded per-property
 * differences. Recordings only; nothing here is a check of the actual API.
 */
import { expect, test } from '@playwright/test';
import {
  type ChangeRecording,
  RESULT_WORD,
  banner,
  comparisonResult,
  defect,
  dev,
  example,
  openAllDisclosures,
  openDemo,
  recordedChange,
  recordedReplay,
  shownDate,
  topInViewport,
} from './hackathon-helpers';

/** Click the second walkthrough card and return the comparison it opened, read from the address bar. */
async function openPortfolioExample(page: import('@playwright/test').Page): Promise<ChangeRecording> {
  await openDemo(page);
  await example(page, 'portfolio_impact').click();
  await expect(comparisonResult(page)).toBeVisible();
  const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '');
  // Names arrive after the comparison; wait for the record lookups to finish.
  await expect(comparisonResult(page).getByText(/^Reading .* records/)).toHaveCount(0);
  return recordedChange(params.get('before') ?? '', params.get('after') ?? '', params.get('scenario') ?? 'actual');
}

const sourceOf = (ruleId: string): string => dev().rules[ruleId].rule.source_doc_id;

test.describe('recorded demo · step 6: portfolio changes', () => {
  test('totals first: definite, uncertain and conflict-flagged are three separate, overlapping lists and the page says so', async ({ page }) => {
    const { response } = await openPortfolioExample(page);
    const result = comparisonResult(page);

    const context = page.getByRole('group', { name: 'Comparison context' });
    await expect(context).toContainText(shownDate(response.before));
    await expect(context).toContainText(shownDate(response.after));
    await expect(context).toContainText(response.disclaimer);
    await expect(context).toContainText(/fictional/i);
    await expect(banner(page)).toBeVisible();
    await expect(result).toHaveAttribute('data-status', response.status);

    // The three totals are the recorded lists' lengths, each under its own heading.
    const totals: Array<[string, string[]]> = [
      ['Definitely affected', response.affected_address_ids],
      ['Uncertain', response.uncertain_address_ids],
      ['Conflict flagged', response.conflict_flag_address_ids],
    ];
    for (const [title, ids] of totals) {
      const column = result.locator(`[data-impact="${title}"]`);
      await expect(column).toHaveAttribute('data-count', String(ids.length));
      await expect(column).toContainText(title);
    }
    // They overlap in this recording, and the page says they are not a total.
    const both = response.affected_address_ids.filter((id) => response.uncertain_address_ids.includes(id));
    expect(both.length).toBeGreaterThan(0);
    await expect(result).toContainText('The three counts are separate lists and they overlap');

    // A partial result is labeled partial, with the comparison's own notes.
    expect(response.status).toBe('partial');
    const partial = result.getByRole('note').filter({ hasText: 'Partial result' });
    for (const note of response.notes) await expect(partial).toContainText(note);

    // The totals come before the groups, and the groups before the detail.
    const order = await result.evaluate((element) => ['change-impact', 'change-summaries', 'change-diffs'].map((id) => element.querySelector(`#${id}`)?.getBoundingClientRect().top ?? -1));
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[0]!).toBeLessThan(order[1]!);
    expect(order[1]!).toBeLessThan(order[2]!);
  });

  // DEFECT (major, integrator: features/changes/ChangesView.tsx — the result is not revealed when a
  // comparison is opened from a link). Reproduction: #/lookup?mode=demo → click
  // [data-example=portfolio_impact]. The window shows the page title and the comparison form; the
  // totals start about 1,316px down at 1440x900 and 1512x744 (about 2,000px on a Pixel 7), below the
  // form and the list of recorded comparisons, and the page does not scroll to them. The judge sees a
  // form, not "totals first".
  test('regression: the one-click portfolio example shows its totals in the first window (repro: click example 2; the totals start ≈1,316px down at 1440x900 and 1512x744, below the form and the recorded-comparison pills)', async ({ page }) => {
    await openPortfolioExample(page);
    expect(await topInViewport(comparisonResult(page).locator('[data-impact]').first())).toBe(true);
  });

  test('groups are the recorded summary groups, with definite and uncertain in separate columns and a statement that they are not additive', async ({ page }) => {
    const { summary } = await openPortfolioExample(page);
    const result = comparisonResult(page);

    for (const [groups, heading] of [
      [summary.by_jurisdiction, 'By rule jurisdiction'],
      [summary.by_category, 'By rule category'],
    ] as const) {
      const table = result.getByRole('table', { name: heading });
      await expect(table.locator('[data-group]')).toHaveCount(Object.keys(groups).length);
      for (const [key, group] of Object.entries(groups)) {
        const row = table.locator(`[data-group="${key}"]`);
        await expect(row.locator('[data-label="Definite"]')).toHaveText(String(group.affected_address_ids.length));
        await expect(row.locator('[data-label="Uncertain"]')).toHaveText(String(group.uncertain_address_ids.length));
        await expect(row.locator('[data-label="Conflict"]')).toHaveText(String(group.conflict_flag_address_ids.length));
      }
    }
    await expect(result).toContainText('the numbers are not additive');
    // The service's own caveats about the groups stay reachable.
    await openAllDisclosures(result);
    for (const note of summary.notes) await expect(result).toContainText(note);
  });

  test('a readable property view: every recorded difference is a row under its property, never merged across certainty, with before and after evidence', async ({ page }) => {
    const { response, summary } = await openPortfolioExample(page);
    const result = comparisonResult(page);

    await expect(result.getByRole('tab', { name: 'By property' })).toHaveAttribute('aria-selected', 'true');
    const addresses = Object.entries(response.differences).filter(([, deltas]) => deltas.length > 0);
    const nodes = result.locator('[data-address]:not([data-rule])');
    await expect(nodes).toHaveCount(addresses.length);

    for (const [addressId, deltas] of addresses) {
      const node = result.locator(`[data-address="${addressId}"]:not([data-rule])`);
      // Named by its street address, with its ID beside it rather than instead of it.
      const item = dev().addresses.find((candidate) => candidate.property.address_id === addressId)!;
      await expect(node).toContainText(item.property.raw_address.street_address);
      const rows = node.locator('[data-rule]');
      await expect(rows).toHaveCount(deltas.length);
      for (const delta of deltas) {
        const row = node.locator(`[data-rule="${delta.team_rule_id}"]`);
        // The certainty is the comparison's own word for this row.
        await expect(row).toHaveAttribute('data-certainty', delta.certainty);
        await expect(row.locator('summary').first()).toContainText(delta.certainty === 'definite' ? 'Definite' : 'Uncertain');
        await expect(row.locator('summary').first()).toContainText(summary.rule_labels[delta.team_rule_id]!);
        if (delta.before && delta.after) await expect(row.locator('summary').first()).toContainText(new RegExp(`${RESULT_WORD[delta.before.result]}\\s*→?\\s*then\\s*${RESULT_WORD[delta.after.result]}`));
      }
      // A property in both recorded lists shows both, as two counts.
      if (response.affected_address_ids.includes(addressId) && response.uncertain_address_ids.includes(addressId)) {
        await expect(node).toContainText(/\d+ definite/);
        await expect(node).toContainText(/\d+ uncertain/);
      }
      if (response.conflict_flag_address_ids.includes(addressId)) await expect(node).toContainText('Conflict flagged');
    }
    // Uncertain is never folded into definite: the row counts match the recording by certainty.
    for (const certainty of ['definite', 'uncertain']) {
      const expected = addresses.reduce((total, [, deltas]) => total + deltas.filter((delta) => delta.certainty === certainty).length, 0);
      await expect(result.locator(`[data-rule][data-certainty="${certainty}"]`)).toHaveCount(expected);
    }

    // Before and after evidence for one row: both explanations and the exact quotes.
    const [addressId, deltas] = addresses.find(([, list]) => list.some((delta) => delta.before && delta.after && delta.after.evidence.length > 0))!;
    const delta = deltas.find((candidate) => candidate.before && candidate.after && candidate.after.evidence.length > 0)!;
    const row = result.locator(`[data-address="${addressId}"][data-rule="${delta.team_rule_id}"]`);
    await row.locator('summary').first().click();
    await expect(row).toContainText(`Before · ${shownDate(response.before)}`);
    await expect(row).toContainText(`After · ${shownDate(response.after)}`);
    await expect(row.getByText(delta.before!.explanation, { exact: true })).toBeVisible();
    await expect(row.getByText(delta.after!.explanation, { exact: true })).toBeVisible();
    await row.locator('details').filter({ hasText: /^Evidence \(/ }).last().locator('summary').click();
    await expect(row.getByText(delta.after!.evidence[0]!.quote, { exact: true }).last()).toBeVisible();
    await expect(row).toContainText(delta.after!.evidence[0]!.doc_id);
    await expect(row.getByRole('link', { name: `Open lookup as of ${shownDate(response.after)}` })).toHaveAttribute('href', new RegExp(`address=${addressId}.*as_of=${response.after}`));
  });

  test('source → rule → property and the timeline are secondary tabs over the same rows', async ({ page }) => {
    const { response } = await openPortfolioExample(page);
    const result = comparisonResult(page);
    const deltas = Object.entries(response.differences).flatMap(([addressId, list]) => list.map((delta) => ({ addressId, ...delta })));
    const ruleIds = [...new Set(deltas.map((delta) => delta.team_rule_id))];
    const sources = [...new Set(ruleIds.map(sourceOf))];

    const tabs = result.getByRole('tablist', { name: 'Group the comparison results' }).getByRole('tab');
    await expect(tabs).toHaveText([/^By property/, /^By source and rule/, /^Timeline/]);
    await expect(result.locator('[data-timeline]')).toHaveCount(0);

    await result.getByRole('tab', { name: 'By source and rule' }).click();
    await expect(result.locator('[data-source]')).toHaveCount(sources.length);
    for (const docId of sources) {
      const node = result.locator(`[data-source="${docId}"]`);
      await expect(node).toContainText(docId);
      const rules = ruleIds.filter((ruleId) => sourceOf(ruleId) === docId);
      await expect(node.locator('[data-rule]:not([data-address])')).toHaveCount(rules.length);
      for (const ruleId of rules) {
        // Every property the rule reaches in the recording is under it (collapsed levels included).
        await expect(node.locator(`[data-rule="${ruleId}"]:not([data-address]) [data-address]`)).toHaveCount(Math.min(20, deltas.filter((delta) => delta.team_rule_id === ruleId).length));
      }
    }
    // The first source and its first rule start open, showing the rule's exact source text.
    const firstRule = result.locator('[data-source]').first().locator('[data-rule]:not([data-address])').first();
    const ruleId = (await firstRule.getAttribute('data-rule'))!;
    await expect(firstRule.locator('blockquote').first()).toBeVisible();
    await expect(firstRule.locator('blockquote').first()).toHaveText(dev().rules[ruleId].rule.quoted_span);

    // The timeline shows each date as its rule record states it, with the two compared dates marked.
    await result.getByRole('tab', { name: /^Timeline/ }).click();
    const timeline = result.locator('[data-timeline]');
    await expect(timeline).toBeVisible();
    await expect(timeline.locator('[data-query]')).toHaveCount(2);
    for (const id of ruleIds) {
      const effective: string | null = dev().rules[id].rule.effective_date;
      if (effective) await expect(timeline).toContainText(shownDate(effective));
      // A month-only date is never given a day.
      if (effective && /^\d{4}-\d{2}$/.test(effective)) await expect(timeline).toContainText(/month only/);
    }
  });

  test('a blocked comparison reads as blocked: no zero, no "no differences", and the reasons are shown', async ({ page }) => {
    const blocked = recordedReplay().changes.find((entry) => entry.response.status === 'blocked')!;
    await openDemo(page, `#/changes?mode=demo&test=${blocked.request.test_id}`);
    const result = comparisonResult(page);
    await expect(result).toHaveAttribute('data-status', 'blocked');

    const notice = result.getByRole('status').filter({ hasText: 'Blocked: this comparison could not be established' });
    await expect(notice).toContainText('The counts below are not zero');
    for (const note of blocked.response.notes) await expect(notice).toContainText(note);

    for (const column of await result.locator('[data-impact]').all()) {
      await expect(column).toHaveAttribute('data-count', 'blocked');
      await expect(column).toContainText('—');
      await expect(column).toContainText('Not established: the comparison is blocked.');
      await expect(column).not.toContainText(/\b0\b/);
    }
    await expect(result).not.toContainText('No differences between these dates');
    await expect(result).not.toContainText(/nothing changed/i);
  });

  test('a comparison the demo holds no recording for is refused, not shown as an empty result', async ({ page }) => {
    await openDemo(page, '#/changes?mode=demo');
    await page.getByLabel('From date').fill('2031-01-01');
    await page.getByLabel('To date').fill('2031-02-01');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Not available in the synthetic demo' });
    await expect(alert).toContainText('holds no recorded comparison');
    await expect(comparisonResult(page)).toHaveCount(0);
    await expect(page.locator('[data-impact]')).toHaveCount(0);
  });
});
