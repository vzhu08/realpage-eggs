import type { EvidenceCheck, EvidenceReport, Rule, SourceSpan } from '../../api/types';
import { Disclosure, Facts, Notice, Tag } from '../../components/ui';
import { type Tone, humanize, sentence } from '../../lib/labels';
import { checkQuote } from '../../lib/text';
import type { LoadedSource } from './SourceTab';

interface Props {
  rule: Rule;
  report: EvidenceReport | null;
  /** Why no report exists, in the adapter's words. */
  reportState: string | null;
  reportLoading: boolean;
  loaded: Record<string, LoadedSource>;
}

type Kind = EvidenceCheck['kind'];

const CHECKS: Array<{ kind: Kind; title: string; asks: string }> = [
  { kind: 'source_availability', title: 'Source availability', asks: 'Is the source text captured and retrievable?' },
  { kind: 'source_identity', title: 'Source identity and version', asks: 'Is this the document and version it is recorded as?' },
  { kind: 'source_eligibility', title: 'Primary-source eligibility', asks: 'Is this primary legal text, or contextual material that still needs authority review?' },
  { kind: 'citation_anchor', title: 'Citation anchor', asks: 'Does the cited section or offset exist in that source?' },
  { kind: 'quote_presence', title: 'Exact quote', asks: 'Do the quoted characters occur in the source snapshot?' },
  { kind: 'semantic_support', title: 'Semantic support', asks: 'Does the cited text support the encoded condition, threshold, exception and dates?' },
  { kind: 'dependencies', title: 'Dependencies', asks: 'Are the definitions, exceptions and cross-references the rule relies on resolved?' },
];

const STATUS: Record<EvidenceCheck['status'], { label: string; tone: Tone }> = {
  pass: { label: 'Pass', tone: 'applies' },
  supported: { label: 'Supported', tone: 'applies' },
  fail: { label: 'Fail', tone: 'danger' },
  contradicted: { label: 'Contradicted', tone: 'danger' },
  missing: { label: 'Missing', tone: 'danger' },
  ambiguous: { label: 'Ambiguous', tone: 'unknown' },
  insufficient: { label: 'Insufficient', tone: 'unknown' },
  stale: { label: 'Stale', tone: 'unknown' },
  not_checked: { label: 'Not checked', tone: 'muted' },
};

/**
 * Separate checks, never rolled into one score. Each row shows the service's verdict when
 * an evidence report exists; otherwise it says the check has not been run and lists only what
 * the lookup data itself shows.
 */
