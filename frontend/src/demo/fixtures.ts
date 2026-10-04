/**
 * The only place demo data enters the app.
 *
 * - contracts/examples and contracts/research_examples are imported straight from the
 *   Platform-owned directory, so the demo cannot drift from the checked-in contract.
 * - recorded/synthetic-replay.json is verbatim backend output for the fictional Maple Harbor
 *   store, produced by frontend/scripts/record_demo.py.
 * - recorded/portfolio-dev-fixture.json is a UX DEVELOPMENT FIXTURE: backend output for a
 *   fictional portfolio whose sources and properties were authored by the UX lane
 *   (frontend/scripts/dev_portfolio.py) so the changes view has several jurisdictions,
 *   categories and dates to lay out. Its results are computed by the backend, including the
 *   re-check and classification of the fixture's authored claim annotations
 *   (`source_comparisons`, the GET /source-comparisons response for that store).
 *
 * Everything here is synthetic and is labeled as such wherever it is shown.
 */
import missingSupport from '../../../contracts/evidence_examples/missing_support.json';
import sourceComparison from '../../../contracts/evidence_examples/source_comparison.json';
import assistExample from '../../../contracts/examples/assist.json';
import emptyExample from '../../../contracts/examples/empty.json';
import errorsExample from '../../../contracts/examples/errors.json';
import normalExample from '../../../contracts/examples/normal.json';
import unknownExample from '../../../contracts/examples/unknown.json';
import boundedPartial from '../../../contracts/research_examples/bounded_partial_analysis.json';
import decisiveQuestion from '../../../contracts/research_examples/decisive_question.json';
import irrelevantMissingFact from '../../../contracts/research_examples/irrelevant_missing_fact.json';
import twoUnresolvedExemptions from '../../../contracts/research_examples/two_unresolved_exemptions.json';
import unresolvedSourceCoverage from '../../../contracts/research_examples/unresolved_source_coverage.json';
import type { AddressItem, AssistResponse, ChangeRequest, ChangeResult, ChangeSummaryExtras, EncodedRuleRendering, EvidenceReport, LookupResponse, Rule, RuleDetail, SourceComparisonsResponse, SourceDocument } from '../api/types';
import { type Pooled, expandPooled } from './pool';
import devRecorded from './recorded/portfolio-dev-fixture.json';
import recorded from './recorded/synthetic-replay.json';

export interface LookupExample {
  path: string;
  fixture_mode: string;
  request: { address_id: string; as_of: string };
  response: LookupResponse;
}

export interface ResearchFixture {
  path: string;
  fixture_mode: string;
  contract_status: string;
  case: string;
  request: { address_id: string; as_of: string };
  response: AssistResponse;
}

export interface RecordedAssist {
  request: { address_id: string; as_of: string };
  response: AssistResponse;
}

export type RecordedStore = 'synthetic' | 'no_extracted_rules' | 'dev_portfolio';

export interface RecordedChange {
  store: RecordedStore;
  request: ChangeRequest;
  /** What POST /changes returns. */
  response: ChangeResult;
  /** What POST /changes/summary adds to it. */
  summary: ChangeSummaryExtras;
}

const example = (name: string, data: unknown): LookupExample => ({ ...(data as Omit<LookupExample, 'path'>), path: `contracts/examples/${name}.json` });
const research = (data: unknown): ResearchFixture => {
  const fixture = data as Omit<ResearchFixture, 'path'>;
  return { ...fixture, path: `contracts/research_examples/${fixture.case}.json` };
};
const named = (name: string, path: string, data: unknown): ResearchFixture => ({ ...(data as Omit<ResearchFixture, 'path' | 'case'>), case: name, path });

/** Ordinary lookup examples: normal, empty and unknown. */
export const LOOKUP_EXAMPLES: LookupExample[] = [example('normal', normalExample), example('empty', emptyExample), example('unknown', unknownExample)];

/** Error bodies captured by the backend's contract generator. */
export const ERROR_EXAMPLES = errorsExample as unknown as {
  unknown_address: { detail: { code: string; message: string } };
  invalid_input: { detail: Array<{ loc: Array<string | number>; msg: string }> };
};

