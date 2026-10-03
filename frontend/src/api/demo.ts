/**
 * Synthetic demo adapter. Replays checked-in contract examples and recorded backend output.
 * It evaluates nothing: a request it holds no recording for fails with `not_recorded`.
 */
import {
  FIXTURE_COPY,
  LOOKUP_EXAMPLES,
  RECORDED_CHANGES,
  RECORDED_LOOKUPS,
  RECORDED_MANIFEST,
  RECORDED_PATH,
  RECORDED_RULES,
  RECORDED_SOURCES,
  RESEARCH_FIXTURES,
} from '../demo/fixtures';
import { replayFixture } from '../demo/replay';
import { ApiError } from './errors';
import type {
  AddressItem,
  AddressPage,
  ChangeOutcome,
  ChangeRequest,
  DataSource,
  DemoCatalog,
  EvidenceReportOutcome,
  LookupOutcome,
  LookupQuery,
  LookupResponse,
  RuleDetail,
  SourceDocument,
} from './types';
import { validate, type SchemaName } from './validate';

/** A short, visible delay so loading states are real in the demo without feeling slow. */
const REPLAY_DELAY_MS = 220;

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, REPLAY_DELAY_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
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

export class DemoSource implements DataSource {
  readonly mode = 'demo' as const;
  readonly describe = 'Synthetic demo: replays checked-in examples and recorded backend output';

  async health(): Promise<null> {
    // There is no service in demo mode, so there is no health to report.
    return null;
  }

