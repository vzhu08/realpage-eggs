/** Real browser rehearsal against an explicitly selected existing host.
 * node scripts/rehearse-assist.mjs --base http://127.0.0.1:8017 --mode preloaded --output ../artifacts/rehearsal.json
 * --mode cached uses the server cache, with a new browser and no preloader.
 * --mode uncached requires an empty configured server cache; the receipt checks misses.
 * --server-state cold is an operator assertion: restart the server separately first.
 * Hosted execution requires --hosted-authorized after human deployment approval.
 */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : []).filter(a => a.length));
const base = String(args.base ?? 'http://127.0.0.1:8017');
const host = new URL(base).hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && !args['hosted-authorized']) throw new Error('Hosted rehearsal requires deployment authorization and --hosted-authorized.');
const mode = args.mode ?? 'preloaded';
if (!['preloaded', 'cached', 'uncached'].includes(mode)) throw new Error('Unknown mode');
const output = path.resolve(String(args.output ?? `../artifacts/rehearsal-${mode}.json`));
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: !args.headed });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const requests = [];
page.on('response', response => {
  if (response.url().includes('/lookup/assist')) requests.push({ status: response.status(), ...response.headers(), at: Date.now() });
});
const report = { base, mode, serverState: args['server-state'] ?? 'warm-or-uncontrolled', freshBrowser: true,
  checkedAt: new Date().toISOString(), targetMs: 2000, narrationBudgetSeconds: 60,
  steps: [], requests, warnings: [], success: false };
try {
  const manifestResponse = await context.request.get(`${base}/api/v1/demo-requests`);
  if (!manifestResponse.ok()) throw new Error('No configurable demo manifest on selected host');
  const manifest = await manifestResponse.json();
  report.identity = manifest.identity;
  report.manifest = manifest;
  const opening = manifest.steps[0].request;
  const url = `${base}/${mode === 'preloaded' ? '?preload=1' : ''}#/lookup?mode=live&address=${opening.address_id}&as_of=${opening.as_of}`;
  await page.goto(url);
  if (mode === 'preloaded') await page.getByRole('button', { name: 'Open prepared property', exact: true }).waitFor();
  const rehearsalStarted = performance.now();
  const cueTimes = [0, 12, 25, 38, 48];
  const pace = async (index) => {
    if (!args.paced) return;
    const remaining = (cueTimes[index] ?? 48) * 1000 - (performance.now() - rehearsalStarted);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    console.log(`Presenter cue ${manifest.steps[index].id}: ${((performance.now() - rehearsalStarted) / 1000).toFixed(2)}s`);
  };
  const capture = async (id, action) => {
    await page.evaluate(() => { performance.clearMeasures(); performance.clearResourceTimings(); });
    const started = performance.now();
    await action();
    await page.waitForFunction(() => performance.getEntriesByName('realpage:click-to-usable').length > 0, { timeout: 120_000 });
    const metrics = await page.evaluate(() => ({
      measures: performance.getEntriesByType('measure').map(e => ({ name: e.name, ms: e.duration, detail: e.detail })),
      resources: performance.getEntriesByType('resource').filter(e => e.name.includes('/api/')).map(e => ({ name: e.name, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize, duration: e.duration })),
      nodes: document.querySelectorAll('*').length,
    }));
    const click = metrics.measures.find(e => e.name === 'realpage:click-to-usable')?.ms;
    report.steps.push({ id, automationWallMs: performance.now() - started, ...metrics, underTarget: click < 2000 });
    await writeFile(output, JSON.stringify(report, null, 2));
  };
  await pace(0);
  await capture('opening', () => page.getByRole('button', { name: 'Run lookup', exact: true }).click());
  for (const step of manifest.steps.slice(1)) {
    await pace(manifest.steps.indexOf(step));
    const prior = manifest.steps[manifest.steps.indexOf(step) - 1].request;
    const current = step.request;
    if (current.as_of !== prior.as_of) {
      await page.getByLabel('As of date', { exact: true }).fill(current.as_of);
      await capture(step.id, () => page.getByRole('button', { name: 'Run lookup again', exact: true }).click());
      continue;
    }
    const answer = current.answers.find(a => !prior.answers.some(p => p.field === a.field && p.value === a.value && p.provenance === a.provenance));
    if (!answer) throw new Error(`Step ${step.id} has no single changed answer`);
    let form;
    if (prior.answers.some(a => a.field === answer.field)) {
      const history = page.locator(`.answers__item[data-field="${answer.field}"]`);
      await history.getByRole('button', { name: /^Edit/ }).click();
      form = history.locator('form');
    } else {
      form = page.locator(`article.question[data-fact-field="${answer.field}"]`).locator('form');
    }
    if (answer.value === null) {
      await capture(step.id, () => form.getByRole('button', { name: 'I don’t know', exact: true }).click());
    } else {
      if (typeof answer.value === 'boolean') await form.getByRole('radio', { name: answer.value ? 'Yes' : 'No', exact: true }).check();
      else await form.getByRole('textbox').fill(String(answer.value));
      await capture(step.id, () => form.getByRole('button', { name: /^(Apply answer|Re-evaluate)$/ }).click());
    }
  }
  report.measuredInteractionMs = report.steps.reduce((n, step) => n + step.measures.find(e => e.name === 'realpage:click-to-usable').ms, 0);
  if (args.paced) {
    const remaining = 55_000 - (performance.now() - rehearsalStarted);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    const started = performance.now();
    await page.locator('.rule').first().getByRole('button', { name: /^Inspect evidence for/ }).click({ timeout: 10_000 });
    await page.locator('.evidence').waitFor({ timeout: 10_000 });
    await page.locator('.evidence .quote__text').first().waitFor({ timeout: 10_000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const elapsed = performance.now() - started;
    report.evidenceClickMs = elapsed;
    report.pacedFlowSeconds = (performance.now() - rehearsalStarted) / 1000;
    report.pacedWithin60Seconds = report.pacedFlowSeconds < 60;
    report.narration = 'Timed presenter cues; see docs/ASSIST_DEMO.md for the spoken script. No audio recording was made.';
  }
  report.withinClickTarget = report.steps.every(s => s.underTarget) && (!args.paced || report.evidenceClickMs < 2000);
  if (mode === 'uncached' && requests.some(r => r['x-assist-cache'] !== 'miss')) report.warnings.push('Uncached mode was not controlled: at least one request was not a cache miss.');
  if (mode === 'cached' && requests.some(r => r['x-assist-cache'] !== 'hit')) report.warnings.push('Server cache was not fully primed for this flow.');
  report.success = true;
  await page.screenshot({ path: output.replace(/\.json$/, '.png'), fullPage: false });
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(output, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ output, success: report.success, withinClickTarget: report.withinClickTarget, error: report.error }));
