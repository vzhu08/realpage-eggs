/**
 * Helpers for the hackathon acceptance specs (tests/e2e/hackathon-*.spec.ts).
 *
 * Expected values are read from the same recordings and checked-in contract examples the app
 * replays, never typed into a test as a legal fact. What a test asserts is that the screen
 * says what the recording says.
 *
 * Everything here runs against recordings (demo mode) or routes mocked with page.route (live
 * mode). Nothing in these specs talks to a real backend; see docs/QA_HACKATHON.md for the
 * checks that must be run against one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Locator, type Page, type Route, expect, test } from '@playwright/test';
import { expandPooled } from '../../src/demo/pool';

const read = (relative: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8'));

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/* ---------- recordings and contract examples ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Evaluation {
  team_rule_id: string;
  result: string;
  conflict_flag?: boolean;
  missing_facts?: string[];
  uncertainty_reasons?: string[];
  explanation: string;
  evidence: Array<{ doc_id: string; quote: string; start?: number | null; end?: number | null; supports: string[] }>;
}
export interface Uncertainty {
  kind: string;
  message: string;
  remedy: string;
  field?: string | null;
  rule_ids?: string[];
  source_refs?: Array<{ doc_id: string; start: number; end: number; text: string; source_hash: string }>;
}
export interface Alternative {
  alternative_id: string;
  label: string;
  probe_facts: Record<string, unknown>;
  interval?: { lower: number | null; upper: number | null; lower_inclusive?: boolean; upper_inclusive?: boolean } | null;
  evaluations: Evaluation[];
  remaining_uncertainty: Uncertainty[];
}
export interface Question {
  question_id: string;
  prompt: string;
  why: string;
  rule_ids: string[];
  fact: { field: string; meaning: string; data_type: string; unit?: string | null; minimum?: number | null };
  alternatives: Alternative[];
}
export interface Assist {
  lookup: {
    as_of: string;
    disclaimer: string;
    address: { address_id: string; raw_address: { street_address: string; postal_city: string; state: string }; facts: Record<string, unknown>; missing_facts: string[] };
    jurisdiction: { match_quality: string; municipality: string | null; state: string | null; method?: string | null };
    evaluations: Evaluation[];
    rules: Array<{ team_rule_id: string; title: string; source_doc_id: string; citation: string; evidence: Evaluation['evidence'] }>;
  };
  question_plan: { status: string; questions: Question[]; remaining_uncertainty: Uncertainty[] };
  evidence_reports: Array<{ rule_id: string; checks: Array<{ kind: string; status: string; message: string }> }>;
  answers_applied: any[];
}
export interface ChangeRecording {
  store: string;
  request: { before?: string; after?: string; scenario?: string; test_id?: string };
  response: {
    status: 'complete' | 'partial' | 'blocked';
    before: string;
    after: string;
    affected_address_ids: string[];
    uncertain_address_ids: string[];
    conflict_flag_address_ids: string[];
    differences: Record<string, Array<{ team_rule_id: string; certainty: string; before: Evaluation | null; after: Evaluation | null }>>;
    notes: string[];
    disclaimer: string;
  };
  summary: {
    property_labels: Record<string, string>;
    rule_labels: Record<string, string>;
    by_jurisdiction: Record<string, ImpactGroup>;
    by_category: Record<string, ImpactGroup>;
    notes: string[];
  };
}
export interface ImpactGroup {
  rule_ids: string[];
  affected_address_ids: string[];
  uncertain_address_ids: string[];
  conflict_flag_address_ids: string[];
}
export interface Observation {
  field: string;
  classification: 'different_claims' | 'missing_support' | 'same_claim';
  status: string;
  remedy: string;
  rule_ids: string[];
  before: Claim;
  after: Claim;
}
export interface Claim {
  value: unknown;
  support: Array<{ anchor_valid: boolean; span: { doc_id: string; start: number; end: number; text: string; source_hash: string }; source: { authority: string; source_type: string; retrieved_at: string; url: string; sha256: string } | null }>;
}
export interface DevFixture {
  addresses: Array<{ property: Assist['lookup']['address']; resolution: Assist['lookup']['jurisdiction'] }>;
  assists: Array<{ request: { address_id: string; as_of: string }; response: Assist }>;
  rules: Record<string, any>;
  sources: Record<string, any>;
  evidence_reports: Record<string, any>;
  changes: ChangeRecording[];
  source_comparisons: { status: string; observations: Record<string, Observation>; notes: string[]; source_hashes: Record<string, string>; disclaimer: string; annotation_sha256?: string | null };
}

let cachedDev: DevFixture | null = null;
/** The recorded development portfolio, expanded exactly as the app expands it. */
export function dev(): DevFixture {
  cachedDev ??= expandPooled<DevFixture>(read('frontend/src/demo/recorded/portfolio-dev-fixture.json'));
  return cachedDev;
}