/** The five research fixtures, in the order ASSIST_CONTRACT.md lists them. */
export const RESEARCH_FIXTURES: ResearchFixture[] = [
  research(decisiveQuestion),
  research(irrelevantMissingFact),
  research(twoUnresolvedExemptions),
  research(unresolvedSourceCoverage),
  research(boundedPartial),
];

/**
 * The implemented API's own response for the first synthetic request (Platform + Core),
 * checked in by Platform. The demo's default question flow starts here.
 */
export const ASSIST_EXAMPLE: ResearchFixture = named('assist', 'contracts/examples/assist.json', assistExample);

/** An actual synthetic evidence failure: the source text is missing, so the result stays unknown. */
export const EVIDENCE_FIXTURES: ResearchFixture[] = [named('missing_support', 'contracts/evidence_examples/missing_support.json', missingSupport)];

/** Rule, evidence report and an authored renderer expectation. Used by tests; it carries no lookup. */
export const SOURCE_COMPARISON = sourceComparison as unknown as { fixture_mode: string; contract_status: string; rule: Rule; evidence: EvidenceReport; encoded_rule: EncodedRuleRendering };

/** What each fixture is designed to exercise. UI copy describing the fixture, not a legal statement. */
export const FIXTURE_COPY: Record<string, { title: string; purpose: string }> = {
  decisive_question: { title: 'Decisive question', purpose: 'One missing fact decides coverage. Each recorded answer settles the result.' },
  irrelevant_missing_fact: { title: 'Irrelevant missing fact', purpose: 'No fact that is still missing can change the outcome, so nothing is asked.' },
  two_unresolved_exemptions: { title: 'Two unresolved exemptions', purpose: 'One answer narrows the result but it stays unknown until two exemption facts are known.' },
  unresolved_source_coverage: { title: 'Unresolved source coverage', purpose: 'The open gap is a missing source, not a property fact. No question can close it.' },
  bounded_partial_analysis: { title: 'Bounded partial analysis', purpose: 'The evaluation budget ran out, so the question analysis is explicitly partial.' },
  missing_support: { title: 'Missing source support', purpose: 'The source text is unavailable, so evidence checks fail and the result stays unknown.' },
};

const replay = recorded as unknown as {
  manifest: Record<string, unknown>;
  assists: RecordedAssist[];
  rules: Record<string, RuleDetail>;
  sources: Record<string, SourceDocument>;
  changes: RecordedChange[];
};

export const RECORDED_PATH = 'frontend/src/demo/recorded/synthetic-replay.json';
export const RECORDED_MANIFEST = replay.manifest;
export const RECORDED_ASSISTS = replay.assists;
export const RECORDED_RULES = replay.rules;
export const RECORDED_SOURCES = replay.sources;
export const RECORDED_CHANGES = replay.changes;

const dev = devRecorded as unknown as Pooled & { manifest: Record<string, unknown> };
const devData = expandPooled<{
  addresses: AddressItem[];
  assists: RecordedAssist[];
  rules: Record<string, RuleDetail>;
  sources: Record<string, SourceDocument>;
  evidence_reports: Record<string, EvidenceReport>;
  changes: RecordedChange[];
  source_comparisons: SourceComparisonsResponse;
}>(dev);

/** UX development fixture (fictional portfolio). Labeled wherever it is shown. */
export const DEV_PATH = 'frontend/src/demo/recorded/portfolio-dev-fixture.json';
export const DEV_MANIFEST = dev.manifest;
export const DEV_ADDRESSES = devData.addresses;
export const DEV_ASSISTS = devData.assists;
export const DEV_RULES = devData.rules;
export const DEV_SOURCES = devData.sources;
export const DEV_EVIDENCE_REPORTS = devData.evidence_reports;
export const DEV_CHANGES = devData.changes;
/** The backend's GET /source-comparisons response for the development fixture's authored annotations. */
export const DEV_SOURCE_COMPARISONS = devData.source_comparisons;

/**
 * Which recordings the one-click walkthrough examples open. These choose a recording; what
 * each example says about itself is computed from that recording (src/api/demo.ts).
 */
export const WALKTHROUGH = {
  lookup: { address_id: 'DEV-P04', as_of: '2026-12-15' },
  changes: { before: '2026-10-01', after: '2027-01-15', scenario: 'actual' as const },
};