  private items(): AddressItem[] {
    const seen = new Map<string, AddressItem>();
    for (const example of LOOKUP_EXAMPLES) {
      seen.set(example.response.address.address_id, { property: example.response.address, resolution: example.response.jurisdiction });
    }
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

  async lookup(query: LookupQuery, signal?: AbortSignal): Promise<LookupOutcome> {
    await pause(signal);
    if (query.fixtureCase) return this.fixtureLookup(query);

    const known = this.items().some((item) => item.property.address_id === query.address_id);
    if (!known) {
      throw new ApiError({ kind: 'not_found', endpoint: 'demo lookup', code: 'unknown_id', message: `Unknown address ID ${query.address_id}` });
    }
    const sameRequest = (request: { address_id: string; as_of: string }) => request.address_id === query.address_id && request.as_of === query.as_of;
    const example = LOOKUP_EXAMPLES.find((candidate) => sameRequest(candidate.request));
    const replay = example ? undefined : RECORDED_LOOKUPS.find((candidate) => sameRequest(candidate.request));
    const response: LookupResponse | undefined = example?.response ?? replay?.response;
    if (!response) {
      const dates = this.catalog().lookupDates[query.address_id] ?? [];
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo lookup',
        message: `The synthetic demo holds no recorded lookup for ${query.address_id} on ${query.as_of}.`,
        details: ['Demo mode replays recorded evaluator output and cannot evaluate other dates. Switch to the live API to query any date.'],
        suggestions: dates,
      });
    }
    const { warnings } = checked('LookupResponse', response, 'demo lookup');
    const cases = RESEARCH_FIXTURES.filter((fixture) => sameRequest(fixture.request));
    return {
      query,
      lookup: response,
      assist: null,
      planner: {
        kind: 'no_fixture',
        detail: cases.length
          ? 'This recorded lookup carries no question plan. The question-flow fixtures for this property and date are listed below.'
          : 'No question-flow fixture exists for this property and date.',
      },
      origin: example
        ? { kind: 'checked_in_example', label: 'Checked-in example', detail: example.path }
        : { kind: 'recorded_replay', label: 'Recorded backend output', detail: RECORDED_PATH },
      dispositions: query.answers.map((answer) => ({
        field: answer.field,
        status: 'not_evaluated' as const,
        note: 'Plain demo lookups cannot apply answers. Open a question-flow fixture or switch to the live API.',
      })),
      notices: [],
      contractWarnings: warnings,
    };
  }

  private fixtureLookup(query: LookupQuery): LookupOutcome {
    const fixture = RESEARCH_FIXTURES.find((candidate) => candidate.case === query.fixtureCase);
    if (!fixture) {
      throw new ApiError({ kind: 'not_recorded', endpoint: 'demo lookup', message: `Unknown fixture case “${query.fixtureCase}”.`, suggestions: RESEARCH_FIXTURES.map((item) => item.case) });
    }
    if (fixture.request.address_id !== query.address_id || fixture.request.as_of !== query.as_of) {
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo lookup',
        message: `The “${fixture.case}” fixture is recorded only for ${fixture.request.address_id} on ${fixture.request.as_of}.`,
        suggestions: [fixture.request.as_of],
      });
    }
    const replay = replayFixture(fixture, query.answers);
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
    const detail = RECORDED_RULES[ruleId];
    if (!detail) throw new ApiError({ kind: 'not_recorded', endpoint: 'demo rule detail', message: `No recorded rule detail for ${ruleId}.` });
    return checked('RuleDetail', detail, 'demo rule detail').data;
  }

  async source(docId: string, signal?: AbortSignal): Promise<SourceDocument> {
    await pause(signal);
    const source = RECORDED_SOURCES[docId];
    if (!source) throw new ApiError({ kind: 'not_recorded', endpoint: 'demo source', message: `No recorded source text for ${docId}.` });
    return checked('SourceDocument', source, 'demo source').data;
  }

  async evidenceReport(): Promise<EvidenceReportOutcome> {
    return {
      report: null,
      unavailable: 'No evidence report is checked in yet. The research fixtures carry an empty evidence_reports list and mark evidence_checks as dependency_unavailable.',
    };
  }

  async changes(request: ChangeRequest, signal?: AbortSignal): Promise<ChangeOutcome> {
    await pause(signal);
    const wanted = normalizeChange(request);
    const match = RECORDED_CHANGES.find((candidate) => normalizeChange(candidate.request) === wanted);
    if (!match) {
      throw new ApiError({
        kind: 'not_recorded',
        endpoint: 'demo changes',
        message: `The synthetic demo holds no recorded comparison for ${describeChange(request)}.`,
        details: ['Demo mode replays recorded change results and cannot compute new comparisons. Switch to the live API to compare any dates.'],
        suggestions: RECORDED_CHANGES.map((candidate) => describeChange(candidate.request)),
      });
    }
    const { warnings } = checked('ChangeResult', match.response, 'demo changes');
    return { request, result: match.response, origin: { kind: 'recorded_replay', label: 'Recorded backend output', detail: RECORDED_PATH }, recordedStore: match.store, contractWarnings: warnings };
  }

  catalog(): DemoCatalog {
    const lookupDates: Record<string, string[]> = {};
    const add = (request: { address_id: string; as_of: string }) => {
      const dates = (lookupDates[request.address_id] ??= []);
      if (!dates.includes(request.as_of)) dates.push(request.as_of);
    };
    LOOKUP_EXAMPLES.forEach((example) => add(example.request));
    RECORDED_LOOKUPS.forEach((entry) => add(entry.request));
    Object.values(lookupDates).forEach((dates) => dates.sort());
    return {
      cases: RESEARCH_FIXTURES.map((fixture) => ({
        id: fixture.case,
        title: FIXTURE_COPY[fixture.case]?.title ?? fixture.case,
        purpose: FIXTURE_COPY[fixture.case]?.purpose ?? 'Research contract fixture.',
        address_id: fixture.request.address_id,
        as_of: fixture.request.as_of,
        contractStatus: fixture.contract_status,
        path: fixture.path,
      })),
      lookupDates,
      changeRequests: RECORDED_CHANGES.map((entry) => ({ request: entry.request, store: entry.store })),
      manifest: RECORDED_MANIFEST,
    };
  }
}
