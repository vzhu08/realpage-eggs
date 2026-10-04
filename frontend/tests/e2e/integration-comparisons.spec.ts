/**
 * The two-source view against a mocked live GET /source-comparisons: the synthetic contract
 * example (contracts/evidence_examples/claim_comparison.json) and hand-built variants of it,
 * one for every outcome and data shape the service can return.
 */
import { type Page, expect, test } from '@playwright/test';
import { type Reply, SYNTHETIC_RULE, clone, contract, expectNoSidewaysScroll, gate, mapleHarbor, mockService } from './integration-helpers';

const example = contract.claimComparison.response;
const base = example.observations.synthetic_missing_support;
const RULE_ID: string = base.rule_ids[0];
const valid = base.before.support[0];
const SOURCE_HASH: string = valid.source.sha256;
const LONG = 'Municipal conflicting ordinances prohibited, with express other-law exception; passed to print 2025-11-18 and effective date not established by any captured passage';

const support = (change: (item: any) => void = () => undefined) => {
  const item = clone(valid);
  change(item);
  return item;
};
const observation = (overrides: Record<string, unknown>) => ({ ...clone(base), ...overrides });

const OBSERVATIONS = {
  a_differ: observation({
    field: 'requirement',
    classification: 'different_claims',
    before: { value: LONG, support: [support()] },
    after: { value: '2026-12', support: [support(), support((item) => Object.assign(item.span, { start: 78, end: 100, text: 'Maple Harbor Ordinance', section: '§ 4(b)' }))] },
  }),
  b_same: observation({ field: 'utility_increase_cutoff', rule_ids: [], classification: 'same_claim', status: 'same_observation_not_semantically_verified', before: { value: '2026-02-02', support: [support()] }, after: { value: '2026-02-02', support: [support()] } }),
  c_absent: clone(base),
  d_stale: observation({
    rule_ids: ['r-not-in-dataset'],
    before: { value: 'A', support: [support()] },
    after: {
      value: 'B',
      support: [
        support((item) => {
          item.anchor_valid = false;
          item.span.source_hash = 'a'.repeat(64);
          Object.assign(item.source, { retrieved_at: null, issues: ['Capture truncated at 48000 characters'], duplicate_of: 'SYNTHETIC-41', manifest_sha256: 'c'.repeat(64), url: 'javascript:alert(1)' });
        }),
      ],
    },
  }),
  e_changed: observation({ before: { value: 'A', support: [support((item) => Object.assign(item, { anchor_valid: false, source: { ...item.source, actual_sha256: 'b'.repeat(64), identity_valid: false } }))] }, after: { value: 'B', support: [support()] } }),
  f_no_source: observation({ before: { value: 'A', support: [support((item) => Object.assign(item, { anchor_valid: false, source: null, span: { ...item.span, doc_id: 'NOT-IN-SNAPSHOT' } }))] }, after: { value: null, support: [] } }),
};

const card = (page: Page, id: string) => page.locator(`[data-comparison="${id}"]`);
const claims = (page: Page) => page.getByRole('region', { name: /^Claims compared across sources/ });
const open = async (page: Page) => {
  await page.goto('about:blank');
  await page.goto('/#/disagreements?mode=live');
  await expect(page.getByRole('heading', { level: 1, name: 'Two sources, side by side.' })).toBeVisible();
};
const serve = (reply: () => Reply | 'abort') =>
  mapleHarbor({
    'GET /source-comparisons': () => reply(),
    'GET /rules/*': ({ url }) => (url.pathname.endsWith(RULE_ID) ? { json: { rule: SYNTHETIC_RULE, versions: [SYNTHETIC_RULE], disclaimer: example.disclaimer } } : { status: 404, json: { detail: { code: 'unknown_id', message: 'Unknown rule ID' } } }),
  });

