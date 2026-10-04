/**
 * Frontend-facing API types. Wire shapes come from ./generated/contract (derived from
 * contracts/); the types below describe how the adapters wrap them for the UI.
 */
import type {
  AddressItem,
  AssistResponse,
  ChangeRequest,
  ChangeResult,
  ChangeSummary,
  Evaluation,
  EvidencePackage,
  EvidenceReport,
  FactDefinition,
  AddressPage,
  HealthResponse,
  LookupResponse,
  RuleDetail,
  SourceComparisonsResponse,
  SourceDocument,
  SupplementalAnswer,
} from './generated/contract';

export type * from './generated/contract';

export type DataMode = 'live' | 'demo';
export type RuleResult = Evaluation['result'];
export type AnswerValue = string | number | boolean | null;

/** A request-local answer. `value: null` is an explicit "unknown". */
export interface Answer extends SupplementalAnswer {
  value: AnswerValue;
}

/** Where a payload came from. Always shown with the result; never implied. */
export interface Origin {
  kind: 'live' | 'checked_in_example' | 'recorded_replay' | 'fixture_replay';
  /** Short label, e.g. "Live API" or "Contract fixture". */
  label: string;
  /** Endpoint or repository path the payload was read from. */
  detail: string;
}

/** Whether the question planner contributed to this result, and why not if it did not. */
export type PlannerState =
  | { kind: 'response' } // an AssistResponse is present; read its own capabilities/status
  | { kind: 'endpoint_unavailable'; detail: string } // live backend has no POST /lookup/assist
  | { kind: 'no_fixture'; detail: string }; // reserved: a replay source with no plan for this property/date

/** How each accumulated answer was treated by the request that produced this result. */
export interface AnswerDisposition {
  field: string;
  status:
    | 'applied' // echoed in answers_applied by the service
    | 'sent_as_supplemental_fact' // sent through the implemented /lookup supplemental_facts path
    | 'withheld_unknown' // explicit unknown: nothing to send on the /lookup path
    | 'not_evaluated'; // demo replay holds no recorded evaluator output for this value
  note?: string;
}

/** A recorded hypothetical that the demo replayed as the "after answering" state. */
export interface ReplayedAlternative {
  questionId: string;
  alternativeId: string;
  label: string;
  /** Every evaluation the evaluator recorded for the probe, including ones lookup lists omit. */
  evaluations: Evaluation[];
}

export interface LookupQuery {
  address_id: string;
  as_of: string;
  answers: Answer[];
  /** Demo only: which research fixture case to replay. */
  fixtureCase?: string;
}

export interface LookupOutcome {
  query: LookupQuery;
  lookup: LookupResponse;
  /** Present when an AssistResponse (live or fixture) backs this result. */
  assist: AssistResponse | null;
  planner: PlannerState;
  origin: Origin;
  dispositions: AnswerDisposition[];
  replayed?: ReplayedAlternative;
  /** Research fixture metadata, when a contract fixture backs this result. */
  fixture?: { case: string; contractStatus: string };
  /** Adapter-level notices that must be visible (e.g. a visible fallback to /lookup). */
  notices: string[];
  /** Non-fatal contract drift (unexpected extra fields). */
  contractWarnings: string[];
}

export interface FixtureCaseSummary {
  id: string;
  title: string;
  /** What the fixture is designed to exercise (UI copy, not a legal statement). */
  purpose: string;
  address_id: string;
  as_of: string;
  contractStatus: string;
  path: string;
}

/** Which recorded dataset a demo payload came from. The three are separate stores and never mixed. */
export type RecordedStore = 'synthetic' | 'no_extracted_rules' | 'dev_portfolio';

/** What POST /changes/summary adds to Core's result: display labels and overlapping groups. */
export type ChangeSummaryExtras = Omit<ChangeSummary, 'result'>;

