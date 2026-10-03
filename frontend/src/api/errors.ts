/** One error type for every way a request can fail, so each gets a deliberate UI state. */
export type ApiErrorKind =
  | 'transport' // no HTTP response: backend down, DNS, CORS, offline
  | 'timeout'
  | 'invalid_request' // 422
  | 'not_found' // 404 with unknown_id: a stale selection
  | 'not_implemented' // route absent on this backend (planned endpoint)
  | 'unavailable' // 503: dataset absent or no completed extraction
  | 'dependency' // 502: malformed upstream/Core output
  | 'server' // any other 5xx/4xx
  | 'contract' // 2xx body that does not match the checked-in schema
  | 'not_recorded'; // demo replay holds nothing for this request

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  endpoint: string;
  status?: number;
  code?: string;
  /** Field-level or schema-level details, already human readable. */
  details?: string[];
  /** Suggestions the UI can offer (e.g. recorded alternatives in demo mode). */
  suggestions?: string[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly endpoint: string;
  readonly status?: number;
  readonly code?: string;
  readonly details: string[];
  readonly suggestions: string[];

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.endpoint = init.endpoint;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.suggestions = init.suggestions ?? [];
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
export const isAbort = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';

export function toApiError(error: unknown, endpoint: string): ApiError {
  if (isApiError(error)) return error;
  return new ApiError({
    kind: 'transport',
    endpoint,
    message: error instanceof Error ? error.message : 'The request failed before a response arrived.',
  });
}

interface FastApiValidationItem {
  loc?: Array<string | number>;
  msg?: string;
}

/**
 * Translate a non-2xx response into an ApiError. Body shapes follow docs/CONTRACTS.md:
 * `{detail: {code, message}}`, FastAPI's `{detail: [{loc, msg}]}`, or `{detail: "Not Found"}`.
 */
export function errorFromResponse(status: number, body: unknown, endpoint: string, rawText: string): ApiError {
  const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
  let code: string | undefined;
  let message: string | undefined;
  let details: string[] = [];

  if (Array.isArray(detail)) {
    details = (detail as FastApiValidationItem[]).map((item) => {
      const where = (item.loc ?? []).filter((part) => part !== 'body').join('.');
      const text = (item.msg ?? 'Invalid value').replace(/^Value error, /, '');
      return where ? `${where}: ${text}` : text;
    });
    message = details[0];
  } else if (detail && typeof detail === 'object') {
    const typed = detail as { code?: unknown; message?: unknown };
    if (typeof typed.code === 'string') code = typed.code;
    if (typeof typed.message === 'string') message = typed.message;
  } else if (typeof detail === 'string') {
    message = detail;
  }

  const base = { endpoint, status, code, details };
  if (status === 422) return new ApiError({ ...base, kind: 'invalid_request', message: message ?? 'The request was rejected as invalid.' });
  if (status === 404 || status === 405) {
    // FastAPI answers an unknown route with the bare string "Not Found"; a known route with an
    // unknown ID answers {code: "unknown_id"}. Only the latter is a stale selection.
    const routeMissing = status === 405 || !code;
    return new ApiError({
      ...base,
      kind: routeMissing ? 'not_implemented' : 'not_found',
      message: routeMissing ? 'This endpoint is not available on the connected backend.' : (message ?? 'That ID is not in the dataset.'),
    });
  }
  if (status === 503) return new ApiError({ ...base, kind: 'unavailable', message: message ?? 'The dataset or its extracted rules are not available.' });
  if (status === 502) return new ApiError({ ...base, kind: 'dependency', message: message ?? 'An upstream service returned output the API could not use.' });
  if (status >= 500 && !rawText.trim()) {
    // Vite's dev proxy answers with an empty 500 when its target is not listening.
    return new ApiError({ ...base, kind: 'transport', message: 'The API did not answer. The backend is probably not running at the configured address.' });
  }
  return new ApiError({ ...base, kind: 'server', message: message ?? `The API returned HTTP ${status}.` });
}
