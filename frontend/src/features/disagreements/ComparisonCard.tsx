import type { ComparisonSupport } from '../../api/types';
import { Disclosure, Facts, Tag } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { humanize, sentence } from '../../lib/labels';
import { type ComparisonView, supportProblem } from '../../lib/sourceComparisons';

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

/**
 * One claim observation from GET /source-comparisons: two claims about one field, each with the
 * exact passages it rests on. The order is the order of the response; neither side is marked as
 * controlling, and a difference between two texts is not presented as a legal conflict.
 */
export function ComparisonCard({ view, ruleTitle, fixtureLabel, related = false }: Props) {
  const { observation, classification } = view;
  const titleId = `comparison-${view.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <article className="disagreement comparison" data-comparison={view.id} data-classification={observation.classification} aria-labelledby={titleId}>
      <header className="disagreement__head">
        <p className="eyebrow">{view.fieldLabel}</p>
        <h3 id={titleId} className="disagreement__title">
          {classification.label}
        </h3>
        <div className="disagreement__tags">
          <Tag tone={classification.tone}>{observation.status === 'unresolved' ? 'Unresolved' : 'Same observation · meaning not verified'}</Tag>
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
          <div key={side.key} className="claim" data-side={side.key} data-support={side.state}>
            <p className="claim__label">{SIDE_LABEL[side.key]}</p>
            <dl className="claim__stated">
              <div>
                <dt>{view.fieldLabel}</dt>
                <dd>{side.value}</dd>
              </div>
            </dl>
            {side.claim.support.length === 0 ? (
              <p className="claim__absent">No captured passage supports this claim. It is recorded as a claim only; nothing in the snapshot establishes it.</p>
            ) : (
              side.claim.support.map((item, index) => <Support key={`${item.span.doc_id}-${item.span.start}-${index}`} item={item} />)
            )}
          </div>
        ))}
      </div>

      <div className="disagreement__resolution">
        <section aria-label="What was checked">
          <p className="disagreement__subhead">What was checked</p>
          <ul className="checks-line">
            {view.sides.map((side) => (
              <li key={side.key} data-state={side.state}>
                <span className="checks-line__key">{SIDE_LABEL[side.key]}</span>
                {side.state === 'supported' ? 'Every passage was found at its recorded position in a source whose hash matches.' : side.state === 'stale' ? 'A recorded passage or its source no longer matches.' : 'No passage to check.'}
              </li>
            ))}
            <li>
              <span className="checks-line__key">Meaning</span>
              Not checked. Finding the text is not a check that it supports the claim.
            </li>
            <li>
              <span className="checks-line__key">Precedence</span>
              None selected. No amendment is asserted.
            </li>
          </ul>
        </section>
        <section aria-label="What would resolve it">
          <p className="disagreement__subhead">What would resolve it</p>
          <p>{observation.remedy}</p>
        </section>
      </div>

      <p className="disagreement__affects">
        <span className="disagreement__subhead">Rules this concerns</span>{' '}
        {observation.rule_ids.length === 0
          ? 'None named. This observation is not tied to an extracted rule.'
          : observation.rule_ids.map((ruleId, index) => (
              <span key={ruleId}>
                {index > 0 && '; '}
                {ruleTitle(ruleId) ?? ''} <span className="mono break">{ruleId}</span>
              </span>
            ))}
      </p>
      <p className="hint">
        Observation <span className="mono break">{view.id}</span> · field <span className="mono">{observation.field}</span>
      </p>
    </article>
  );
}

function Support({ item }: { item: ComparisonSupport }) {
  const { span, source } = item;
  const problem = supportProblem(item);
  return (
    <div className="claim__support" data-anchor={item.anchor_valid ? 'valid' : 'invalid'}>
      <figure className="claim__quote">
        <blockquote>{span.text}</blockquote>
        <figcaption className="hint">
          Exact source text · characters {span.start}–{span.end}
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
              <dt>Source</dt>
              <dd>
                <strong>{sentence(source.authority)}</strong> · {humanize(source.source_type)}
                {source.capture_status === 'synthetic' && ' · synthetic, not actual law'}
              </dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{source.jurisdictions.join(', ') || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{formatTimestamp(source.retrieved_at)}</dd>
            </div>
            <div>
              <dt>Source URL</dt>
              <dd>
                <a className="link break" href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.url}
                </a>
              </dd>
            </div>
          </dl>
          <Disclosure summary="Source record and hashes">
            <Facts
              dense
              rows={[
                { label: 'Document', value: <span className="mono">{source.doc_id}</span> },
                { label: 'Capture', value: sentence(source.capture_status) },
                { label: 'Recorded hash', value: <span className="mono break">{source.sha256}</span> },
                { label: 'Hash of stored text', value: <span className="mono break">{source.actual_sha256}</span>, note: source.identity_valid ? 'Matches the recorded hash.' : 'Does not match the recorded hash.' },
                ...(source.manifest_sha256 ? [{ label: 'Manifest hash', value: <span className="mono break">{source.manifest_sha256}</span> }] : []),
                { label: 'Hash on the passage', value: <span className="mono break">{span.source_hash}</span> },
                ...(source.duplicate_of ? [{ label: 'Duplicate of', value: <span className="mono">{source.duplicate_of}</span> }] : []),
                ...(source.issues.length ? [{ label: 'Capture issues', value: source.issues.join('; ') }] : []),
              ]}
            />
          </Disclosure>
        </>
      ) : (
        <p className="claim__authority">
          Source <span className="mono">{span.doc_id}</span> is not in this snapshot.
        </p>
      )}
    </div>
  );
}
