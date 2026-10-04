import type { ComparisonSupport } from '../../api/types';
import { Disclosure, Facts, Tag } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { humanize, sentence } from '../../lib/labels';
import { type ComparisonSide, type ComparisonView, STATUS_LABEL, supportIssue, supportProblem } from '../../lib/sourceComparisons';

const SIDE_LABEL = { before: 'First claim', after: 'Second claim' } as const;

interface Props {
  view: ComparisonView;
  /** Titles for the rules the observation names, when their records have been read. */
  ruleTitle: (ruleId: string) => string | null;
  /** Shown when the observation comes from a labeled fixture rather than a real snapshot. */
  fixtureLabel?: string;
  /** True when this observation names a rule in the conflict being viewed. */
  related?: boolean;
}

/** A value exactly as the response carries it, for the detail view. */
const raw = (value: unknown) => (value === undefined ? 'not present' : JSON.stringify(value));

/**
 * One claim observation from GET /source-comparisons: two recorded claims about one field, each
 * with the exact passages it cites. The order is the order of the response; neither side is
 * marked as controlling, and a difference between two claims is not presented as a legal
 * conflict. Identifiers, raw service values and hashes sit behind disclosures.
 */
export function ComparisonCard({ view, ruleTitle, fixtureLabel, related = false }: Props) {
  const { observation, classification } = view;
  const titleId = `comparison-${view.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <article className="disagreement comparison" data-comparison={view.id} data-classification={observation.classification} data-status={observation.status} aria-labelledby={titleId}>
      <header className="disagreement__head">
        <p className="eyebrow">{view.fieldLabel}</p>
        <h3 id={titleId} className="disagreement__title">
          {view.headline}
        </h3>
        <div className="disagreement__tags">
          <Tag tone={classification.tone}>{STATUS_LABEL[observation.status] ?? sentence(observation.status)}</Tag>
          <Tag tone="neutral" icon={false}>
            No source is preferred
          </Tag>
          <Tag tone="neutral" icon={false}>
            Meaning not checked
          </Tag>
          {related && <Tag tone="info">Concerns a rule in this conflict</Tag>}
          {fixtureLabel && <Tag tone="unknown">{fixtureLabel}</Tag>}
        </div>
        <p className="disagreement__gloss">{classification.gloss}</p>
      </header>

      <div className="disagreement__claims">
        {view.sides.map((side) => (
          <Side key={side.key} side={side} fieldLabel={view.fieldLabel} />
        ))}
      </div>

      <div className="disagreement__resolution">
        <section aria-label="What was checked">
          <p className="disagreement__subhead">What was checked</p>
          <ul className="checks-line">
            {view.sides.map((side) => (
              <li key={side.key} data-state={side.state}>
                <span className="checks-line__key">{SIDE_LABEL[side.key]}:</span> {side.summary}
              </li>
            ))}
            <li data-state="not_checked">
              <span className="checks-line__key">Meaning:</span> Semantic support not checked. Finding a passage is not a check that it says what the claim says.
            </li>
            <li data-state="none_selected">
              <span className="checks-line__key">Precedence:</span> No source preferred, no winner, and no amendment asserted.
            </li>
          </ul>
        </section>
        <section aria-label="Next action">
          <p className="disagreement__subhead">Next action</p>
          <p className="break">{observation.remedy}</p>
          <p className="hint">The service’s own wording. A fact about a property cannot settle a question about the sources.</p>
        </section>
      </div>

      <p className="disagreement__affects">
        <span className="disagreement__subhead">Rules this concerns</span>{' '}
        {observation.rule_ids.length === 0
          ? 'None named. This observation is not tied to an extracted rule.'
          : observation.rule_ids.map((ruleId, index) => {
              const title = ruleTitle(ruleId);
              return (
                <span key={ruleId} data-rule-id={ruleId}>
                  {index > 0 && '; '}
                  {title ?? (
                    <>
                      Rule <span className="mono break">{ruleId}</span> (its record has not been read)
                    </>
                  )}
                </span>
              );
            })}
      </p>

      <Disclosure summary="Observation record">
        <Facts
          dense
          rows={[
            { label: 'Observation', value: <span className="mono break">{view.id}</span> },
            { label: 'Field', value: <span className="mono break">{observation.field}</span> },
            { label: 'Classification', value: <span className="mono">{observation.classification}</span> },
            { label: 'Status', value: <span className="mono">{observation.status}</span> },
            { label: 'Semantic support', value: <span className="mono">{observation.semantic_support}</span> },
            { label: 'Winner', value: <span className="mono">{raw(observation.winner ?? null)}</span>, note: 'The service selects no side.' },
            { label: 'Legal amendment', value: <span className="mono">{raw(observation.legal_amendment ?? null)}</span>, note: 'The service asserts none.' },
            { label: 'First claim, as recorded', value: <span className="mono break">{raw(observation.before.value)}</span> },
            { label: 'Second claim, as recorded', value: <span className="mono break">{raw(observation.after.value)}</span> },
            { label: 'Rule IDs', value: observation.rule_ids.length ? <span className="mono break">{observation.rule_ids.join(', ')}</span> : 'None' },
          ]}
        />
      </Disclosure>
    </article>
  );
}

function Side({ side, fieldLabel }: { side: ComparisonSide; fieldLabel: string }) {
  const passages = side.claim.support;
  return (
    <section className="claim" data-side={side.key} data-support={side.state} aria-label={SIDE_LABEL[side.key]}>
      <p className="claim__label">{SIDE_LABEL[side.key]}</p>
      <dl className="claim__stated">
        <div>
          <dt>{fieldLabel}</dt>
          <dd className="break">{side.value}</dd>
        </div>
      </dl>
      {passages.length === 0 ? (
        <p className="claim__absent">No captured passage supports this claim. It is recorded as a claim only; nothing in the snapshot establishes it.</p>
      ) : (
        passages.map((item, index) => <Support key={`${item.span.doc_id}-${item.span.start}-${index}`} item={item} position={passages.length > 1 ? `Passage ${index + 1} of ${passages.length}` : null} />)
      )}
    </section>
  );
}

const WEB_URL = /^https?:\/\//i;

function Support({ item, position }: { item: ComparisonSupport; position: string | null }) {
  const { span, source } = item;
  const issue = supportIssue(item);
  const problem = supportProblem(item);
  return (
    <div className="claim__support" data-anchor={item.anchor_valid ? 'valid' : 'invalid'} data-issue={issue ?? undefined}>
      {position && <p className="hint">{position}</p>}
      <figure className="claim__quote">
        <blockquote>{span.text}</blockquote>
        <figcaption className="hint">
          {/* Only a confirmed anchor is called the source's text; otherwise it is what was recorded. */}
          {issue ? 'Text as recorded with the claim' : 'Exact source text'} · characters {span.start}–{span.end}
          {span.section ? ` · ${span.section}` : ''}
        </figcaption>
      </figure>
      {problem && (
        <p className="claim__problem">
          <Tag tone="danger">Does not count as support</Tag> {problem}
        </p>
      )}
      {source ? (
        <>
          <dl className="claim__meta">
            <div>
              <dt>Authority</dt>
              <dd>
                <strong>{sentence(source.authority)}</strong>
                {source.capture_status === 'synthetic' && ' · synthetic, not actual law'}
              </dd>
            </div>
            <div>
              <dt>Source type</dt>
              <dd>{sentence(source.source_type)}</dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{source.jurisdictions.join('; ') || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{formatTimestamp(source.retrieved_at)}</dd>
            </div>
            <div>
              <dt>Source URL</dt>
              <dd>
                {WEB_URL.test(source.url) ? (
                  <a className="link break" href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.url}
                  </a>
                ) : (
                  <span className="break">{source.url || 'Not recorded'}</span>
                )}
              </dd>
            </div>
            {source.issues.length > 0 && (
              <div>
                <dt>Capture issues</dt>
                <dd className="break">{source.issues.join('; ')}</dd>
              </div>
            )}
          </dl>
          <Disclosure summary="Source record and hashes">
            <Facts
              dense
              rows={[
                { label: 'Document', value: <span className="mono break">{source.doc_id}</span> },
                { label: 'Capture', value: humanize(source.capture_status) },
                { label: 'Recorded hash', value: <span className="mono break">{source.sha256}</span> },
                { label: 'Hash of stored text', value: <span className="mono break">{source.actual_sha256}</span>, note: source.identity_valid ? 'Matches the recorded hash.' : 'Does not match the recorded hash.' },
                ...(source.manifest_sha256 ? [{ label: 'Manifest hash', value: <span className="mono break">{source.manifest_sha256}</span> }] : []),
                { label: 'Hash on the passage', value: <span className="mono break">{span.source_hash}</span>, note: span.source_hash === source.sha256 ? 'Is the stored source’s recorded hash.' : 'Is not the stored source’s recorded hash.' },
                { label: 'Position check', value: <span className="mono">anchor_valid: {String(item.anchor_valid)}</span> },
                ...(source.duplicate_of ? [{ label: 'Duplicate of', value: <span className="mono break">{source.duplicate_of}</span>, note: 'The capture records this document as a duplicate of another.' }] : []),
              ]}
            />
          </Disclosure>
        </>
      ) : (
        <>
          <p className="claim__authority">The source this passage cites is not in this snapshot, so its authority, date and address cannot be shown.</p>
          <Disclosure summary="Passage record">
            <Facts
              dense
              rows={[
                { label: 'Document cited', value: <span className="mono break">{span.doc_id}</span> },
                { label: 'Hash on the passage', value: <span className="mono break">{span.source_hash}</span> },
                { label: 'Position check', value: <span className="mono">anchor_valid: {String(item.anchor_valid)}</span> },
              ]}
            />
          </Disclosure>
        </>
      )}
    </div>
  );
}
