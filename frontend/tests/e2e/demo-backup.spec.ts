/**
 * Captures the labeled BACKUP of the judge walkthrough: numbered frames and one recording of
 * the synthetic rehearsal path, for use only if the live real-data demo cannot run. Every
 * frame carries the app's own "Synthetic demo" banner; nothing here is real law or a real
 * result. Skipped in normal runs:
 *
 *   DEMO_BACKUP=1 npm run demo:backup
 *
 * The script follows docs/DEMO_SCRIPT.md step for step.
 */
import { type Page, expect, test } from '@playwright/test';
import { openDemo } from './helpers';

test.skip(!process.env.DEMO_BACKUP, 'Set DEMO_BACKUP=1 to regenerate docs/demo-backup');
test.use({ viewport: { width: 1280, height: 720 }, video: { mode: 'on', size: { width: 1280, height: 720 } } });
test.setTimeout(240_000);

const OUT = 'docs/demo-backup';
/** Long enough to read a frame in the recording. */
const beat = (page: Page, ms = 2200) => page.waitForTimeout(ms);
const top = async (page: Page, selector: string) => {
  await page.locator(selector).first().evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -64);
  await page.waitForTimeout(400);
};
const frame = async (page: Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 76 });
  await beat(page);
};

test('synthetic rehearsal of the four-minute journey (labeled backup)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The backup is recorded once, at desktop width');

  // 1. Disclosure: what this build is replaying.
  await openDemo(page);
  await page.getByRole('button', { name: /Replaying recorded data/ }).click();
  await frame(page, '01-disclosure');
  await page.keyboard.press('Escape');

  // 2. A property, its facts and how its jurisdiction was established; the explicit date.
  await page.getByRole('searchbox', { name: 'Sample properties' }).fill('Ember');
  await page.getByRole('list', { name: 'Sample properties' }).getByRole('button', { name: /61 Ember Road/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '61 Ember Road, Larch Point, ZZ' })).toBeVisible();
  await frame(page, '02-property-and-date');
  await page.getByRole('button', { name: 'Jan 15, 2027', exact: true }).click();
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
  await top(page, '.context');
  await frame(page, '03-result-unknown-and-conflict');

  // 3. One consequential question, and what stays unknown after the answer.
  await top(page, '.question');
  await frame(page, '04-consequential-question');
  await page.getByRole('article', { name: /Whether the owner occupies the property/ }).getByRole('button', { name: 'Answer with No as a demo answer' }).click();
  await expect(page.getByRole('region', { name: /Re-evaluated/ })).toBeVisible();
  await beat(page, 900);
  await frame(page, '05-after-answer-still-unknown');
  await top(page, '#uncertainty-heading');
  await frame(page, '06-remaining-uncertainty');

  // 4. Across a date change: the portfolio.
  await page.getByRole('link', { name: 'Changes', exact: true }).click();
  await page.getByRole('button', { name: 'Oct 1, 2026 → Jan 15, 2027', exact: true }).click();
  const result = page.getByRole('article', { name: 'Comparison result' });
  await expect(result.locator('.source-node')).toHaveCount(4);
  await top(page, '.change-result .context');
  await frame(page, '07-portfolio-impact');
  await top(page, '#change-timeline');
  await frame(page, '08-portfolio-timeline');
  await top(page, '#change-summaries');
  await result.locator('[data-summary="Legal municipality"]').getByRole('button', { name: 'Larch Point, ZZ' }).click();
  await frame(page, '09-portfolio-summaries-filtered');

  // 5. Source → changed rule → impacted property.
  await top(page, '#change-diffs');
  const source = result.locator('.source-node[data-source="DEV-LP-ORD-03"]');
  await source.locator('summary').first().click();
  await source.locator('.rule-node summary').first().click();
  await source.locator('.impact-row[data-address="DEV-P07"] summary').first().click();
  await top(page, '.source-node[data-source="DEV-LP-ORD-03"]');
  await frame(page, '10-source-rule-property');

  // 6. The source disagreement, and what would resolve it.
  await source.locator('.impact-row[data-address="DEV-P07"]').getByRole('link', { name: 'Compare the conflicting sources' }).click();
  await expect(page.locator('.disagreement')).toBeVisible();
  await top(page, '.disagreement');
  await frame(page, '11-source-disagreement');
  await top(page, '.disagreement__resolution');
  await frame(page, '12-what-would-resolve-it');

  // 7. Keep the result.
  await page.getByRole('link', { name: 'Open the full lookup' }).click();
  await page.getByRole('button', { name: 'Run lookup' }).click();
  await expect(page.getByRole('region', { name: 'Keep this result' })).toBeVisible();
  await top(page, '#export-heading');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download working export (JSON)' }).click();
  await download;
  await frame(page, '13-working-export');

  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/synthetic-walkthrough.webm`);
});
