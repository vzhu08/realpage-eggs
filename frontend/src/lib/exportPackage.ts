/**
 * A working export of one lookup result, assembled in the browser from the payloads already
 * on screen. It is NOT the reproducible evidence package planned in PLAT-06: it carries no
 * snapshot or code hashes beyond what the response itself reports, and nothing in it has been
 * re-verified. Its purpose is to let a reader keep exactly what they saw, with each kind of
 * statement kept apart: stored facts, request-local answers, evaluator results, model review
 * and human review.
 */
import { CONTRACT_DIGEST } from '../api/generated/meta';
import type { Answer, AnswerDisposition, DataMode, LookupOutcome } from '../api/types';
import type { AnswerEvent } from '../state/session';
import { isSynthetic, readMetadata } from './metadata';

export const WORKING_EXPORT_KIND = 'ux_working_export';
export const WORKING_EXPORT_VERSION = 1;

export interface WorkingExportInput {
  outcome: LookupOutcome;
  answers: Answer[];
  history: AnswerEvent[];
  mode: DataMode;
  /** API base the live source talks to; omitted in the synthetic demo. */
  apiBase?: string;
  /** Clock of the exporting browser. It is a record of when the file was made, never a query date. */
  exportedAt: string;
}

export function buildWorkingExport({ outcome, answers, history, mode, apiBase, exportedAt }: WorkingExportInput) {
  const { lookup, assist } = outcome;
  const metadata = readMetadata(lookup);
  const answered = new Set(answers.map((answer) => answer.field));
  const dispositions = new Map<string, AnswerDisposition>(outcome.dispositions.map((item) => [item.field, item]));
  const storedFacts = Object.fromEntries(Object.entries(lookup.address.facts ?? {}).filter(([field]) => !answered.has(field)));
  const reports = assist?.evidence_reports ?? [];

  return {
    export_kind: WORKING_EXPORT_KIND,
    export_version: WORKING_EXPORT_VERSION,
    notice:
      'Working export assembled in the browser from the responses shown on screen. It is not the reproducible evidence package (PLAT-06), carries no independent verification, and is not legal advice. Applicability is not a finding of compliance or violation.',
    limitations: [
      'No snapshot or code hash is included beyond what the response metadata reports.',
      'Request-local answers were supplied by the person using the workspace and are unverified; they are not stored facts.',
      'Source documents are listed with their recorded hashes; their full text is not embedded.',
      'Nothing in this file was re-evaluated or re-verified when it was exported.',
    ],
    exported_at: exportedAt,
    exported_at_note: 'Clock of the exporting browser. Not a query date.',
    data_origin: {
      mode,
      label: outcome.origin.label,
      detail: outcome.origin.detail,
      api_base: mode === 'live' ? (apiBase ?? null) : null,
      synthetic: isSynthetic(metadata) || outcome.origin.kind !== 'live',
      dataset_mode: metadata.datasetMode ?? null,
      dataset_label: metadata.datasetLabel ?? null,
      backend_version: metadata.version ?? null,
      rule_evidence_modes: metadata.ruleModes,
      extraction_run_ids: metadata.runIds,
      partial_data: metadata.partialData,
      missing_source_ids: metadata.missingSourceIds,
      unprocessed_source_ids: metadata.unprocessedSourceIds,
      frontend_contract_digest: CONTRACT_DIGEST,
      fixture: outcome.fixture ?? null,
    },
    query: { address_id: outcome.query.address_id, as_of: lookup.as_of },
    stored_facts: {
      note: 'Facts on the stored property record, with the provenance the service reports for each.',
      address: lookup.address.raw_address,
      normalized_address: lookup.address.normalized_address,
      facts: storedFacts,
      bounds: lookup.address.bounds ?? {},
      missing_facts: lookup.address.missing_facts ?? [],
      provenance: Object.fromEntries(Object.entries(lookup.address.provenance ?? {}).filter(([field]) => !answered.has(field))),
    },
    request_answers: {
      note: 'Supplied for this request only. Unverified, never stored, and resent in full with every request. A null value is an explicit "unknown".',
      answers: answers.map((answer) => ({ field: answer.field, value: answer.value, provenance: answer.provenance, disposition: dispositions.get(answer.field)?.status ?? null, disposition_note: dispositions.get(answer.field)?.note ?? null })),
      history: history.map((event) => ({ seq: event.seq, field: event.field, action: event.action, value: event.value, previous: event.previous ?? null, provenance: event.provenance })),
      replayed_alternative: outcome.replayed ? { question_id: outcome.replayed.questionId, alternative_id: outcome.replayed.alternativeId, label: outcome.replayed.label } : null,
    },
    jurisdiction: lookup.jurisdiction,
    evaluator_results: {
      note: 'Output of the service evaluator for this property and date. Applicability only.',
      evaluations: lookup.evaluations,
    },
    rules: lookup.rules,
    sources: lookup.sources.map((source) => ({
      doc_id: source.doc_id,
      url: source.url,
      retrieved_at: source.retrieved_at,
      sha256: source.sha256,
      manifest_sha256: source.manifest_sha256 ?? null,
      capture_status: source.capture_status,
      authority: source.authority,
      source_type: source.source_type ?? null,
      jurisdictions: source.jurisdictions,
      issues: source.issues ?? [],
    })),
    evidence_checks: {
      note: 'Separate checks per rule. They are not combined into a score.',
      reports,
    },
    review_status: {
      model_review: {
        note: 'What the service records about model review of each encoded rule. A model review is not an independent human review.',
        rules: lookup.rules.map((rule) => ({
          team_rule_id: rule.team_rule_id,
          semantic_verification: rule.semantic_verification,
          review_issues: rule.review_issues ?? [],
          semantic_support_checks: reports.find((report) => report.rule_id === rule.team_rule_id)?.checks.filter((check) => check.kind === 'semantic_support').map((check) => ({ status: check.status, message: check.message })) ?? [],
        })),
      },
      independent_human_review: { recorded: false, note: 'The API contract has no field for independent human review, so none is recorded here.' },
    },
    question_plan: assist
      ? { status: assist.question_plan.status, exhaustive: assist.question_plan.exhaustive ?? false, limits_hit: assist.question_plan.limits_hit ?? [], algorithm_version: assist.question_plan.algorithm_version, open_questions: assist.question_plan.questions.map((question) => ({ field: question.fact.field, prompt: question.prompt, why: question.why })) }
      : null,
    encoded_rules: assist?.encoded_rules ?? [],
    remaining_uncertainty: assist?.question_plan.remaining_uncertainty ?? [],
    capabilities: assist?.capabilities ?? null,
    warnings: lookup.warnings,
    adapter_notices: outcome.notices,
    disclaimer: lookup.disclaimer,
  };
}

export type WorkingExport = ReturnType<typeof buildWorkingExport>;

export const workingExportFilename = (addressId: string, asOf: string) => `navigator-working-export_${addressId.replace(/[^A-Za-z0-9_-]+/g, '-')}_${asOf}.json`;

/** Hands the file to the browser. Returns false where downloads are not possible. */
export function downloadJson(filename: string, data: unknown): boolean {
  try {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