export interface ChangeOutcome {
  request: ChangeRequest;
  result: ChangeResult;
  /**
   * Labels and groups from POST /changes/summary. Null when the connected backend has no such
   * route and the result came from POST /changes; names are then read record by record.
   */
  summary: ChangeSummaryExtras | null;
  origin: Origin;
  /** Demo only: which recorded store produced this result. */
  recordedStore?: RecordedStore;
  /** Adapter-level notices that must be visible (e.g. a visible fallback to POST /changes). */
  notices: string[];
  contractWarnings: string[];
}

/** GET /source-comparisons, with where it came from. */
export interface SourceComparisonsOutcome {
  response: SourceComparisonsResponse;
  origin: Origin;
  /** Demo only: the recorded store the annotations belong to. */
  recordedStore?: RecordedStore;
  contractWarnings: string[];
}

/** POST /lookup/evidence-package: the service-built package for one saved property and request. */
export interface EvidencePackageDownload {
  package: EvidencePackage;
  /** The response body exactly as the service sent it; this is what is saved. */
  text: string;
  /** From Content-Disposition when it is a safe name; otherwise evidence-package.json. */
  filename: string;
  origin: Origin;
  contractWarnings: string[];
}

export interface EvidenceReportOutcome {
  report: EvidenceReport | null;
  /** Why no report is available, in words the UI can show. */
  unavailable?: string;
  origin?: Origin;
}

/** A one-click walkthrough example. Its description is derived from the recording it opens. */
export interface DemoExample {
  id: 'consequential_fact' | 'portfolio_impact' | 'source_comparison';
  /** What the example shows, named by what a reader gets from it. */
  title: string;
  /** One sentence computed from the recorded payload the example opens. */
  detail: string;
  /** The property and date, or the two dates, the example uses. */
  meta: string;
  target: { view: 'lookup'; address_id: string; as_of: string } | { view: 'changes'; request: ChangeRequest } | { view: 'disagreements' };
}

export interface DemoCatalog {
  cases: FixtureCaseSummary[];
  /** Recorded as-of dates, per address. */
  lookupDates: Record<string, string[]>;
  changeRequests: Array<{ request: ChangeRequest; store: RecordedStore }>;
  manifest: Record<string, unknown>;
  /** One-click examples for a walkthrough, each backed by a recording. */
  examples: DemoExample[];
  /** The UX development fixture: a fictional portfolio evaluated by the backend. */
  development: {
    path: string;
    manifest: Record<string, unknown>;
    properties: AddressItem[];
    /** Recorded lookups in which the evaluator flagged a conflict. */
    conflictLookups: Array<{ address_id: string; as_of: string }>;
  };
}

/** One interface for both data modes; the UI never branches on transport details. */
export interface DataSource {
  readonly mode: DataMode;
  /** Human description of what this source talks to. */
  readonly describe: string;
  health(signal?: AbortSignal): Promise<HealthResponse | null>;
  addresses(params: { q: string; offset: number; limit: number }, signal?: AbortSignal): Promise<AddressPage>;
  lookup(query: LookupQuery, signal?: AbortSignal): Promise<LookupOutcome>;
  ruleDetail(ruleId: string, signal?: AbortSignal): Promise<RuleDetail>;
  source(docId: string, signal?: AbortSignal): Promise<SourceDocument>;
  evidenceReport(ruleId: string, signal?: AbortSignal): Promise<EvidenceReportOutcome>;
  /** Fact meanings and answer forms, keyed by field; null when the source does not publish them. */
  facts(signal?: AbortSignal): Promise<Record<string, FactDefinition> | null>;
  changes(request: ChangeRequest, signal?: AbortSignal): Promise<ChangeOutcome>;
  /** Claim observations saved with the snapshot, re-checked by the service against its sources. */
  sourceComparisons(signal?: AbortSignal): Promise<SourceComparisonsOutcome>;
  /** Live API only: the reproducible evidence package for a saved property and this exact request. */
  evidencePackage?(query: LookupQuery, signal?: AbortSignal): Promise<EvidencePackageDownload>;
  /** Demo mode only. */
  catalog?(): DemoCatalog;
}
