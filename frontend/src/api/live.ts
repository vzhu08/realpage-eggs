/**
 * Live API adapter for the routes in contracts/openapi.json. Newer routes (assist, evidence
 * reports, change summaries, source comparisons, the evidence package) are probed: when the
 * connected backend does not have one, the adapter says so and continues with the older
 * implemented route where one exists. It never substitutes synthetic data.
 */
import { ApiError, errorFromResponse, isAbort } from './errors';
import { PACKAGE_ENDPOINT, packageEchoProblems, packageRequestBody, safeAttachmentName, wireAnswer } from './evidencePackage';
import type {
  AddressPage,
  AnswerDisposition,
  AssistResponse,
  ChangeOutcome,
  ChangeRequest,
  ChangeResult,
  ChangeSummary,
  DataSource,
  EvidencePackage,
  EvidencePackageDownload,
  EvidenceReport,
  EvidenceReportOutcome,
  FactDefinition,
  HealthResponse,
  LookupOutcome,
  LookupQuery,
  LookupResponse,
  RuleDetail,
  SourceComparisonsOutcome,
  SourceComparisonsResponse,
  SourceDocument,
} from './types';
import { validate, type SchemaName } from './validate';

type FetchLike = typeof fetch;

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  schema: SchemaName;
  body?: unknown;
  signal?: AbortSignal;
  /** Overrides the default wait for routes the service documents as slow. */
  timeoutMs?: number;
  /** Said with a timeout on this route: what the wait does and does not mean. */
  timeoutDetails?: string[];
  /**
   * Read the body as bytes and decode it strictly, so the text handed back re-encodes to the
   * very bytes the service sent. Used for a file whose hashes describe its content.
   */
  exact?: boolean;
}

interface Answered<T> {
  data: T;
  warnings: string[];
  /** The response body as text. With `exact`, it re-encodes to the bytes that were received. */
  text: string;
  byteLength: number | null;
  headers: Headers | null;
}

const aborted = () => new DOMException('The request was cancelled.', 'AbortError');
const seconds = (ms: number) => `${ms / 1000} seconds`;

const TIMEOUT_MS = 20_000;
/**
 * A portfolio comparison with no prepared result is recalculated across every sample property
 * (docs/FRONTEND_HANDOFF.md) and can take far longer than a lookup. The view shows the elapsed
 * time and a cancel control for as long as it waits.
 */
export const CHANGES_TIMEOUT_MS = 180_000;
/** The evidence package assembles every rule and source text behind one request. */
export const PACKAGE_TIMEOUT_MS = 60_000;

export { safeAttachmentName } from './evidencePackage';

const CHANGES_TIMEOUT_DETAILS = [
  'A comparison with no prepared result is recalculated across every sample property, which can take longer than this page waits. The service may still be working; this page received nothing.',
  'No comparison is shown. A timeout is not a result, and not a finding that nothing changed.',
];
const PACKAGE_TIMEOUT_DETAILS = ['The package gathers every rule and source text behind this result, which can be slow on a large dataset. Nothing was received, so nothing was saved.'];

/**
 * How a change result differs from the comparison that was asked for. The service echoes the
 * scenario ID, or the two dates and the pending-rule treatment (navigator/changes.py), so a
 * result that names another comparison is refused rather than shown under this request.
 */
export function changeEchoProblems(request: ChangeRequest, result: ChangeResult): string[] {
  const problems: string[] = [];
  const asked = request.test_id ?? null;
  if ((result.test_id ?? null) !== asked) problems.push(`result.test_id is ${JSON.stringify(result.test_id ?? null)}; ${JSON.stringify(asked)} was asked.`);
  if (asked === null) {
    if (result.before !== request.before) problems.push(`result.before is ${JSON.stringify(result.before)}; ${JSON.stringify(request.before ?? null)} was asked.`);
    if (result.after !== request.after) problems.push(`result.after is ${JSON.stringify(result.after)}; ${JSON.stringify(request.after ?? null)} was asked.`);
    const scenario = request.scenario ?? 'actual';
    if (result.scenario !== scenario) problems.push(`result.scenario is ${JSON.stringify(result.scenario)}; ${JSON.stringify(scenario)} was asked.`);
  }
  return problems;
}