export function ChecksTab({ rule, report, reportState, reportLoading, loaded }: Props) {
  const observations = observe(rule, loaded);
  return (
    <div className="evidence-tab">
      <p className="evidence-tab__lead">
        These checks answer different questions and are reported separately. A quote that matches the source shows the words occur there; it does not show they support the rule.
      </p>
      {!report && !reportLoading && (
        <Notice tone="neutral" title="No evidence report from the service" compact>
          <p>{reportState ?? 'No evidence checks have been run for this rule.'} Nothing below is a verification result.</p>
        </Notice>
      )}
      {report && report.blocking_issues.length > 0 && (
        <Notice tone="danger" title="Blocking issues reported" compact>
          <ul className="plain-list plain-list--tight">
            {report.blocking_issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Notice>
      )}
      <ol className="checks">
        {CHECKS.map((definition) => {
          const results = (report?.checks ?? []).filter((check) => check.kind === definition.kind);
          return (
            <li key={definition.kind} className="check" data-check={definition.kind}>
              <div className="check__head">
                <h4 className="check__title">{definition.title}</h4>
                {results.length > 0 ? (
                  <span className="check__tags">
                    {summarize(results).map((entry) => (
                      <Tag key={entry.status} tone={STATUS[entry.status]?.tone ?? 'neutral'}>
                        {STATUS[entry.status]?.label ?? sentence(entry.status)}
                        {entry.count > 1 ? ` × ${entry.count}` : ''}
                      </Tag>
                    ))}
                  </span>
                ) : (
                  <Tag tone="muted">{reportLoading ? 'Checking…' : report ? 'No result in the report' : 'Not checked by the service'}</Tag>
                )}
              </div>
              <p className="check__asks">{definition.asks}</p>
              {results.length > 0 && (
                <ul className="check__results">
                  {results.map((result, index) => (
                    <li key={index} className="check__result" data-status={result.status}>
                      <p>
                        <span className={`check__status check__status--${STATUS[result.status]?.tone ?? 'neutral'}`}>{STATUS[result.status]?.label ?? sentence(result.status)}</span>
                        {result.field && <span className="check__field"> · {result.field.split(',').map((field) => humanize(field.trim())).join(', ')}</span>}
                        <span className="check__message"> — {result.message}</span>
                      </p>
                      {(result.spans ?? []).length > 0 && (
                        <Disclosure summary={`Matched source text (${(result.spans ?? []).length})`}>
                          <Spans spans={result.spans ?? []} />
                        </Disclosure>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {results.length === 0 && (
                <div className="check__observed">
                  <p className="check__observed-label">What the lookup data shows</p>
                  <ul className="plain-list plain-list--tight">
                    {observations[definition.kind].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {report?.semantic_review && (
        <section className="record" aria-label="Semantic review">
          <h4 className="record__title">Semantic review</h4>
          <Facts
            dense
            rows={[
              { label: 'Mode', value: sentence(report.semantic_review.mode) },
              { label: 'Model', value: <span className="mono">{report.semantic_review.model}</span> },
              { label: 'Verifier', value: <span className="mono">{report.semantic_review.verifier_version}</span> },
              { label: 'Human reviewed', value: 'No' },
            ]}
          />
          <ul className="plain-list">
            {report.semantic_review.decisions.map((decision, index) => (
              <li key={index}>
                <Tag tone={decision.status === 'supported' ? 'applies' : decision.status === 'contradicted' ? 'danger' : 'unknown'}>{sentence(decision.status)}</Tag> <strong>{humanize(decision.field)}:</strong> {decision.explanation}
                <Spans spans={decision.spans ?? []} />
              </li>
            ))}
          </ul>
          {report.semantic_review.limitations.length > 0 && (
            <Disclosure summary="Review limitations">
              <ul className="plain-list plain-list--tight">
                {report.semantic_review.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </Disclosure>
          )}
          <p className="hint">A model’s review is not human verification, and its confidence is not an accuracy measurement.</p>
        </section>
      )}

      {report && (
        <section className="record" aria-label="Retrieved context">
          <h4 className="record__title">Retrieved context and references</h4>
          <Facts
            dense
            rows={[
              { label: 'Context', value: sentence(report.context.status) },
              { label: 'Retrieval', value: <span className="mono">{report.context.retrieval_method ?? 'not recorded'}</span>, note: 'Retrieval finds passages; it does not verify meaning.' },
              ...(report.context.limits_hit.length ? [{ label: 'Limits reached', value: report.context.limits_hit.map(humanize).join(', ') }] : []),
            ]}
          />
          {report.context.dependencies.length > 0 && (
            <ul className="plain-list">
              {report.context.dependencies.map((dependency, index) => (
                <li key={index}>
                  <Tag tone={dependency.status === 'resolved' ? 'applies' : dependency.status === 'missing' ? 'danger' : 'unknown'}>{sentence(dependency.status)}</Tag> <strong>{dependency.reference}</strong> — {dependency.explanation}
                </li>
              ))}
            </ul>
          )}
          <Spans spans={report.context.spans} />
        </section>
      )}
    </div>
  );
}

/** Distinct statuses within one kind of check, most severe first, with how many results carry each. */
function summarize(results: EvidenceCheck[]): Array<{ status: EvidenceCheck['status']; count: number }> {
  const order: EvidenceCheck['status'][] = ['fail', 'contradicted', 'missing', 'stale', 'insufficient', 'ambiguous', 'not_checked', 'pass', 'supported'];
  const counts = new Map<EvidenceCheck['status'], number>();
  for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([status, count]) => ({ status, count }));
}

function Spans({ spans }: { spans: SourceSpan[] }) {
  if (!spans.length) return null;
  return (
    <ul className="spans">
      {spans.map((span, index) => (
        <li key={index}>
          <blockquote>{span.text}</blockquote>
          <p className="hint">
            <span className="mono">{span.doc_id}</span>
            {span.section ? ` · ${span.section}` : ''} · characters {span.start}–{span.end}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Plain statements of what the already-loaded data contains. No verdicts. */
function observe(rule: Rule, loaded: Record<string, LoadedSource>): Record<Kind, string[]> {
  const docIds = [...new Set(rule.evidence.map((item) => item.doc_id))];
  const availability: string[] = [];
  const identity: string[] = [];
  for (const docId of docIds) {
    const state = loaded[docId];
    if (!state || state.status === 'loading') {
      availability.push(`${docId}: source text is still loading.`);
      continue;
    }
    if (state.status === 'error') {
      availability.push(`${docId}: the source text could not be retrieved (${state.error.message})`);
      continue;
    }
    const doc = state.doc;
    availability.push(`${docId}: recorded capture status “${humanize(doc.capture_status)}”; ${doc.text ? `${Array.from(doc.text).length.toLocaleString('en-US')} characters of text retrievable` : 'no captured text'}.`);
    identity.push(
      doc.manifest_sha256
        ? `${docId}: snapshot hash ${doc.manifest_sha256 === doc.sha256 ? 'equals' : 'differs from'} the declared manifest hash.`
        : `${docId}: a snapshot hash is recorded; no manifest hash is declared to compare it with.`,
    );
  }
  const withOffsets = rule.evidence.filter((item) => item.start !== null && item.start !== undefined && item.end !== null && item.end !== undefined).length;
  const anchor = [`${withOffsets} of ${rule.evidence.length} quotes carry character offsets into their source.`, 'Whether the cited section itself exists in the source has not been checked.'];

  let matched = 0;
  let mismatched = 0;
  let unchecked = 0;
  for (const item of rule.evidence) {
    const state = loaded[item.doc_id];
    const result = checkQuote(state?.status === 'ready' ? state.doc.text : undefined, item.quote, item.start, item.end);
    if (result.state === 'match') matched += 1;
    else if (result.state === 'mismatch') mismatched += 1;
    else unchecked += 1;
  }
  const quote = [`${matched} of ${rule.evidence.length} quotes equal the source text at their recorded offsets (literal comparison in this browser).`];
  if (mismatched) quote.push(`${mismatched} ${mismatched === 1 ? 'quote does' : 'quotes do'} not equal the text at the recorded offsets.`);
  if (unchecked) quote.push(`${unchecked} could not be compared (no offsets or no source text).`);

  const semanticLabels: Record<string, string> = {
    synthetic_fixture: 'Recorded on the rule as: synthetic fixture. No semantic review was performed.',
    model_reviewed: 'Recorded on the rule as: model-reviewed. A model’s review is not human verification.',
    needs_review: 'Recorded on the rule as: needs review.',
  };
  const semantic = [semanticLabels[rule.semantic_verification] ?? `Recorded on the rule as: ${humanize(rule.semantic_verification)}.`];

  const dependencies = [
    (rule.interactions ?? []).length ? `${(rule.interactions ?? []).length} interaction(s) with other rules are encoded with their own evidence.` : 'No interactions with other rules are encoded.',
    ...(rule.review_issues ?? []).map((issue) => `Open review issue: ${issue}`),
    'Definitions, exception sections and cross-references have not been checked.',
  ];
  if (rule.conflict_flag) dependencies.unshift(`Conflict flagged: ${rule.conflict_note ?? 'sources disagree'}`);

  return {
    source_availability: availability.length ? availability : ['No source document is referenced.'],
    source_identity: identity.length ? identity : ['Source metadata has not been loaded.'],
    source_eligibility: ['Primary-source eligibility has not been checked by the service. A matching quote or official publisher alone does not establish operative authority.'],
    citation_anchor: anchor,
    quote_presence: quote,
    semantic_support: semantic,
    dependencies,
  };
}
