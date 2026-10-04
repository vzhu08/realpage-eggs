/**
 * Synthetic demo adapter. Replays checked-in contract examples and recorded backend output.
 * It evaluates nothing: a request it holds no recording for fails with `not_recorded`.
 *
 * Two fictional datasets are replayed and never mixed: the backend's own Maple Harbor store,
 * and the UX development fixture (a fictional portfolio; see src/demo/fixtures.ts).
 */
import {
  ASSIST_EXAMPLE,
  DEV_ADDRESSES,
  DEV_ASSISTS,
  DEV_CHANGES,
  DEV_EVIDENCE_REPORTS,
  DEV_MANIFEST,
  DEV_PATH,
  DEV_RULES,
  DEV_SOURCE_COMPARISONS,
  DEV_SOURCES,
  EVIDENCE_FIXTURES,
  FIXTURE_COPY,
  LOOKUP_EXAMPLES,
  RECORDED_ASSISTS,
  RECORDED_CHANGES,
  RECORDED_MANIFEST,
  RECORDED_PATH,
  RECORDED_RULES,
  RECORDED_SOURCES,
  RESEARCH_FIXTURES,
  type ResearchFixture,
  WALKTHROUGH,
} from '../demo/fixtures';
import { replayAssist } from '../demo/replay';
import { formatDate } from '../lib/dates';
import { readMetadata } from '../lib/metadata';
import { COUNT_ORDER, arrangeComparisons, comparisonCounts, countPhrase } from '../lib/sourceComparisons';
import { consequenceOf } from '../lib/uncertainty';
import { ApiError } from './errors';
import type {
  AddressItem,
  AddressPage,
  ChangeOutcome,
  ChangeRequest,
  DataSource,
  DemoCatalog,
  DemoExample,
  EvidenceReportOutcome,
  FactDefinition,
  LookupOutcome,
  LookupQuery,
  LookupResponse,
  RuleDetail,
  SourceComparisonsOutcome,
  SourceDocument,
} from './types';
import { validate, type SchemaName } from './validate';