/** The backend's own synthetic store, recorded: the blocked published scenarios live here. */
export const recordedReplay = (): { changes: ChangeRecording[] } => read('frontend/src/demo/recorded/synthetic-replay.json');

/** Checked-in contract examples. They double as the mocked backend's responses in live-mode tests. */
export const contract = {
  normal: read('contracts/examples/normal.json'),
  empty: read('contracts/examples/empty.json'),
  unknown: read('contracts/examples/unknown.json'),
  errors: read('contracts/examples/errors.json'),
  /** The implemented API's own response for SYNTH-003 on 2026-11-15, no answers. */
  assist: read('contracts/examples/assist.json'),
  /** POST /lookup/evidence-package for the same property and date with one answer. */
  propertyPackage: read('contracts/evidence_examples/property_package.json'),
  /** POST /changes/summary. */
  changeSummary: read('contracts/evidence_examples/change_summary.json'),
  /** GET /source-comparisons. */
  claimComparison: read('contracts/evidence_examples/claim_comparison.json'),
};

export const recordedAssist = (addressId: string, asOf: string): Assist => {
  const entry = dev().assists.find((candidate) => candidate.request.address_id === addressId && candidate.request.as_of === asOf);
  if (!entry) throw new Error(`No recorded lookup for ${addressId} on ${asOf}`);
  return entry.response;
};

export const recordedChange = (before: string, after: string, scenario = 'actual'): ChangeRecording => {
  const entry = dev().changes.find((candidate) => candidate.request.before === before && candidate.request.after === after && (candidate.request.scenario ?? 'actual') === scenario);
  if (!entry) throw new Error(`No recorded comparison for ${before} → ${after}`);
  return entry;
};

/* ---------- the interface's vocabulary ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A contract date as the interface writes it, keeping the stated precision (YYYY, YYYY-MM, YYYY-MM-DD). */
export function shownDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!month) return year!;
  const name = MONTHS[Number(month) - 1];
  return day ? `${name} ${Number(day)}, ${year}` : `${name} ${year}`;
}

