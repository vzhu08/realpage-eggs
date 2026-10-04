/**
 * POST /lookup/evidence-package: what is sent, and how the returned package is checked against
 * it before anything is saved. Pure functions, shared by the live adapter and the card that
 * shows the request (src/features/lookup/KeepResult.tsx).
 *
 * The service echoes its validated request in `EvidencePackage.request` (navigator/models.py,
 * EvidencePackageRequest). Answer values are typed `Any` there, so they come back exactly as
 * sent: an integer stays an integer, a partial date such as "2020-05" stays that string, and
 * an explicit unknown stays `null`. `note` is echoed as `null` when none was sent, `as_of` as
 * the same ISO day, and `supplemental_facts`, `scenario_id` and `address` as empty/null because
 * this client never sends them. Limits are the service's own defaults and are not compared.
 */
import type { ApiError } from './errors';
import type { Answer, EvidencePackage, LookupQuery } from './types';

export const PACKAGE_ENDPOINT = 'POST /lookup/evidence-package';
export const DEFAULT_PACKAGE_NAME = 'evidence-package.json';

export interface WireAnswer {
  field: string;
  value: Answer['value'];
  provenance: NonNullable<Answer['provenance']>;
  note?: string;
}

/** One answer as it is sent. `value: null` is an explicit unknown and is sent, not dropped. */
export function wireAnswer(answer: Answer): WireAnswer {
  const wire: WireAnswer = { field: answer.field, value: answer.value, provenance: answer.provenance ?? 'user_provided' };
  if (answer.note) wire.note = answer.note;
  return wire;
}

export interface PackageRequestBody {
  address_id: string;
  as_of: string;
  answers: WireAnswer[];
}

/**
 * The request body for the result on screen: its saved property, its date and every
 * request-local answer, in the order they were given. Nothing else is sent.
 */
export function packageRequestBody(query: Pick<LookupQuery, 'address_id' | 'as_of' | 'answers'>): PackageRequestBody {
  return { address_id: query.address_id, as_of: query.as_of, answers: query.answers.map(wireAnswer) };
}

/** Field, value, provenance and note of one answer, with defaults filled the way the service fills them. */
const answerKey = (answer: { field: string; value?: unknown; provenance?: string; note?: string | null }) =>
  JSON.stringify([answer.field, answer.value ?? null, answer.provenance ?? 'user_provided', answer.note || null]);

const sameAnswers = (sent: WireAnswer[], echoed: Array<{ field: string; value?: unknown; provenance?: string; note?: string | null }>) =>
  JSON.stringify(sent.map(answerKey).sort()) === JSON.stringify(echoed.map(answerKey).sort());

/**
 * Every way a returned package describes another request than the one that was sent. An empty
 * list means the package is for exactly this property, date and set of answers. A package with
 * any entry here is never saved: a file for a different answer or date state would be
 * indistinguishable, once on disk, from the one that was asked for.
 */
export function packageEchoProblems(sent: PackageRequestBody, pack: EvidencePackage): string[] {
  const problems: string[] = [];
  const echoed = pack.request;
  if (echoed.address_id !== sent.address_id) problems.push(`request.address_id is ${JSON.stringify(echoed.address_id)}; ${JSON.stringify(sent.address_id)} was sent.`);
  if (echoed.as_of !== sent.as_of) problems.push(`request.as_of is ${JSON.stringify(echoed.as_of ?? null)}; ${JSON.stringify(sent.as_of)} was sent.`);
  if (echoed.address !== undefined && echoed.address !== null) problems.push('request.address is set; a saved property ID was sent, not a typed address.');
  if (!sameAnswers(sent.answers, echoed.answers ?? [])) problems.push(`request.answers does not match the ${sent.answers.length} ${sent.answers.length === 1 ? 'answer' : 'answers'} that were sent (field, value, provenance and note are compared).`);
  const extra = Object.keys(echoed.supplemental_facts ?? {});
  if (extra.length) problems.push(`request.supplemental_facts carries ${extra.join(', ')}; none were sent.`);
  if (echoed.scenario_id !== undefined && echoed.scenario_id !== null) problems.push('request.scenario_id is set; none was sent.');

  // The package must also be internally about that request: its property record and its response.
  if (pack.inputs.original_property.address_id !== sent.address_id) problems.push(`inputs.original_property is ${JSON.stringify(pack.inputs.original_property.address_id)}, not the property that was sent.`);
  if (pack.response.lookup.address.address_id !== sent.address_id) problems.push(`response.lookup.address is ${JSON.stringify(pack.response.lookup.address.address_id)}, not the property that was sent.`);
  if (pack.response.lookup.as_of !== sent.as_of) problems.push(`response.lookup.as_of is ${JSON.stringify(pack.response.lookup.as_of)}; ${JSON.stringify(sent.as_of)} was sent.`);
  if (!sameAnswers(sent.answers, pack.response.answers_applied)) problems.push('response.answers_applied does not match the answers that were sent.');
  return problems;
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.json$/;

/**
 * The file name from a Content-Disposition header, accepted only when the whole `filename`
 * value is a plain JSON file name: letters, digits, dot, dash and underscore, no path, no
 * second extension, no encoded form. Anything else falls back to evidence-package.json.
 */
export function safeAttachmentName(header: string | null | undefined): string {
  if (!header) return DEFAULT_PACKAGE_NAME;
  for (const part of header.split(';').slice(1)) {
    const match = /^\s*filename\s*=\s*(?:"([^"]*)"|([^\s"]*))\s*$/i.exec(part);
    if (!match) continue;
    const name = match[1] ?? match[2] ?? '';
    return SAFE_NAME.test(name) && !name.includes('..') ? name : DEFAULT_PACKAGE_NAME;
  }
  return DEFAULT_PACKAGE_NAME;
}

/** What a failed package request means, and whether asking again can help. Nothing is ever saved on a failure. */
export function packageFailure(error: ApiError): { text: string; retry: boolean } {
  switch (error.kind) {
    case 'not_found':
      return { text: 'The service no longer has this property, so it built no package. Choose the property again from the list.', retry: false };
    case 'invalid_request':
      return { text: 'The service rejected this request, so it built no package. Asking again with the same property, date and answers would be rejected again.', retry: false };
    case 'not_implemented':
      return { text: 'The connected backend has no evidence-package route. The working export beside this card is still available; it is a different file and not a substitute.', retry: false };
    case 'dependency':
      return {
        text: error.status === 502 ? 'A part of the service returned output the API could not accept, so no package was built. A partial package is never produced.' : 'A part of the service the package depends on failed, so no package was built. A partial package is never produced.',
        retry: true,
      };
    case 'unavailable':
      return { text: 'The dataset is not ready, or it changed while the package was being assembled. No package was built; ask again once the dataset is stable.', retry: true };
    case 'timeout':
      return { text: 'Nothing was received in time, so nothing was saved.', retry: true };
    case 'transport':
      return { text: 'The service could not be reached, so nothing was saved.', retry: true };
    case 'contract':
      return { text: 'The response was not saved. A file that does not match the contract, or that describes another request than the one on screen, could later be mistaken for the package that was asked for.', retry: true };
    default:
      return { text: 'No package was saved.', retry: true };
  }
}