/** A short, visible delay so loading states are real in the demo without feeling slow. */
const REPLAY_DELAY_MS = 220;

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException('Aborted', 'AbortError'));
    // A caller that has already gone away gets a cancellation, not a replayed result.
    if (signal?.aborted) return cancel();
    const onAbort = () => {
      clearTimeout(timer);
      cancel();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, REPLAY_DELAY_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function checked<T>(schema: SchemaName, data: T, endpoint: string): { data: T; warnings: string[] } {
  const result = validate(schema, data);
  if (result.errors.length) {
    throw new ApiError({ kind: 'contract', endpoint, message: `A demo fixture no longer matches the ${schema} contract. Regenerate the fixtures.`, details: result.errors });
  }
  return { data, warnings: result.warnings };
}

const normalizeChange = (request: ChangeRequest) =>
  request.test_id
    ? `test:${request.test_id}`
    : `dates:${request.before}:${request.after}:${request.scenario ?? 'actual'}:${[...(request.rule_ids ?? [])].sort().join(',')}`;

const describeChange = (request: ChangeRequest) =>
  request.test_id ? `Scenario ${request.test_id}` : `${request.before} → ${request.after}${request.scenario === 'if_enacted' ? ' (if enacted)' : ''}`;

/** How a result from the UX development fixture is labeled wherever it appears. */
const DEV_ORIGIN_LABEL = 'UX development fixture';

/**
 * Every recorded comparison. The development portfolio comes first so the changes view opens on
 * it; the stores hold no comparison in common (asserted in tests/unit/sources.test.ts).
 */
const ALL_CHANGES = [...DEV_CHANGES, ...RECORDED_CHANGES];

/** Fixture cases the property list offers: the five question-flow fixtures, then the evidence-failure example. */
const CASES: ResearchFixture[] = [...RESEARCH_FIXTURES, ...EVIDENCE_FIXTURES];

export class DemoSource implements DataSource {
  readonly mode = 'demo' as const;
  readonly describe = 'Synthetic demo: replays checked-in examples and recorded backend output';
  /** The lookup response last served, so follow-up requests stay consistent with it. */
  private current: LookupResponse | null = null;

  async health(): Promise<null> {
    // There is no service in demo mode, so there is no health to report.
    return null;
  }

  private items(): AddressItem[] {
    const seen = new Map<string, AddressItem>();
    for (const example of LOOKUP_EXAMPLES) {
      seen.set(example.response.address.address_id, { property: example.response.address, resolution: example.response.jurisdiction });
    }
    for (const item of DEV_ADDRESSES) seen.set(item.property.address_id, item);
    return [...seen.values()].sort((a, b) => a.property.address_id.localeCompare(b.property.address_id));
  }

  async addresses(params: { q: string; offset: number; limit: number }, signal?: AbortSignal): Promise<AddressPage> {
    await pause(signal);
    const needle = params.q.trim().toLowerCase();
    const matches = this.items().filter((item) => `${item.property.address_id} ${item.property.normalized_address}`.toLowerCase().includes(needle));
    const page: AddressPage = {
      total: matches.length,
      offset: params.offset,
      limit: params.limit,
      items: matches.slice(params.offset, params.offset + params.limit),
      disclaimer: LOOKUP_EXAMPLES[0]?.response.disclaimer ?? '',
    };
    return checked('AddressPage', page, 'demo addresses').data;
  }

  /** Fact definitions seen in any checked-in or recorded question, keyed by field. Nothing is authored here. */
  async facts(): Promise<Record<string, FactDefinition> | null> {
    const definitions: Record<string, FactDefinition> = {};
    for (const response of [ASSIST_EXAMPLE.response, ...CASES.map((fixture) => fixture.response), ...RECORDED_ASSISTS.map((entry) => entry.response), ...DEV_ASSISTS.map((entry) => entry.response)]) {
      for (const question of response.question_plan.questions) definitions[question.fact.field] = question.fact;
    }
    return definitions;
  }

  async lookup(query: LookupQuery, signal?: AbortSignal): Promise<LookupOutcome> {
    await pause(signal);
    const outcome = query.fixtureCase ? this.fixtureLookup(query) : this.plainLookup(query);
    this.current = outcome.lookup;
    return outcome;
  }

  private plainLookup(query: LookupQuery): LookupOutcome {
    const known = this.items().some((item) => item.property.address_id === query.address_id);
    if (!known) {
      throw new ApiError({ kind: 'not_found', endpoint: 'demo lookup', code: 'unknown_id', message: `Unknown address ID ${query.address_id}` });
    }
    const sameRequest = (request: { address_id: string; as_of: string }) => request.address_id === query.address_id && request.as_of === query.as_of;
    // The API's own checked-in response wins; other property/date pairs come from recorded backend output.
    const example = sameRequest(ASSIST_EXAMPLE.request) ? ASSIST_EXAMPLE : undefined;
    const recorded = example ? undefined : RECORDED_ASSISTS.find((candidate) => sameRequest(candidate.request));
    const development = example || recorded ? undefined : DEV_ASSISTS.find((candidate) => sameRequest(candidate.request));
    const base = example?.response ?? recorded?.response ?? development?.response;
    if (!base) {
      const dates = this.catalog().lookupDates[query.address_id] ?? [];
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo lookup',
        message: `The synthetic demo holds no recorded lookup for ${query.address_id} on ${query.as_of}.`,
        details: ['Demo mode replays recorded evaluator output and cannot evaluate other dates. Switch to the live API to query any date.'],
        suggestions: dates,
      });
    }
    const replay = replayAssist(base, query.answers);
    const { warnings } = checked('AssistResponse', replay.assist, 'demo lookup');
    return {
      query,
      lookup: replay.assist.lookup,
      assist: replay.assist,
      planner: { kind: 'response' },
      origin: example
        ? { kind: replay.replayed ? 'fixture_replay' : 'checked_in_example', label: 'Checked-in API example', detail: example.path }
        : development
          ? { kind: 'recorded_replay', label: DEV_ORIGIN_LABEL, detail: DEV_PATH }
          : { kind: 'recorded_replay', label: 'Recorded backend output', detail: RECORDED_PATH },
      dispositions: replay.dispositions,
      replayed: replay.replayed,
      notices: replay.notices,
      contractWarnings: warnings,
    };
  }

  private fixtureLookup(query: LookupQuery): LookupOutcome {
    const fixture = CASES.find((candidate) => candidate.case === query.fixtureCase);
    if (!fixture) {
      throw new ApiError({ kind: 'not_recorded', endpoint: 'demo lookup', message: `Unknown fixture case “${query.fixtureCase}”.`, suggestions: CASES.map((item) => item.case) });
    }
    if (fixture.request.address_id !== query.address_id || fixture.request.as_of !== query.as_of) {
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo lookup',
        message: `The “${fixture.case}” fixture is recorded only for ${fixture.request.address_id} on ${fixture.request.as_of}.`,
        suggestions: [fixture.request.as_of],
      });
    }
    const replay = replayAssist(fixture.response, query.answers);
    const { warnings } = checked('AssistResponse', replay.assist, `fixture ${fixture.case}`);
    return {
      query,
      lookup: replay.assist.lookup,
      assist: replay.assist,
      planner: { kind: 'response' },
      origin: { kind: replay.replayed ? 'fixture_replay' : 'checked_in_example', label: 'Contract fixture', detail: fixture.path },
      dispositions: replay.dispositions,
      replayed: replay.replayed,
      fixture: { case: fixture.case, contractStatus: fixture.contract_status },
      notices: replay.notices,
      contractWarnings: warnings,
    };
  }

  async ruleDetail(ruleId: string, signal?: AbortSignal): Promise<RuleDetail> {
    await pause(signal);
    const detail = RECORDED_RULES[ruleId] ?? DEV_RULES[ruleId];
    if (!detail) throw new ApiError({ kind: 'not_recorded', endpoint: 'demo rule detail', message: `No recorded rule detail for ${ruleId}.` });
    return checked('RuleDetail', detail, 'demo rule detail').data;
  }

  async source(docId: string, signal?: AbortSignal): Promise<SourceDocument> {
    await pause(signal);
    // A fixture that reports this source's text as missing must not be contradicted by the recorded text.
    const shown = this.current;
    if (shown && readMetadata(shown).missingSourceIds.includes(docId)) {
      const record = shown.sources.find((source) => source.doc_id === docId);
      if (record) return checked('SourceDocument', { ...record, text: '' }, 'demo source').data;
    }
    const source = RECORDED_SOURCES[docId] ?? DEV_SOURCES[docId];
    if (!source) throw new ApiError({ kind: 'not_recorded', endpoint: 'demo source', message: `No recorded source text for ${docId}.` });
    return checked('SourceDocument', source, 'demo source').data;
  }

  async evidenceReport(ruleId: string): Promise<EvidenceReportOutcome> {
    // The development fixture records the backend's report for each of its rules.
    const report = DEV_EVIDENCE_REPORTS[ruleId];
    if (report) return { report: checked('EvidenceReport', report, 'demo evidence report').data, origin: { kind: 'recorded_replay', label: DEV_ORIGIN_LABEL, detail: DEV_PATH } };
    // Otherwise reports travel inside assist responses. The authored question-flow fixtures carry none.
    return {
      report: null,
      unavailable: 'This fixture carries no evidence report (its evidence_reports list is empty and it marks evidence as dependency_unavailable).',
    };
  }

  async changes(request: ChangeRequest, signal?: AbortSignal): Promise<ChangeOutcome> {
    await pause(signal);
    const wanted = normalizeChange(request);
    const match = ALL_CHANGES.find((candidate) => normalizeChange(candidate.request) === wanted);
    if (!match) {
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo changes',
        message: `The synthetic demo holds no recorded comparison for ${describeChange(request)}.`,
        details: ['Demo mode replays recorded change results and cannot compute new comparisons. Switch to the live API to compare any dates.'],
        suggestions: ALL_CHANGES.map((candidate) => describeChange(candidate.request)),
      });
    }
    // Replayed as POST /changes/summary returns it: Core's result plus the recorded labels and groups.
    const { warnings } = checked('ChangeSummary', { result: match.response, ...match.summary }, 'demo changes');
    const development = match.store === 'dev_portfolio';
    return {
      request,
      result: match.response,
      summary: match.summary,
      notices: [],
      origin: { kind: 'recorded_replay', label: development ? DEV_ORIGIN_LABEL : 'Recorded backend output', detail: development ? DEV_PATH : RECORDED_PATH },
      recordedStore: match.store,
      contractWarnings: warnings,
    };
  }

  /** The development fixture's claim annotations, as the backend re-checked and classified them. */
  async sourceComparisons(signal?: AbortSignal): Promise<SourceComparisonsOutcome> {
    await pause(signal);
    const { data, warnings } = checked('SourceComparisonsResponse', DEV_SOURCE_COMPARISONS, 'demo source comparisons');
    return { response: data, origin: { kind: 'recorded_replay', label: DEV_ORIGIN_LABEL, detail: DEV_PATH }, recordedStore: 'dev_portfolio', contractWarnings: warnings };
  }

  /** Walkthrough examples. Every sentence about an example is counted from the recording it opens. */
  private examples(): DemoExample[] {
    const examples: DemoExample[] = [];
    const street = (addressId: string) => DEV_ADDRESSES.find((item) => item.property.address_id === addressId)?.property.raw_address.street_address ?? addressId;

    const lookup = DEV_ASSISTS.find((entry) => entry.request.address_id === WALKTHROUGH.lookup.address_id && entry.request.as_of === WALKTHROUGH.lookup.as_of);
    const question = lookup?.response.question_plan.questions[0];
    if (lookup && question) {
      const current = lookup.response.lookup.evaluations;
      const movable = new Set(question.alternatives.flatMap((alternative) => consequenceOf(current, alternative.evaluations).changed.map((change) => change.ruleId))).size;
      examples.push({
        id: 'consequential_fact',
        title: 'One fact that changes the answer',
        detail: movable > 0 ? `One question about this property can change ${movable} of its ${current.length} ${current.length === 1 ? 'result' : 'results'}. Answer it and see what moves, and what stays unknown.` : 'A question plan for one property, with what each answer would and would not settle.',
        meta: `${street(lookup.request.address_id)} · as of ${formatDate(lookup.request.as_of)}`,
        target: { view: 'lookup', ...lookup.request },
      });
    }

    const change = DEV_CHANGES.find((entry) => normalizeChange(entry.request) === normalizeChange(WALKTHROUGH.changes));
    if (change) {
      const { response } = change;
      examples.push({
        id: 'portfolio_impact',
        title: 'What changes across the portfolio',
        detail: `Between two dates, ${response.affected_address_ids.length} sample properties are definitely affected and ${response.uncertain_address_ids.length} are uncertain. Follow any change from its source to the rule to each property.`,
        meta: `${formatDate(response.before)} → ${formatDate(response.after)} · ${DEV_ADDRESSES.length} properties`,
        target: { view: 'changes', request: change.request },
      });
    }

    const views = arrangeComparisons(DEV_SOURCE_COMPARISONS);
    if (views.length) {
      const counts = comparisonCounts(views);
      const kinds = COUNT_ORDER.filter((kind) => counts[kind] > 0).map((kind) => countPhrase(kind, counts[kind]));
      examples.push({
        id: 'source_comparison',
        title: 'Two sources, side by side',
        detail: `${views.length} ${views.length === 1 ? 'pair' : 'pairs'} of recorded claims with the exact passages they cite: ${kinds.join(', ')}. None is given a winner, and each says what would settle it.`,
        meta: `${Object.keys(DEV_SOURCE_COMPARISONS.source_hashes).length} fictional sources re-checked`,
        target: { view: 'disagreements' },
      });
    }
    return examples;
  }

  catalog(): DemoCatalog {
    const lookupDates: Record<string, string[]> = {};
    const add = (request: { address_id: string; as_of: string }) => {
      const dates = (lookupDates[request.address_id] ??= []);
      if (!dates.includes(request.as_of)) dates.push(request.as_of);
    };
    add(ASSIST_EXAMPLE.request);
    RECORDED_ASSISTS.forEach((entry) => add(entry.request));
    DEV_ASSISTS.forEach((entry) => add(entry.request));
    Object.values(lookupDates).forEach((dates) => dates.sort());
    return {
      cases: CASES.map((fixture) => ({
        id: fixture.case,
        title: FIXTURE_COPY[fixture.case]?.title ?? fixture.case,
        purpose: FIXTURE_COPY[fixture.case]?.purpose ?? 'Research contract fixture.',
        address_id: fixture.request.address_id,
        as_of: fixture.request.as_of,
        contractStatus: fixture.contract_status,
        path: fixture.path,
      })),
      lookupDates,
      changeRequests: ALL_CHANGES.map((entry) => ({ request: entry.request, store: entry.store })),
      manifest: RECORDED_MANIFEST,
      examples: this.examples(),
      development: {
        path: DEV_PATH,
        manifest: DEV_MANIFEST,
        properties: DEV_ADDRESSES,
        conflictLookups: DEV_ASSISTS.filter((entry) => entry.response.lookup.evaluations.some((evaluation) => evaluation.conflict_flag)).map((entry) => entry.request),
      },
    };
  }
}
