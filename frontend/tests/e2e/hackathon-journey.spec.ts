/**
 * Judge journey, steps 1–5 and 8–9, in the synthetic demo (recordings only; no backend).
 *
 * Every expected value is read from the recording the app replays. Nothing here asserts a
 * legal fact, and nothing here is a check of the actual API (see docs/QA_HACKATHON.md).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  LISTED,
  RESULT_WORD,
  addressLine,
  banner,
  dev,
  distinctStatements,
  evidenceDialog,
  example,
  fullText,
  movedBy,
  openAllDisclosures,
  openDemo,
  openExampleOne,
  recordedAssist,
  recordedChange,
  resultContext,
  shownDate,
  topInViewport,
} from './hackathon-helpers';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('recorded demo · step 1: the start page', () => {
  test('intro, three one-click examples that describe their own recordings, a property chooser, and the labels that never leave', async ({ page }) => {
    await openDemo(page);

    // The synthetic banner and the legal disclaimer are on screen before anything is chosen.
    await expect(banner(page)).toContainText('Synthetic demo');
    await expect(banner(page)).toContainText(/Fictional data/);
    await expect(page.getByRole('banner')).toContainText('Not legal advice. Coverage is not a finding of compliance or a violation.');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start with an example' })).toBeVisible();
    await expect(page.locator('[data-example]')).toHaveCount(3);
    await expect(page.getByText('Recorded on fictional data.')).toBeVisible();

    // Card 2 names its two dates in its link; its sentence must count the recorded lists.
    const portfolio = example(page, 'portfolio_impact');
    const params = new URLSearchParams(((await portfolio.getAttribute('href')) ?? '').split('?')[1] ?? '');
    const change = recordedChange(params.get('before') ?? '', params.get('after') ?? '').response;
    await expect(portfolio).toContainText(`${change.affected_address_ids.length} sample properties are definitely affected`);
    await expect(portfolio).toContainText(`${change.uncertain_address_ids.length} are uncertain`);
    await expect(portfolio).toContainText(`${shownDate(change.before)} → ${shownDate(change.after)}`);
    await expect(portfolio).toContainText(`${dev().addresses.length} properties`);

    // Card 3 counts the recorded claim observations.
    const observations = Object.values(dev().source_comparisons.observations);
    const compare = example(page, 'source_comparison');
    await expect(compare).toContainText(`${observations.length} pairs of recorded claims`);
    await expect(compare).toContainText(`${observations.filter((observation) => observation.classification === 'different_claims').length} differ`);
    await expect(compare).toContainText(/none is given a winner/i);

    // The property chooser sits below the examples and lists the recorded properties.
    await expect(page.getByRole('heading', { name: 'Choose a property', exact: true })).toBeVisible();
    const list = page.getByRole('list', { name: 'Sample properties' });
    for (const item of dev().addresses.slice(0, 3)) await expect(list.getByRole('button', { name: new RegExp(escape(item.property.raw_address.street_address)) })).toBeVisible();

    // Card 1: its sentence must match the recording it opens (read from the URL after the click).
    const first = example(page, 'consequential_fact');
    const sentence = (await first.textContent()) ?? '';
    await first.click();
    await expect(resultContext(page)).toBeVisible();
    await expect.poll(() => page.url()).toContain('address=');
    const opened = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '');
    const assist = recordedAssist(opened.get('address') ?? '', opened.get('as_of') ?? '');
    const question = assist.question_plan.questions[0]!;
    const movable = new Set(question.alternatives.flatMap((alternative) => movedBy(assist.lookup.evaluations, alternative.evaluations))).size;
    expect(sentence).toContain(`can change ${movable} of its ${assist.lookup.evaluations.length}`);
    expect(sentence).toContain(assist.lookup.address.raw_address.street_address);
    expect(sentence).toContain(shownDate(assist.lookup.as_of));
  });
});

test.describe('recorded demo · step 2: the result of example 1', () => {
  test('leads with property and date, counts by status, what is unresolved and the next action; the stored record is collapsed', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const { lookup } = assist;

    // Property and date, with the labels a result must always carry.
    const context = resultContext(page);
    await expect(context).toContainText(addressLine(lookup.address));
    await expect(context).toContainText(`As of ${shownDate(lookup.as_of)}`);
    await expect(context).toContainText('Synthetic data · not actual law');
    await expect(context).toContainText(lookup.disclaimer);
    await expect(banner(page)).toBeVisible();

    // Counts by status equal the recorded evaluations, one entry per status, none merged.
    const counts = new Map<string, number>();
    for (const evaluation of lookup.evaluations) counts.set(evaluation.result, (counts.get(evaluation.result) ?? 0) + 1);
    const tally = page.getByRole('list', { name: 'Results by status' });
    await expect(tally.getByRole('listitem')).toHaveCount(counts.size);
    for (const [result, count] of counts) {
      await expect(tally.getByRole('listitem').filter({ hasText: RESULT_WORD[result]! })).toHaveText(new RegExp(`^\\s*${count}\\s*${escape(RESULT_WORD[result]!)}\\s*$`));
    }
    await expect(page.getByText(`${lookup.evaluations.length} rules returned`)).toBeVisible();

    // What is unresolved is a list of its own, and the next step is the question.
    await expect(page.getByRole('list', { name: 'What is unresolved' }).getByRole('listitem')).not.toHaveCount(0);
    await expect(page.locator('[data-next]')).toHaveAttribute('data-next', assist.question_plan.questions.length ? 'question' : /review|none/);
    await expect(page.getByRole('button', { name: 'Go to the question' })).toBeVisible();

    // Stored facts and the jurisdiction record are one disclosure away, not on the reading path.
    const record = page.locator('details').filter({ hasText: 'Property record: fact provenance and how the location was established' }).first();
    await expect(record).not.toHaveAttribute('open', '');
    await expect(page.getByRole('heading', { name: 'Property facts' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Jurisdiction', exact: true })).toBeHidden();
    await record.locator('summary').first().click();
    await expect(page.getByRole('heading', { name: 'Property facts' })).toBeVisible();
    if (lookup.jurisdiction.method) await expect(record).toContainText(lookup.jurisdiction.method);

    // Evidence never opens by itself.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // "Go to the question" puts the keyboard on the questions.
    await page.getByRole('button', { name: 'Go to the question' }).click();
    await expect(page.getByRole('heading', { name: /^Useful questions/ })).toBeFocused();
  });

  // DEFECT (major, integrator: features/lookup/LookupView.tsx revealMain and the order of the result).
  // Reproduction: #/lookup?mode=demo → click [data-example=consequential_fact]. The page stays at
  // scrollY 0 with the property header and the date form filling the window. At 1440x900 the counts
  // start at y≈737 and the "Go to the question" action at y≈934 (below the fold); at 1512x744 the
  // verdict card starts at y≈670 and its counts and action are below the fold; on a Pixel 7 the card
  // starts at y≈1161 of 839. The result does not lead: a judge must scroll to see any of it.
  test('regression: after the one-click example the counts by status and the "Go to the question" action are inside the first window (repro: click example 1; scrollY stays 0 and the action starts at y≈934 in a 900px window)', async ({ page }) => {
    await openExampleOne(page);
    await expect(page.getByRole('list', { name: 'Results by status' })).toBeVisible();
    expect(await topInViewport(page.getByRole('list', { name: 'Results by status' }))).toBe(true);
    expect(await topInViewport(page.getByRole('button', { name: 'Go to the question' }))).toBe(true);
  });

  test('an unresolved legal municipality stays on the page, in the header, the result context and the unresolved list', async ({ page }) => {
    // Any recorded property whose municipality is not resolved, on any date recorded for it.
    const open = dev().addresses.find((item) => item.resolution.match_quality !== 'resolved')!;
    const entry = dev().assists.find((candidate) => candidate.request.address_id === open.property.address_id)!;
    await openDemo(page, `#/lookup?mode=demo&address=${entry.request.address_id}&as_of=${entry.request.as_of}&run=1`);
    await expect(resultContext(page)).toBeVisible();

    const quality = entry.response.lookup.jurisdiction.match_quality;
    await expect(resultContext(page)).toContainText(new RegExp(`Jurisdiction ${quality}`, 'i'));
    // Visible without opening the property record.
    const record = page.locator('details').filter({ hasText: 'Property record: fact provenance' }).first();
    await expect(record).not.toHaveAttribute('open', '');
    await expect(page.getByRole('note').filter({ hasText: 'Legal municipality not established' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'Legal municipality not established' })).toContainText('The postal city on the address is not treated as the legal municipality.');
    await expect(page.locator('[data-jurisdiction]')).toHaveAttribute('data-jurisdiction', quality);
    await expect(page.locator('[data-cue="jurisdiction"]')).toBeVisible();
    // The postal city is never promoted to the legal municipality.
    await expect(page.locator('[data-jurisdiction]')).not.toContainText(open.property.raw_address.postal_city);
  });
});

test.describe('recorded demo · step 3: the most useful question', () => {
  test('plain-language question, the right control, hypotheticals only on request, then the ACTUAL before → after per rule', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const current = assist.lookup.evaluations;
    const titles = new Map(assist.lookup.rules.map((rule) => [rule.team_rule_id, rule.title]));

    const card = page.locator(`[data-question="${question.question_id}"]`);
    await expect(card).toContainText('Most useful question');
    // The heading is the fact definition's meaning, not a field name.
    await expect(card.getByRole('heading')).toContainText(question.fact.meaning);
    await expect(card.getByRole('heading')).not.toContainText(new RegExp(`\\b${question.fact.field}\\b\\s*$`));

    // The control matches the fact's declared type.
    expect(question.fact.data_type).toBe('integer');
    const input = card.getByRole('textbox');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(card.getByRole('button', { name: 'I don’t know' })).toBeVisible();

    // What the answer could change: the number of results a recorded alternative would move.
    const movable = new Set(question.alternatives.flatMap((alternative) => movedBy(current, alternative.evaluations)));
    await expect(card.locator('[data-consequence]')).toHaveAttribute('data-consequence', String(movable.size));
    for (const ruleId of question.rule_ids) await expect(card).toContainText(titles.get(ruleId)!);
    await expect(card).toContainText(/unverified, applies to this request only/);

    // Hypothetical alternatives stay behind their disclosure.
    const hypotheticals = card.locator('details').filter({ hasText: 'What each answer would mean' });
    await expect(hypotheticals.locator('summary').first()).toContainText(`${question.alternatives.length} hypothetical`);
    await expect(hypotheticals).not.toHaveAttribute('open', '');
    await expect(card.getByText(question.alternatives[0]!.label, { exact: true })).toBeHidden();
    await hypotheticals.locator('summary').first().click();
    await expect(card.getByText('Hypothetical', { exact: true })).toHaveCount(question.alternatives.length);
    await hypotheticals.locator('summary').first().click();

    // A value a person would type: inside a recorded interval, and not its probe when the interval is wider.
    const alternative = question.alternatives.find((candidate) => candidate.interval && candidate.interval.lower !== null && candidate.interval.upper !== null && candidate.interval.upper > candidate.interval.lower) ?? question.alternatives[0]!;
    const probe = alternative.probe_facts[question.fact.field] as number;
    const value = alternative.interval?.upper ?? probe;
    await input.fill(String(value));
    await card.getByRole('button', { name: 'Apply answer' }).click();

    // Before → after for every rule equals the evaluator output recorded for that alternative.
    const changed = page.getByRole('region', { name: 'Re-evaluated with your answers' });
    await expect(changed).toBeVisible();
    const after = new Map(alternative.evaluations.map((evaluation) => [evaluation.team_rule_id, evaluation]));
    await expect(changed.locator('[data-change]')).toHaveCount(current.length);
    for (const before of current) {
      const now = after.get(before.team_rule_id)!;
      const row = changed.locator('[data-change]').filter({ hasText: titles.get(before.team_rule_id)! });
      const afterWord = RESULT_WORD[now.result]!;
      await expect(row).toContainText(new RegExp(`${escape(RESULT_WORD[before.result]!)}\\s*became\\s*${escape(afterWord)}`));
      // A result that is still unknown says what it still needs or why.
      if (now.result === 'unknown') await expect(row).toContainText(/Still (needs|unknown): \S+/);
      if (now.result !== before.result) await expect(row).toContainText(now.explanation);
    }

    // The rule list now shows the recorded outcome: only results a lookup lists.
    for (const evaluation of alternative.evaluations.filter((item) => titles.has(item.team_rule_id))) {
      const row = page.locator(`[data-rule-id="${evaluation.team_rule_id}"][data-result]`);
      if (LISTED.has(evaluation.result)) await expect(row).toHaveAttribute('data-result', evaluation.result);
      else await expect(row).toHaveCount(0);
    }

    // The answer is the person's, unverified, request-local, and its replay provenance is stated.
    const answers = page.getByRole('region', { name: /^Your answers/ });
    const entry = answers.locator(`[data-field="${question.fact.field}"]`);
    await expect(entry).toContainText(String(value));
    await expect(entry).toContainText('You provided · unverified');
    await expect(entry).toContainText('Applied');
    await expect(entry).toContainText(alternative.label);
    if (value !== probe) await expect(entry).toContainText(`recorded for its probe value ${probe}`);
    await expect(answers).toContainText('none changes the stored property record');
    await expect(page.getByRole('status').filter({ hasText: 'The demo does not evaluate rules itself.' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('1 answer of yours');

    // Edit offers the same typed control with the current value; Remove restores the recorded baseline.
    await entry.getByRole('button', { name: /^Edit/ }).click();
    await expect(entry.getByRole('textbox', { name: /^New answer for/ })).toHaveValue(String(value));
    await entry.getByRole('button', { name: 'Cancel' }).click();
    await entry.getByRole('button', { name: /^Remove/ }).click();
    await expect(answers.locator('[data-field]')).toHaveCount(0);
    for (const evaluation of current) await expect(page.locator(`[data-rule-id="${evaluation.team_rule_id}"][data-result]`)).toHaveAttribute('data-result', evaluation.result);
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('no answers');
  });

  // DEFECT (major, integrator: features/questions/QuestionCard.tsx `considered`).
  // Reproduction: example 1 → the card reads "Depending on the answer, 2 of 6 results can change."
  // while the result above it says "3 rules returned" and the start card said "2 of its 3 results".
  // The denominator counts every evaluation inside the alternatives, including rules that are not
  // part of this result (recorded as "inapplicable" for every probe).
  test('regression: the question\'s "N of M results can change" uses the number of results on screen (repro: example 1 shows "2 of 6" under "3 rules returned")', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const movable = new Set(question.alternatives.flatMap((alternative) => movedBy(assist.lookup.evaluations, alternative.evaluations))).size;
    const card = page.locator(`[data-question="${question.question_id}"]`);
    await expect(card.locator('[data-consequence]')).toContainText(`${movable} of the ${assist.lookup.evaluations.length} results above`);
  });

  // DEFECT (minor, integrator: features/questions/QuestionCard.tsx heading).
  // Reproduction: example 1 → heading reads "Number of dwelling units in this building (dwelling units)?".
  test('regression: the question heading does not repeat the unit the meaning already states (repro: example 1 heading "… dwelling units in this building (dwelling units)?")', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const heading = (await page.locator(`[data-question="${question.question_id}"]`).getByRole('heading').textContent()) ?? '';
    const unit = question.fact.unit ?? '';
    expect(heading.toLowerCase().split(unit.toLowerCase()).length - 1).toBeLessThanOrEqual(1);
  });

  // DEFECT (minor, integrator: features/questions/QuestionsPanel.tsx empty-state wording).
  // Reproduction: example 1 → answer the question (any recorded value). "Useful questions 0" then reads
  // "Nothing to ask: the plan found no missing property fact that could change a result." directly under
  // "Re-evaluated with your answers", as if the fact just supplied had never mattered. The same wording
  // appears in live mode, because the service's plan after an answer has no questions either.
  test('regression: after the only question is answered, "Useful questions" says it has been answered, not "Nothing to ask: the plan found no missing property fact…" (repro: example 1 → answer the question)', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const card = page.locator(`[data-question="${question.question_id}"]`);
    await card.getByRole('textbox').fill(String(question.alternatives[0]!.probe_facts[question.fact.field]));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    // Wait for the re-evaluated result, not just for the answer to be recorded.
    await expect(page.getByRole('heading', { name: /^Re-evaluated/ })).toBeVisible();
    await expect(page.getByRole('region', { name: /^Your answers/ }).locator('[data-field]')).toContainText('Applied');
    const questions = page.getByRole('region', { name: /^Useful questions/ });
    await expect(questions).not.toContainText('found no missing property fact that could change a result');
    await expect(questions).toContainText(/answer/i);
  });

  // DEFECT (major, lane B: features/lookup/KeepResult.tsx passes the session's answers, which a date
  // change has already cleared, with a result that still depends on them).
  // Reproduction: example 1 → answer the question → change the date (do not run the lookup) →
  // "Download working export (JSON)". The file's evaluator_results are the ANSWERED results and its
  // query is the earlier date, but request_answers.answers is [] — the answer the results rest on is
  // missing from the file. "Keep this result" itself still says "1 request-local answer".
  test('regression: a working export of a result that depends on an answer lists that answer, also after the date control was changed (repro: example 1 → answer → change date, no rerun → export has request_answers.answers = [])', async ({ page }, testInfo) => {
    const { addressId, asOf, assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const value = question.alternatives[0]!.probe_facts[question.fact.field];
    const card = page.locator(`[data-question="${question.question_id}"]`);
    await card.getByRole('textbox').fill(String(value));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('1 answer of yours');
    const other = dev().assists.find((candidate) => candidate.request.address_id === addressId && candidate.request.as_of !== asOf)!;
    await page.getByLabel('As of date').fill(other.request.as_of);
    await expect(page.getByRole('note').filter({ hasText: 'These results are for' })).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download working export (JSON)' }).click()]);
    const path = testInfo.outputPath('stale-export.json');
    await download.saveAs(path);
    const file = JSON.parse(readFileSync(path, 'utf8')) as { query: { as_of: string }; request_answers: { answers: Array<{ field: string; value: unknown }> } };
    expect(file.query.as_of).toBe(asOf);
    expect(file.request_answers.answers.map((answer) => [answer.field, answer.value])).toEqual([[question.fact.field, value]]);
  });

  test('changing the date clears the answers, labels the result on screen as belonging to the earlier date, and the next lookup carries none', async ({ page }) => {
    const { addressId, asOf, assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const card = page.locator(`[data-question="${question.question_id}"]`);
    await card.getByRole('textbox').fill(String(question.alternatives[0]!.probe_facts[question.fact.field]));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.getByRole('region', { name: /^Your answers/ }).locator('[data-field]')).toContainText('Applied');

    // Another date recorded for the same property.
    const other = dev().assists.find((candidate) => candidate.request.address_id === addressId && candidate.request.as_of !== asOf)!;
    await page.getByLabel('As of date').fill(other.request.as_of);

    // The result on screen was computed with the answer, so the answer stays beside it, read-only,
    // with a line saying it will not be carried to the new date.
    const kept = page.getByRole('region', { name: /^Your answers/ });
    await expect(kept.locator('[data-field]')).toHaveCount(1);
    await expect(kept.locator('[data-answers-readonly]')).toContainText('answers are not carried to another date');
    await expect(kept.getByRole('button', { name: /^(Edit|Remove)/ })).toHaveCount(0);
    const stale = page.getByRole('note').filter({ hasText: `These results are for ${shownDate(asOf)}` });
    await expect(stale).toBeVisible();
    await expect(resultContext(page)).toContainText(`As of ${shownDate(asOf)}`);

    await stale.getByRole('button', { name: `Run lookup for ${shownDate(other.request.as_of)}` }).click();
    await expect(resultContext(page)).toContainText(`As of ${shownDate(other.request.as_of)}`);
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('no answers');
    await expect(page.getByRole('region', { name: /^Your answers/ })).toHaveCount(0);
    for (const evaluation of other.response.lookup.evaluations) await expect(page.locator(`[data-rule-id="${evaluation.team_rule_id}"][data-result]`)).toHaveAttribute('data-result', evaluation.result);
  });
});

test.describe('recorded demo · step 4: evidence on request', () => {
  test('the dialog opens only when asked, shows the exact quote with its offsets and separate checks, and Escape returns focus', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const evaluation = assist.lookup.evaluations[0]!;
    const rule = assist.lookup.rules.find((candidate) => candidate.team_rule_id === evaluation.team_rule_id)!;

    await expect(page.getByRole('dialog')).toHaveCount(0);
    const trigger = page.getByRole('button', { name: `Inspect evidence for ${rule.title}` });
    await trigger.click();

    const dialog = evidenceDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: rule.title })).toBeVisible();
    await expect(dialog).toContainText(`as of ${shownDate(assist.lookup.as_of)}`);

    // Every recorded quote, exactly, with where it sits in its source.
    for (const item of evaluation.evidence) {
      await expect(dialog.getByText(item.quote, { exact: true }).first()).toBeVisible();
      if (item.start !== null && item.start !== undefined) await expect(dialog).toContainText(`${item.start}–${item.end}`);
      await expect(dialog).toContainText(item.doc_id);
    }
    await expect(dialog).toContainText(assist.lookup.disclaimer);

    // The checks are separate checks; each kind the recorded report holds shows its own status.
    await dialog.getByRole('tab', { name: /^Checks/ }).click();
    const checks = dialog.locator('[data-check]');
    await expect(checks).toHaveCount(7);
    const report = assist.evidence_reports.find((candidate) => candidate.rule_id === rule.team_rule_id)!;
    for (const kind of new Set(report.checks.map((check) => check.kind))) {
      const recorded = report.checks.filter((check) => check.kind === kind);
      await expect(dialog.locator(`[data-check="${kind}"] [data-status]`)).toHaveCount(recorded.length);
      for (const check of recorded) await expect(dialog.locator(`[data-check="${kind}"]`)).toContainText(check.message);
    }
    // No single score, confidence or overall verdict is offered.
    const text = await fullText(dialog);
    expect(text).not.toMatch(/\b\d{1,3}\s?%/);
    expect(text).not.toMatch(/confidence|overall (score|result)|verified by (the )?model/i);

    // Escape closes it and puts the keyboard back on the control that opened it.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('recorded demo · step 5: what remains uncertain', () => {
  test('a few grouped topics, and every statement the recording holds is one disclosure away with its remedy, rule ID, quote and hash', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const recorded = distinctStatements(assist.question_plan.remaining_uncertainty);
    const region = page.getByRole('region', { name: /^What remains uncertain/ });
    await expect(region).toBeVisible();

    // Grouped for reading: fewer topics than statements, and the counts on screen agree with each other.
    const topics = region.locator('[data-statements]');
    const topicCount = await topics.count();
    expect(topicCount).toBeGreaterThan(0);
    expect(topicCount).toBeLessThan(recorded.length);

    // Identifiers and hashes are not on the reading path until a disclosure is opened.
    const hashed = recorded.flatMap((item) => item.source_refs ?? []);
    for (const ref of hashed.slice(0, 1)) await expect(region.getByText(ref.source_hash).first()).toBeHidden();

    await openAllDisclosures(region);
    const statements = region.locator('li[data-kind]:not([data-statements])');
    const declared = await topics.evaluateAll((items) => items.reduce((total, item) => total + Number(item.getAttribute('data-statements')), 0));
    await expect(statements).toHaveCount(declared);
    // Nothing the service said is lost by grouping.
    expect(declared).toBeGreaterThanOrEqual(recorded.length);

    const text = await fullText(region);
    for (const item of recorded) {
      expect(text, `statement kept: ${item.message}`).toContain(item.message.replace(/\s+/g, ' '));
      expect(text, `remedy kept: ${item.remedy}`).toContain(item.remedy.replace(/\s+/g, ' '));
      for (const ruleId of item.rule_ids ?? []) expect(text, `rule ID kept: ${ruleId}`).toContain(ruleId);
      for (const ref of item.source_refs ?? []) {
        expect(text, 'source quote kept').toContain(ref.text.replace(/\s+/g, ' '));
        expect(text, 'source hash kept').toContain(ref.source_hash);
      }
    }

    // Only a property fact is offered as answerable; everything else names another kind of next step.
    const kinds = new Set(recorded.map((item) => item.kind));
    for (const kind of kinds) await expect(region.locator(`[data-statements][data-kind="${kind}"]`).first()).toBeVisible();
    for (const topic of await region.locator('[data-statements]:not([data-kind="property_fact"])').all()) await expect(topic).not.toContainText('A factual answer');
  });
});

test.describe('recorded demo · step 8: keep this result', () => {
  test('the demo says the evidence package is a live-service artifact and offers none; the working export is separate and says it is not the package', async ({ page }, testInfo) => {
    const { addressId, asOf } = await openExampleOne(page);
    const keep = page.getByRole('region', { name: 'Keep this result' });

    const pack = keep.getByRole('article', { name: 'Evidence package' });
    await expect(pack.locator('[data-package-unavailable]')).toContainText('Not available in the synthetic demo');
    await expect(pack.locator('[data-package-unavailable]')).toContainText('built by the live service');
    await expect(keep.getByRole('button', { name: /evidence package/i })).toHaveCount(0);

    const working = keep.getByRole('article', { name: 'Working export' });
    await expect(working).toContainText('It is not the evidence package.');
    await expect(working).toContainText(/no source texts and no input, response or code hashes/);
    await expect(keep).toContainText('No independent human review is recorded in either file.');

    const [download] = await Promise.all([page.waitForEvent('download'), working.getByRole('button', { name: 'Download working export (JSON)' }).click()]);
    expect(download.suggestedFilename()).toContain(addressId);
    expect(download.suggestedFilename()).toContain(asOf);
    expect(download.suggestedFilename()).not.toMatch(/^evidence-package/);
    const path = testInfo.outputPath('working-export.json');
    await download.saveAs(path);
    const file = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    // The file says what it is not, that its data is synthetic, and carries none of the package's hashes.
    expect(String(file.notice)).toMatch(/It is not the evidence package the service builds/);
    expect((file.data_origin as { synthetic: boolean }).synthetic).toBe(true);
    expect(JSON.stringify(file)).not.toMatch(/"package_sha256"|"input_sha256"|"response_sha256"/);
  });
});

test.describe('recorded demo · step 9: restart', () => {
  test('"Restart demo" returns to the start page from any view with no property, answers or results carried over', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    const question = assist.question_plan.questions[0]!;
    const card = page.locator(`[data-question="${question.question_id}"]`);
    await card.getByRole('textbox').fill(String(question.alternatives[0]!.probe_facts[question.fact.field]));
    await card.getByRole('button', { name: 'Apply answer' }).click();
    await expect(page.getByRole('region', { name: /^Your answers/ }).locator('[data-field]')).toContainText('Applied');

    await page.getByRole('button', { name: 'Restart demo' }).click();
    await expect(page.getByRole('heading', { name: 'Start with an example' })).toBeVisible();
    await expect(page.locator('[data-example]')).toHaveCount(3);
    await expect(resultContext(page)).toHaveCount(0);
    await expect(page.locator('[data-rule-id]')).toHaveCount(0);
    expect(page.url()).not.toContain('address=');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(banner(page)).toBeVisible();

    // The same example again starts clean: the recorded baseline, no answers.
    await example(page, 'consequential_fact').click();
    await expect(resultContext(page)).toBeVisible();
    await expect(page.getByRole('region', { name: /^Your answers/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Keep this result' })).toContainText('no answers');
    for (const evaluation of assist.lookup.evaluations) await expect(page.locator(`[data-rule-id="${evaluation.team_rule_id}"][data-result]`)).toHaveAttribute('data-result', evaluation.result);

    // From another view, restart also lands on the lookup start page, still in the demo.
    await page.getByRole('link', { name: 'Portfolio changes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/See change\.\s*Understand its reach\./);
    await page.getByRole('button', { name: 'Restart demo' }).click();
    await expect(page.getByRole('heading', { name: 'Start with an example' })).toBeVisible();
    await expect(banner(page)).toBeVisible();
    expect(page.url()).toContain('mode=demo');
  });
});

test.describe('recorded demo · the labels that must stay on screen', () => {
  test('at the bottom of a long result the synthetic banner and the result\'s date, synthetic tag and disclaimer are still in the window', async ({ page }) => {
    const { assist } = await openExampleOne(page);
    await page.getByRole('region', { name: 'Keep this result' }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    for (const region of [banner(page), resultContext(page)]) {
      const inWindow = await region.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + 24, rect.top + Math.min(rect.height / 2, 12));
        return rect.top >= 0 && rect.bottom <= window.innerHeight && !!top && element.contains(top);
      });
      expect(inWindow).toBe(true);
    }
    await expect(resultContext(page)).toContainText(`As of ${shownDate(assist.lookup.as_of)}`);
    await expect(resultContext(page)).toContainText('Synthetic data · not actual law');
    await expect(resultContext(page)).toContainText(assist.lookup.disclaimer);
  });

  // DEFECT (major, lane A styles or integrator: features/evidence/EvidencePanel.tsx).
  // Reproduction: Pixel 7 or any window up to 860px wide → example 1 → "Evidence" on a rule. The evidence
  // sheet covers the whole window, including the synthetic banner, and shows the quoted "law" with no
  // synthetic label in view: the only one inside the sheet is in the collapsed "Rule record" disclosure
  // ("Synthetic fixture, not actual law"). At 1512px the drawer leaves the banner's tag visible.
  test('regression: with the evidence sheet open on a phone a synthetic label is still in the window (repro: Pixel 7 → example 1 → Evidence; the sheet covers the banner and shows no synthetic label)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The full-window evidence sheet is the phone layout; on a desktop window the banner tag stays visible beside the drawer.');
    await openExampleOne(page);
    await page.locator('[aria-label^="Inspect evidence for"]').first().click();
    const dialog = evidenceDialog(page);
    await expect(dialog).toBeVisible();
    const bannerUncovered = await banner(page).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + 24, rect.top + rect.height / 2);
      return !!top && element.contains(top);
    });
    const labelInSheet = await dialog.evaluate((element) =>
      [...element.querySelectorAll('*')].some((node) => {
        if (node.children.length > 0 || !/synthetic|not actual law/i.test(node.textContent ?? '')) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
      }),
    );
    expect(bannerUncovered || labelInSheet).toBe(true);
  });
});