export class LiveSource implements DataSource {
  readonly mode = 'live' as const;
  readonly describe: string;
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  /** Remembered per session so a missing planned route is probed once, not on every request. */
  private assistRoute: 'untested' | 'present' | 'absent' = 'untested';
  private evidenceRoute: 'untested' | 'present' | 'absent' = 'untested';
  private summaryRoute: 'untested' | 'present' | 'absent' = 'untested';
  private factDefinitions: Promise<Record<string, FactDefinition> | null> | null = null;

  constructor(baseUrl: string, fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.describe = `Live API at ${this.base}`;
  }

  private async request<T>(options: RequestOptions): Promise<Answered<T>> {
    const endpoint = `${options.method} ${options.path}`;
    // A caller that has already gone away sends nothing.
    if (options.signal?.aborted) throw aborted();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    let timedOut = false;
    const limit = options.timeoutMs ?? TIMEOUT_MS;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limit);
    // A cancelled request always ends as a cancellation, whatever the transport threw.
    const failed = (error: unknown, timeout: string, transport: string): never => {
      if (options.signal?.aborted) throw aborted();
      if (timedOut) throw new ApiError({ kind: 'timeout', endpoint, message: timeout, details: options.timeoutDetails });
      if (isAbort(error)) throw error;
      throw new ApiError({ kind: 'transport', endpoint, message: transport });
    };
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.base}${options.path}`, {
          method: options.method,
          headers: options.body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
      } catch (error) {
        return failed(error, `No response within ${seconds(limit)}, so this page stopped waiting.`, 'Could not reach the API. Check that the backend is running and reachable from this page.');
      }
      let text: string;
      let byteLength: number | null = null;
      try {
        if (options.exact) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          byteLength = bytes.byteLength;
          try {
            text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
          } catch {
            throw new ApiError({ kind: 'contract', endpoint, status: response.status, message: 'The response is not valid UTF-8 text, so it could not be kept exactly as sent and is not saved.' });
          }
        } else {
          text = await response.text();
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        // The wait covers the whole response, not only its first byte.
        return failed(error, `No complete response within ${seconds(limit)}, so this page stopped waiting.`, 'The connection was lost before the response finished.');
      }
      // A response that lands after the caller went away is never handed back.
      if (options.signal?.aborted) throw aborted();
      let body: unknown;
      try {
        body = text ? JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) : undefined;
      } catch {
        body = undefined;
      }
      if (!response.ok) throw errorFromResponse(response.status, body, endpoint, text);
      if (body === undefined) {
        throw new ApiError({ kind: 'contract', endpoint, status: response.status, message: 'The API answered without a JSON body.' });
      }
      const result = validate(options.schema, body);
      if (result.errors.length) {
        throw new ApiError({
          kind: 'contract',
          endpoint,
          status: response.status,
          message: `The response does not match the ${options.schema} contract, so it is not shown.`,
          details: result.errors,
        });
      }
      return { data: body as T, warnings: result.warnings, text, byteLength, headers: response.headers ?? null };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return (await this.request<HealthResponse>({ method: 'GET', path: '/health', schema: 'HealthResponse', signal })).data;
  }

  async addresses(params: { q: string; offset: number; limit: number }, signal?: AbortSignal): Promise<AddressPage> {
    const query = new URLSearchParams({ q: params.q, offset: String(params.offset), limit: String(params.limit) });
    return (await this.request<AddressPage>({ method: 'GET', path: `/addresses?${query}`, schema: 'AddressPage', signal })).data;
  }

  async lookup(query: LookupQuery, signal?: AbortSignal): Promise<LookupOutcome> {
    const notices: string[] = [];
    if (this.assistRoute !== 'absent') {
      try {
        // All accumulated answers are resent on every stateless request (docs/ASSIST_CONTRACT.md).
        const body = { address_id: query.address_id, as_of: query.as_of, answers: query.answers.map(wireAnswer) };
        const { data, warnings } = await this.request<AssistResponse>({ method: 'POST', path: '/lookup/assist', schema: 'AssistResponse', body, signal });
        this.assistRoute = 'present';
        const applied = new Set(data.answers_applied.map((answer) => answer.field));
        return {
          query,
          lookup: data.lookup,
          assist: data,
          planner: { kind: 'response' },
          origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/lookup/assist` },
          dispositions: query.answers.map((answer) => ({
            field: answer.field,
            status: applied.has(answer.field) ? 'applied' : 'not_evaluated',
            note: applied.has(answer.field) ? undefined : 'The service did not echo this answer in answers_applied.',
          })),
          notices,
          contractWarnings: warnings,
        };
      } catch (error) {
        if (!(error instanceof ApiError) || error.kind !== 'not_implemented') throw error;
        this.assistRoute = 'absent';
      }
    }

    // Visible, implemented fallback: POST /lookup with request-local supplemental_facts.
    const known = query.answers.filter((answer) => answer.value !== null);
    const supplemental = Object.fromEntries(known.map((answer) => [answer.field, answer.value]));
    const body: Record<string, unknown> = { address_id: query.address_id, as_of: query.as_of };
    if (known.length) body.supplemental_facts = supplemental;
    const { data, warnings } = await this.request<LookupResponse>({ method: 'POST', path: '/lookup', schema: 'LookupResponse', body, signal });
    const dispositions: AnswerDisposition[] = query.answers.map((answer) =>
      answer.value === null
        ? { field: answer.field, status: 'withheld_unknown', note: 'Marked unknown: nothing is sent, so the service keeps treating this fact as missing.' }
        : { field: answer.field, status: 'sent_as_supplemental_fact', note: 'Sent as a request-local supplemental fact. The service labels it user-supplied and unverified.' },
    );
    return {
      query,
      lookup: data,
      assist: null,
      planner: { kind: 'endpoint_unavailable', detail: 'POST /lookup/assist is not available on this backend. Results below come from POST /lookup.' },
      origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/lookup` },
      dispositions,
      notices,
      contractWarnings: warnings,
    };
  }

  async ruleDetail(ruleId: string, signal?: AbortSignal): Promise<RuleDetail> {
    return (await this.request<RuleDetail>({ method: 'GET', path: `/rules/${encodeURIComponent(ruleId)}`, schema: 'RuleDetail', signal })).data;
  }

  async source(docId: string, signal?: AbortSignal): Promise<SourceDocument> {
    return (await this.request<SourceDocument>({ method: 'GET', path: `/sources/${encodeURIComponent(docId)}`, schema: 'SourceDocument', signal })).data;
  }

  async evidenceReport(ruleId: string, signal?: AbortSignal): Promise<EvidenceReportOutcome> {
    const unavailable = 'GET /rules/{id}/evidence is not available on this backend, so no evidence checks have been run by the service.';
    if (this.evidenceRoute === 'absent') return { report: null, unavailable };
    try {
      const path = `/rules/${encodeURIComponent(ruleId)}/evidence`;
      const { data } = await this.request<EvidenceReport>({ method: 'GET', path, schema: 'EvidenceReport', signal });
      this.evidenceRoute = 'present';
      return { report: data, origin: { kind: 'live', label: 'Live API', detail: `GET ${this.base}${path}` } };
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'not_implemented') {
        this.evidenceRoute = 'absent';
        return { report: null, unavailable };
      }
      throw error;
    }
  }

  /**
   * GET /facts is a map of field → FactDefinition. Fetched once and shared, so the request is
   * not tied to one caller's cancellation: a caller that goes away must not leave every later
   * caller with an aborted result. An older backend without the route yields null.
   */
  facts(): Promise<Record<string, FactDefinition> | null> {
    this.factDefinitions ??= (async () => {
      try {
        const response = await this.fetchImpl(`${this.base}/facts`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const body = (await response.json()) as unknown;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
        const definitions: Record<string, FactDefinition> = {};
        for (const [field, definition] of Object.entries(body)) {
          if (validate('FactDefinition', definition).errors.length === 0) definitions[field] = definition as FactDefinition;
        }
        return definitions;
      } catch {
        this.factDefinitions = null;
        return null;
      }
    })();
    return this.factDefinitions;
  }

  /**
   * POST /changes/summary returns Core's result unchanged plus display labels and groups. A
   * backend without that route is asked through POST /changes instead, and the outcome says so.
   * Only a missing route falls back: a summary that fails, times out or does not match the
   * contract is an error, never silently replaced by the other route.
   */
  async changes(request: ChangeRequest, signal?: AbortSignal): Promise<ChangeOutcome> {
    const wait = { timeoutMs: CHANGES_TIMEOUT_MS, timeoutDetails: CHANGES_TIMEOUT_DETAILS };
    const answersRequest = (result: ChangeResult, endpoint: string) => {
      const problems = changeEchoProblems(request, result);
      if (problems.length) throw new ApiError({ kind: 'contract', endpoint, message: 'The service answered a different comparison than the one that was asked, so it is not shown.', details: problems });
    };
    if (this.summaryRoute !== 'absent') {
      try {
        const { data, warnings } = await this.request<ChangeSummary>({ method: 'POST', path: '/changes/summary', schema: 'ChangeSummary', body: request, signal, ...wait });
        this.summaryRoute = 'present';
        const { result, ...summary } = data;
        answersRequest(result, 'POST /changes/summary');
        return { request, result, summary, origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/changes/summary` }, notices: [], contractWarnings: warnings };
      } catch (error) {
        if (!(error instanceof ApiError) || error.kind !== 'not_implemented') throw error;
        this.summaryRoute = 'absent';
      }
    }
    const { data, warnings } = await this.request<ChangeResult>({ method: 'POST', path: '/changes', schema: 'ChangeResult', body: request, signal, ...wait });
    answersRequest(data, 'POST /changes');
    return {
      request,
      result: data,
      summary: null,
      origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/changes` },
      notices: ['POST /changes/summary is not available on this backend. The comparison comes from POST /changes, and names are read record by record.'],
      contractWarnings: warnings,
    };
  }

  async sourceComparisons(signal?: AbortSignal): Promise<SourceComparisonsOutcome> {
    const { data, warnings } = await this.request<SourceComparisonsResponse>({ method: 'GET', path: '/source-comparisons', schema: 'SourceComparisonsResponse', signal });
    return { response: data, origin: { kind: 'live', label: 'Live API', detail: `GET ${this.base}/source-comparisons` }, contractWarnings: warnings };
  }

  /**
   * The service-built evidence package for a saved property, the displayed date and every
   * request-local answer (explicit unknowns included). The response body is kept byte for byte
   * so the saved file is the one its hashes describe, and a package that describes any other
   * request than the one sent is refused.
   */
  async evidencePackage(query: LookupQuery, signal?: AbortSignal): Promise<EvidencePackageDownload> {
    const body = packageRequestBody(query);
    const { data, warnings, text, byteLength, headers } = await this.request<EvidencePackage>({
      method: 'POST',
      path: '/lookup/evidence-package',
      schema: 'EvidencePackage',
      body,
      signal,
      timeoutMs: PACKAGE_TIMEOUT_MS,
      timeoutDetails: PACKAGE_TIMEOUT_DETAILS,
      exact: true,
    });
    const problems = packageEchoProblems(body, data);
    if (problems.length) {
      throw new ApiError({
        kind: 'contract',
        endpoint: PACKAGE_ENDPOINT,
        message: 'The service returned a package for a different property, date or set of answers than the one on screen, so it was not saved.',
        details: problems,
      });
    }
    return {
      package: data,
      text,
      byteLength: byteLength ?? new TextEncoder().encode(text).byteLength,
      filename: safeAttachmentName(headers?.get('content-disposition') ?? null),
      request: body,
      origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/lookup/evidence-package` },
      contractWarnings: warnings,
    };
  }
}