/** A retrieval time as the interface writes it: UTC, with the zone stated. */
export function shownTimestamp(value: string): string {
  const parsed = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}, ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())} UTC`;
}

/** The word the interface uses for each evaluator result. */
export const RESULT_WORD: Record<string, string> = {
  applies: 'Applies',
  unknown: 'Unknown',
  not_yet_effective: 'Not yet effective',
  pending: 'Pending',
  superseded: 'Superseded',
  inapplicable: 'Does not cover',
  failed: 'Failed measure',
};
/** Results a lookup lists (docs/CONTRACTS.md); inapplicable and failed are omitted from the list. */
export const LISTED = new Set(['applies', 'unknown', 'superseded', 'not_yet_effective', 'pending']);

export const addressLine = (address: Assist['lookup']['address']) => `${address.raw_address.street_address}, ${address.raw_address.postal_city}, ${address.raw_address.state}`;

/** Statements the plan left open, with exact duplicates (same kind, wording, remedy and field) counted once. */
export function distinctStatements(items: Uncertainty[]): Uncertainty[] {
  const seen = new Map<string, Uncertainty>();
  for (const item of items) {
    const key = JSON.stringify([item.kind, item.message, item.remedy, item.field ?? null]);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

/** Rules whose result differs between the current evaluations and an alternative's. Both are evaluator output. */
export function movedBy(current: Evaluation[], alternative: Evaluation[]): string[] {
  const now = new Map(current.map((evaluation) => [evaluation.team_rule_id, evaluation.result]));
  return alternative.filter((evaluation) => (now.has(evaluation.team_rule_id) ? now.get(evaluation.team_rule_id) !== evaluation.result : LISTED.has(evaluation.result))).map((evaluation) => evaluation.team_rule_id);
}

/* ---------- opening the app ---------- */

export const banner = (page: Page) => page.getByRole('note', { name: 'Synthetic demo notice' });
export const resultContext = (page: Page) => page.getByRole('group', { name: 'Result context' });
export const example = (page: Page, id: 'consequential_fact' | 'portfolio_impact' | 'source_comparison') => page.locator(`[data-example="${id}"]`);
export const comparisonResult = (page: Page) => page.getByRole('article', { name: 'Comparison result' });
export const evidenceDialog = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('tablist', { name: 'Evidence views' }) });

export async function openDemo(page: Page, hash = '#/lookup?mode=demo') {
  await page.goto(`/${hash}`);
  await expect(banner(page)).toBeVisible();
  await expect(page.locator('#main')).toBeVisible();
}

export async function openLive(page: Page, hash = '#/lookup?mode=live') {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('radio', { name: 'Live API' })).toBeChecked();
}

/** Click the first walkthrough card and return the recording it opened, read from the address bar. */
export async function openExampleOne(page: Page): Promise<{ addressId: string; asOf: string; assist: Assist }> {
  await openDemo(page);
  await example(page, 'consequential_fact').click();
  await expect(resultContext(page)).toBeVisible();
  // The app writes the property and date it opened into the URL; the test reads them from there.
  await expect.poll(() => new URL(page.url()).hash).toContain('address=');
  const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '');
  const addressId = params.get('address') ?? '';
  const asOf = params.get('as_of') ?? '';
  return { addressId, asOf, assist: recordedAssist(addressId, asOf) };
}

/** The page must never scroll sideways, at any width. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** True when the element's top edge is inside the window (not merely attached or displayed). */
export async function topInViewport(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
}

/** Open every native disclosure inside a region, so everything one click away is on screen. */
export async function openAllDisclosures(region: Locator) {
  await region.evaluate((element) => element.querySelectorAll('details').forEach((details) => (details.open = true)));
}

/** Text of a region including collapsed disclosures (textContent), with whitespace normalized. */
export const fullText = async (region: Locator) => ((await region.evaluate((element) => element.textContent)) ?? '').replace(/\s+/g, ' ');

/* ---------- a mocked live API ---------- */

export interface Call {
  method: string;
  path: string;
  body: any;
}
export type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> } | 'abort';
export type Handler = (request: { body: any; url: URL; call: number }) => Reply | Promise<Reply>;

/**
 * Intercepts every /api/v1 call. Handlers may be async, so a test can hold a response and
 * release it later. A route with no handler answers like FastAPI does for an unknown path.
 */
export async function mockLive(page: Page, handlers: Record<string, Handler>): Promise<Call[]> {
  const calls: Call[] = [];
  const counts = new Map<string, number>();
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const body = request.postDataJSON?.() ?? undefined;
    calls.push({ method: request.method(), path, body });
    const key = `${request.method()} ${path}`;
    const pattern = Object.keys(handlers).find((candidate) => candidate === key || (candidate.endsWith('*') && key.startsWith(candidate.slice(0, -1))));
    if (!pattern) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) });
      return;
    }
    const call = (counts.get(pattern) ?? 0) + 1;
    counts.set(pattern, call);
    const result = await handlers[pattern]!({ body, url, call });
    try {
      if (result === 'abort') await route.abort('connectionrefused');
      else await route.fulfill({ status: result.status ?? 200, contentType: 'application/json', headers: result.headers, body: result.text ?? JSON.stringify(result.json) });
    } catch {
      // The page withdrew the request (abort) while the handler was holding it.
    }
  });
  return calls;
}

export const health = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  version: '0.1.0',
  dataset_readiness: 'available',
  sources: 1,
  rules: 1,
  addresses: 3,
  resolved_municipalities: 3,
  last_extraction_outcome: 'success',
  disclaimer: contract.normal.response.disclaimer,
  ...overrides,
});

const addressPage = (url: URL) => {
  const responses = [contract.normal.response, contract.empty.response, contract.unknown.response];
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const items = responses.map((response: any) => ({ property: response.address, resolution: response.jurisdiction })).filter((item) => JSON.stringify(item.property).toLowerCase().includes(q));
  return { total: items.length, offset: 0, limit: Number(url.searchParams.get('limit') ?? 25), items, disclaimer: contract.normal.response.disclaimer };
};

/**
 * A live-API double built only from checked-in contract examples: the three synthetic Maple
 * Harbor properties, the implemented assist response for SYNTH-003 on 2026-11-15, and the
 * evidence-package example's assist response for the same request with units = 8.
 */
export function contractHandlers(): Record<string, Handler> {
  const answered = contract.propertyPackage.response.response;
  return {
    'GET /health': () => ({ json: health() }),
    'GET /addresses': ({ url }) => ({ json: addressPage(url) }),
    'GET /facts': () => ({ json: Object.fromEntries(contract.assist.response.question_plan.questions.map((question: Question) => [question.fact.field, question.fact])) }),
    'GET /rules/*': ({ url }) =>
      url.pathname.endsWith('/evidence')
        ? { status: 404, json: { detail: 'Not Found' } }
        : { json: { rule: contract.assist.response.lookup.rules[0], versions: [contract.assist.response.lookup.rules[0]], disclaimer: contract.normal.response.disclaimer } },
    'GET /sources/*': () => ({ json: { ...contract.assist.response.lookup.sources[0], text: readFileSync(fileURLToPath(new URL('../../../fixtures/synthetic_ordinance.txt', import.meta.url)), 'utf8') } }),
    'POST /lookup/assist': ({ body }) => {
      const sameRequest = body.address_id === contract.assist.request.address_id && body.as_of === contract.assist.request.as_of;
      if (!sameRequest) return { status: 422, json: { detail: { code: 'invalid_input', message: 'No contract example for this request in the test double' } } };
      const wanted = answered.answers_applied[0];
      if (body.answers.length === 0) return { json: contract.assist.response };
      if (body.answers.length === 1 && body.answers[0].field === wanted.field && body.answers[0].value === wanted.value) {
        // The example was recorded with provenance "demo"; the echo carries what this request sent.
        return { json: { ...clone(answered), answers_applied: body.answers.map((answer: any) => ({ note: null, ...answer })) } };
      }
      return { status: 422, json: { detail: { code: 'invalid_input', message: 'No contract example for these answers in the test double' } } };
    },
  };
}

/**
 * The evidence-package example, made to describe the request that was sent, as the service's
 * own package does: the request echo and the response's applied answers both carry exactly the
 * answers this request sent. (The app refuses a package whose echo or applied answers differ.)
 */
export function packageFor(body: any) {
  const pack = clone(contract.propertyPackage.response);
  const answers = (body.answers ?? []).map((answer: any) => ({ note: null, ...answer }));
  pack.request = { ...pack.request, address_id: body.address_id, as_of: body.as_of, answers };
  pack.response.answers_applied = clone(answers);
  return pack;
}

/** The file name the service gives a package (navigator/api.py): the first 12 characters of its hash. */
export const packageFileName = (pack: { package_sha256: string }) => `evidence-package-${pack.package_sha256.slice(0, 12)}.json`;

/** Select a property in the live-mode chooser and run the lookup for a date. */
export async function runLiveLookup(page: Page, street: string, asOf: string) {
  await page.getByRole('list', { name: 'Sample properties' }).getByRole('button', { name: new RegExp(street) }).click();
  await page.getByLabel('As of date').fill(asOf);
  await page.getByRole('button', { name: /^Run lookup/ }).click();
  await expect(resultContext(page)).toBeVisible();
}

/** A promise a test resolves by hand, for holding a mocked response. */
export function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

/** Let pending promise handlers and one React render finish before asserting that nothing happened. */
export const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
