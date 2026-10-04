/**
 * Live API adapter. Uses the implemented routes from contracts/openapi.json and probes the
 * planned assist/evidence routes from docs/ASSIST_CONTRACT.md. When a planned route is absent
 * it says so and continues with the implemented route — it never substitutes synthetic data.
 */
import { ApiError, errorFromResponse, isAbort } from './errors';
import type {
  AddressPage,
  Answer,
  AnswerDisposition,
  AssistResponse,
  ChangeOutcome,
  ChangeRequest,
  ChangeResult,
  DataSource,
  EvidenceReport,
  EvidenceReportOutcome,
  FactDefinition,
  HealthResponse,
  LookupOutcome,
  LookupQuery,
  LookupResponse,
  RuleDetail,
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
}

const TIMEOUT_MS = 20_000;

export class LiveSource implements DataSource {
  readonly mode = 'live' as const;
  readonly describe: string;
  private readonly base: string;
  private readonly fetchImpl: FetchLike;
  /** Remembered per session so a missing planned route is probed once, not on every request. */
  private assistRoute: 'untested' | 'present' | 'absent' = 'untested';
  private evidenceRoute: 'untested' | 'present' | 'absent' = 'untested';
  private factDefinitions: Promise<Record<string, FactDefinition> | null> | null = null;

  constructor(baseUrl: string, fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.describe = `Live API at ${this.base}`;
  }

  private async request<T>(options: RequestOptions): Promise<{ data: T; warnings: string[] }> {
    const endpoint = `${options.method} ${options.path}`;
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
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
        if (timedOut) throw new ApiError({ kind: 'timeout', endpoint, message: `No response within ${TIMEOUT_MS / 1000} seconds.` });
        if (isAbort(error)) throw error;
        throw new ApiError({ kind: 'transport', endpoint, message: 'Could not reach the API. Check that the backend is running and reachable from this page.' });
      }
      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : undefined;
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
      return { data: body as T, warnings: result.warnings };
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

  /** GET /facts is a map of field → FactDefinition. Fetched once; an older backend without it yields null. */
  facts(signal?: AbortSignal): Promise<Record<string, FactDefinition> | null> {
    this.factDefinitions ??= (async () => {
      try {
        const response = await this.fetchImpl(`${this.base}/facts`, { headers: { Accept: 'application/json' }, signal });
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

  async changes(request: ChangeRequest, signal?: AbortSignal): Promise<ChangeOutcome> {
    const { data, warnings } = await this.request<ChangeResult>({ method: 'POST', path: '/changes', schema: 'ChangeResult', body: request, signal });
    return { request, result: data, origin: { kind: 'live', label: 'Live API', detail: `POST ${this.base}/changes` }, contractWarnings: warnings };
  }
}

function wireAnswer(answer: Answer) {
  return answer.note ? { field: answer.field, value: answer.value, provenance: answer.provenance, note: answer.note } : { field: answer.field, value: answer.value, provenance: answer.provenance };
}