test.describe('source comparisons (live API, mocked)', () => {
  test('the contract example: one claim with its exact passage, the other with none, no winner and the service’s remedy', async ({ page }) => {
    const calls = await mockService(page, serve(() => ({ json: example })));
    await open(page);
    const section = claims(page);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Claims compared across sources 1');
    await expect(section).toContainText('Live API');
    // Fixture labels belong to the demo only.
    await expect(section).not.toContainText(/development fixture|fictional sources/i);
    await expect(section.getByRole('note')).toHaveCount(0);
    await expect(section.locator('.comparison-counts')).toHaveText('1 with support missing or not checking out');

    const one = card(page, 'synthetic_missing_support');
    await expect(one).toHaveAttribute('data-classification', 'missing_support');
    await expect(one.getByRole('heading', { level: 3 })).toHaveText('One claim has no captured passage');
    await expect(one.locator('.disagreement__tags')).toContainText('Unresolved');
    await expect(one.locator('.disagreement__tags')).toContainText('No source is preferred');
    await expect(one.locator('.disagreement__tags')).toContainText('Meaning not checked');
    await expect(one).toContainText('Nothing is established about how the two claims compare.');

    const first = one.getByRole('region', { name: 'First claim' });
    await expect(first).toHaveAttribute('data-support', 'supported');
    await expect(first.locator('.claim__stated')).toContainText('Effective dateNov 15, 2026');
    await expect(first.locator('blockquote')).toHaveText(valid.span.text);
    await expect(first).toContainText('Exact source text · characters 0–100');
    await expect(first.locator('.claim__meta')).toContainText('AuthorityOfficial · synthetic, not actual law');
    await expect(first.locator('.claim__meta')).toContainText('Source typeLegal text');
    await expect(first.locator('.claim__meta')).toContainText('JurisdictionMaple Harbor, CA');
    await expect(first.locator('.claim__meta')).toContainText('RetrievedOct 3, 2026, 00:00 UTC');
    await expect(first.getByRole('link', { name: 'https://example.invalid/synthetic-42' })).toHaveAttribute('href', 'https://example.invalid/synthetic-42');
    // Hashes and the document ID are one step away.
    await expect(first.getByText(SOURCE_HASH).first()).toBeHidden();
    await first.locator('summary', { hasText: 'Source record and hashes' }).click();
    const record = first.locator('details', { hasText: 'Source record and hashes' });
    await expect(record).toContainText('DocumentSYNTHETIC-42');
    await expect(record).toContainText(`Recorded hash${SOURCE_HASH}`);
    await expect(record).toContainText('Matches the recorded hash.');
    await expect(record).toContainText('anchor_valid: true');

    const second = one.getByRole('region', { name: 'Second claim' });
    await expect(second).toHaveAttribute('data-support', 'none');
    await expect(second.locator('.claim__stated')).toContainText('Effective dateunestablished');
    await expect(second.locator('.claim__absent')).toHaveText('No captured passage supports this claim. It is recorded as a claim only; nothing in the snapshot establishes it.');
    await expect(second.locator('blockquote')).toHaveCount(0);

    const checked = one.getByRole('region', { name: 'What was checked' });
    await expect(checked).toContainText('First claim: Its passage was found at its recorded position, in a stored source whose hash matches.');
    await expect(checked).toContainText('Second claim: No passage was captured for this claim, so there is nothing to check.');
    await expect(checked).toContainText('Meaning: Semantic support not checked.');
    await expect(checked).toContainText('Precedence: No source preferred, no winner, and no amendment asserted.');
    await expect(one.getByRole('region', { name: 'Next action' })).toContainText(base.remedy);
    // The rule is named by its title; its ID is in the record.
    await expect(one.locator('.disagreement__affects')).toHaveText(`Rules this concerns ${SYNTHETIC_RULE.title}`);
    expect(calls.some((call) => call.path === `/rules/${RULE_ID}`)).toBe(true);
    await expect(one.getByText('synthetic_missing_support', { exact: true })).toBeHidden();
    await one.locator('summary', { hasText: 'Observation record' }).click();
    const raw = one.locator('details', { hasText: 'Observation record' });
    for (const text of ['Observationsynthetic_missing_support', 'Fieldeffective_date', 'Classificationmissing_support', 'Statusunresolved', 'Semantic supportnot_checked', 'Winnernull', 'Legal amendmentnull', 'First claim, as recorded"2026-11-15"', 'Second claim, as recorded"unestablished"', `Rule IDs${RULE_ID}`]) await expect(raw).toContainText(text);
    await expect(one).not.toContainText(/preferred source|more likely|confidence|prevails|controls/i);

    // The service's notes, the annotation hash and the per-source hashes are kept, behind a disclosure.
    const about = section.locator('details.about');
    await about.locator('summary').click();
    for (const note of example.notes) await expect(about).toContainText(note);
    await expect(about).toContainText(example.annotation_sha256);
    await expect(about).toContainText(`SYNTHETIC-42 ${SOURCE_HASH}`);
    await expect(about).toContainText(example.disclaimer);
    await expectNoSidewaysScroll(page);
  });

  test('every outcome and data shape: differing and same claims, stale anchors, a changed source, a missing source', async ({ page }) => {
    await mockService(page, serve(() => ({ json: { ...clone(example), observations: OBSERVATIONS } })));
    await open(page);
    const section = claims(page);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Claims compared across sources 6');
    await expect(section.locator('.comparison-counts li')).toHaveText(['1 differs', '4 with support missing or not checking out', '1 is the same']);
    await expect(section.locator('.comparison')).toHaveCount(6);
    // Differing claims first, then missing support, then same claims.
    expect(await section.locator('.comparison').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-comparison')))).toEqual(['a_differ', 'c_absent', 'd_stale', 'e_changed', 'f_no_source', 'b_same']);

    const differ = card(page, 'a_differ');
    await expect(differ.getByRole('heading', { level: 3 })).toHaveText('The two claims differ');
    await expect(differ).toContainText('The two recorded values are literally different');
    await expect(differ).toContainText('whether the difference is a legal conflict has not been decided');
    await expect(differ.getByRole('region', { name: 'First claim' }).locator('.claim__stated')).toContainText(`Requirement${LONG}`);
    // A month stays a month.
    await expect(differ.getByRole('region', { name: 'Second claim' }).locator('.claim__stated')).toContainText('RequirementDec 2026 · month only');
    const passages = differ.getByRole('region', { name: 'Second claim' }).locator('.claim__support');
    await expect(passages).toHaveCount(2);
    await expect(passages.nth(0)).toContainText('Passage 1 of 2');
    await expect(passages.nth(1)).toContainText('Passage 2 of 2');
    await expect(passages.nth(1).locator('blockquote')).toHaveText('Maple Harbor Ordinance');
    await expect(passages.nth(1)).toContainText('Exact source text · characters 78–100 · § 4(b)');
    await expect(differ.getByRole('region', { name: 'What was checked' })).toContainText('Second claim: All 2 passages were found at their recorded positions, in stored sources whose hashes match.');
    await expect(differ).not.toContainText(/\bconflict(s|ing)? (is|are|between)\b/i);

    const same = card(page, 'b_same');
    await expect(same.getByRole('heading', { level: 3 })).toHaveText('The two claims are the same');
    await expect(same.locator('.disagreement__tags')).toContainText('Same observation · meaning not verified');
    await expect(same).toHaveAttribute('data-status', 'same_observation_not_semantically_verified');
    await expect(same).toContainText('this is not a finding that the sources agree on the law');
    await expect(same.locator('.eyebrow')).toHaveText('Utility increase cutoff');
    await expect(same.locator('.disagreement__affects')).toContainText('None named. This observation is not tied to an extracted rule.');

    // A recorded passage that no longer checks out: shown as recorded, never as the source's text.
    const stale = card(page, 'd_stale');
    await expect(stale.getByRole('heading', { level: 3 })).toHaveText('A cited passage no longer checks out against its source');
    const stalePassage = stale.getByRole('region', { name: 'Second claim' }).locator('.claim__support');
    await expect(stalePassage).toHaveAttribute('data-anchor', 'invalid');
    await expect(stalePassage).toHaveAttribute('data-issue', 'anchor_invalid');
    await expect(stalePassage).toContainText('Text as recorded with the claim · characters 0–100');
    await expect(stalePassage).not.toContainText('Exact source text');
    await expect(stalePassage.locator('.claim__problem')).toContainText('Does not count as support');
    await expect(stalePassage.locator('.claim__problem')).toContainText('The service did not confirm this passage at its recorded position in the stored source. The source hash recorded with the passage is not the stored source’s hash.');
    await expect(stalePassage.locator('.claim__meta')).toContainText('RetrievedNot recorded');
    await expect(stalePassage.locator('.claim__meta')).toContainText('Capture issuesCapture truncated at 48000 characters');
    // A URL that is not a web address is shown as text, not as a link.
    await expect(stalePassage.getByRole('link')).toHaveCount(0);
    await expect(stalePassage.locator('.claim__meta')).toContainText('javascript:alert(1)');
    await stalePassage.locator('summary').click();
    await expect(stalePassage).toContainText('Duplicate ofSYNTHETIC-41');
    await expect(stalePassage).toContainText(`Manifest hash${'c'.repeat(64)}`);
    await expect(stalePassage).toContainText('Is not the stored source’s recorded hash.');
    await expect(stalePassage).toContainText('anchor_valid: false');
    await expect(stale.getByRole('region', { name: 'What was checked' })).toContainText('Second claim: Its passage did not pass the check against the stored source, so it does not count as support.');
    // A rule whose record cannot be read keeps its ID, and says so.
    await expect(stale.locator('.disagreement__affects')).toContainText('Rule r-not-in-dataset (its record has not been read)');

    const changed = card(page, 'e_changed');
    const changedPassage = changed.getByRole('region', { name: 'First claim' }).locator('.claim__support');
    await expect(changedPassage).toHaveAttribute('data-issue', 'identity_mismatch');
    await expect(changedPassage.locator('.claim__problem')).toContainText('The stored text of this source does not hash to the hash recorded for it');
    await changedPassage.locator('summary').click();
    await expect(changedPassage).toContainText(`Hash of stored text${'b'.repeat(64)}`);
    await expect(changedPassage).toContainText('Does not match the recorded hash.');

    const absent = card(page, 'f_no_source');
    await expect(absent.getByRole('heading', { level: 3 })).toHaveText('One claim has no captured passage, and a cited passage no longer checks out');
    const orphan = absent.getByRole('region', { name: 'First claim' }).locator('.claim__support');
    await expect(orphan).toHaveAttribute('data-issue', 'source_missing');
    await expect(orphan.locator('.claim__problem')).toContainText('The source this passage was recorded from is not in the snapshot, so the passage cannot be checked.');
    await expect(orphan).toContainText('its authority, date and address cannot be shown');
    await orphan.locator('summary').click();
    await expect(orphan).toContainText('Document citedNOT-IN-SNAPSHOT');
    await expect(absent.getByRole('region', { name: 'Second claim' }).locator('.claim__stated')).toContainText('No value recorded');

    // Every card carries the same three cautions and the service's remedy, whatever its outcome.
    for (const id of Object.keys(OBSERVATIONS)) {
      await expect(card(page, id).locator('.disagreement__tags')).toContainText('No source is preferred');
      await expect(card(page, id).getByRole('region', { name: 'What was checked' })).toContainText('Semantic support not checked');
      await expect(card(page, id).getByRole('region', { name: 'Next action' })).toContainText(base.remedy);
    }
    await expectNoSidewaysScroll(page);
  });

  test('unavailable, empty, loading and every failure are stated as such, never as agreement', async ({ page }) => {
    let reply: () => Reply | 'abort' = () => ({ json: { status: 'unavailable', observations: {}, annotation_sha256: null, source_hashes: {}, notes: ['Core claim annotations are absent from this snapshot.'], disclaimer: example.disclaimer } });
    await mockService(page, serve(() => reply()));
    const section = claims(page);
    const agreement = /sources agree/i;
    const onlyDenied = async () => {
      // "the sources agree" may appear only inside "not a finding that the sources agree".
      const text = (await section.innerText()).replace(/not a finding that (every source agrees|the sources agree)( on the law)?/gi, '');
      expect(text).not.toMatch(agreement);
      await expect(section.locator('.comparison')).toHaveCount(0);
    };

    await open(page);
    await expect(section.getByText('No claim comparisons are saved with this snapshot')).toBeVisible();
    await expect(section).toContainText('That is an absence of comparisons, not a finding that the sources agree.');
    await expect(section).toContainText('Core claim annotations are absent from this snapshot.');
    await onlyDenied();

    reply = () => ({ json: { ...clone(example), observations: {}, notes: [...example.notes, 'Separate internal rule-version/conditional-impact records are not claim observations: Boston_HSNA_existing_candidate'] } });
    await open(page);
    await expect(section.getByText('The snapshot’s annotations contain no claim comparisons')).toBeVisible();
    await expect(section).toContainText('That is not a finding that the sources agree.');
    await expect(section).toContainText('Boston_HSNA_existing_candidate');
    await onlyDenied();

    const hold = gate();
    reply = () => ({ json: example, hold: hold.promise });
    await open(page);
    await expect(section.getByRole('status')).toContainText('Reading the claim comparisons');
    await onlyDenied();
    hold.open();
    await expect(section.locator('.comparison')).toHaveCount(1);

    const failures: Array<{ reply: Reply | 'abort'; title: string; texts: string[]; retry: boolean }> = [
      { reply: { status: 404, json: { detail: 'Not Found' } }, title: 'This capability is not available on the connected backend', texts: ['This backend has no GET /source-comparisons route', 'That is a missing capability, not a finding that the sources agree.'], retry: false },
      { reply: { status: 503, json: { detail: { code: 'dataset_unavailable', message: 'Dataset absent; run navigator ingest' } } }, title: 'The dataset is not ready', texts: ['Dataset absent; run navigator ingest', 'This is a service state, not a finding that the sources agree.'], retry: true },
      { reply: { json: { ...clone(example), observations: { one: { ...clone(base), winner: 'before' } } } }, title: 'The response did not match the contract', texts: ['does not match the SourceComparisonsResponse contract, so it is not shown', 'winner', 'This is a failure to read them, not a finding that the sources agree.'], retry: true },
      { reply: 'abort', title: 'The service could not be reached', texts: ['Could not reach the API', 'This is a failure to read them, not a finding that the sources agree.'], retry: true },
    ];
    for (const failure of failures) {
      reply = () => failure.reply;
      await open(page);
      const alert = section.getByRole('alert').filter({ hasText: failure.title });
      await expect(alert).toBeVisible();
      for (const text of failure.texts) await expect(alert).toContainText(text);
      await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(failure.retry ? 1 : 0);
      await onlyDenied();
    }

    // Trying again reads the list afresh.
    reply = () => ({ json: example });
    await section.getByRole('button', { name: 'Try again' }).click();
    await expect(section.locator('.comparison')).toHaveCount(1);
    await expect(section.getByRole('alert')).toHaveCount(0);
  });
});
