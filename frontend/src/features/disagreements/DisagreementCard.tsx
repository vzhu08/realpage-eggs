import type { ReactNode } from 'react';
import { Tag } from '../../components/ui';
import { formatDate, formatTimestamp } from '../../lib/dates';
import type { ClaimView, DisagreementView } from '../../lib/disagreements';
import { humanize, resultMeta, sentence } from '../../lib/labels';

const BASIS: Record<DisagreementView['basis'], { eyebrow: string; gloss: string }> = {
  same_provision: { eyebrow: 'Two records of one provision', gloss: 'Two captured sources were encoded for the same provision and state different things. The backend keeps both and flags the conflict.' },
  interaction: { eyebrow: 'Two rules, precedence not established', gloss: 'A source describes how these two rules relate, and the evaluator could not turn that into a settled priority.' },
  proposed_fixture: { eyebrow: 'Two sources, one field', gloss: 'A field-level comparison of two captured sources. The service does not produce this yet.' },
};

const FIELD_LABELS: Record<string, string> = {
  requirement: 'Requirement',
  key_value: 'Key value',
  effective_date: 'Effective date',
  end_date: 'End date',
  lifecycle: 'Lifecycle',
  exemptions: 'Exemptions',
  coverage_conditions: 'Coverage conditions',
  exemption_conditions: 'Exemption conditions',
};
const fieldLabel = (field: string) => FIELD_LABELS[field] ?? sentence(field);
const DATE_FIELDS = new Set(['effective_date', 'end_date']);
const stateValue = (field: string, value: string | null) => (value === null ? 'Not stated' : DATE_FIELDS.has(field) ? formatDate(value) : value);

interface Props {
  view: DisagreementView;
  /** Titles for the rules named in `affectedRuleIds`, when known. */
  ruleTitle: (ruleId: string) => string | null;
  /** Extra content under the card, e.g. links back to the lookup. */
  footer?: ReactNode;
}

/**
 * Two source-backed claims, side by side, with what would resolve them. The order of the two
 * is the order of the response; nothing here marks either as controlling.
 */
export function DisagreementCard({ view, ruleTitle, footer }: Props) {
  const basis = BASIS[view.basis];
  const title = view.fields.length ? `The sources differ on: ${view.fields.map(fieldLabel).join(', ').toLowerCase()}` : view.basis === 'interaction' ? 'Which of the two rules controls is not established' : 'A conflict is flagged for this rule';
  const single = view.claims.length < 2;
  return (
    <article className="disagreement" data-disagreement={view.id} data-basis={view.basis} aria-labelledby={`${view.id}-title`}>
      <header className="disagreement__head">
        <p className="eyebrow">{basis.eyebrow}</p>
        <h3 id={`${view.id}-title`} className="disagreement__title">
          {title}
        </h3>
        <div className="disagreement__tags">
          <Tag tone="unknown">Unresolved</Tag>
          <Tag tone="neutral" icon={false}>
            No source is preferred
          </Tag>
          {view.basis === 'proposed_fixture' && <Tag tone="unknown">Development fixture · proposed shape</Tag>}
        </div>
        <p className="disagreement__gloss">{basis.gloss}</p>
      </header>

      <div className={single ? 'disagreement__claims disagreement__claims--single' : 'disagreement__claims'}>
        {view.claims.map((claim, index) => (
          <Claim key={claim.key} claim={claim} index={index} fields={view.fields} />
        ))}
        {single && (
          <div className="claim claim--absent">
            <p className="claim__label">Other record</p>
            <p>The record this one conflicts with is not part of this response, so it cannot be shown beside it.</p>
          </div>
        )}
      </div>

      {view.relation && (
        <section className="disagreement__relation" aria-label="What the source says about the two rules">
          <p className="disagreement__subhead">What the source says about the two rules</p>
          <p className="hint">
            Recorded as “{humanize(view.relation.kind)}”: {view.relation.note}
          </p>
          <ul className="spans">
            {view.relation.evidence.map((item, index) => (
              <li key={index}>
                <blockquote>{item.quote}</blockquote>
                <p className="hint">
                  <span className="mono">{item.doc_id}</span>
                  {item.start !== null && item.start !== undefined ? ` · characters ${item.start}–${item.end}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="disagreement__resolution">
        <section aria-label="Why this is unresolved">
          <p className="disagreement__subhead">Why this is unresolved</p>
          {view.reasons.length ? (
            <ul className="plain-list plain-list--tight">
              {view.reasons.map((reason) => (
                <li key={reason}>{reason.charAt(0).toUpperCase() + reason.slice(1)}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">The response gives no reason beyond the conflict flag.</p>
          )}
        </section>
        <section aria-label="What would resolve it">
          <p className="disagreement__subhead">What would resolve it</p>
          {view.remedies.length ? (
            <ul className="plain-list plain-list--tight">
              {view.remedies.map((remedy) => (
                <li key={remedy}>{remedy}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">The response names no next step for this conflict.</p>
          )}
          <p className="hint">This is a question about the sources. A fact about the property cannot settle it.</p>
        </section>
      </div>

      {view.affectedRuleIds.length > 0 && (
        <p className="disagreement__affects">
          <span className="disagreement__subhead">{view.basis === 'proposed_fixture' ? 'Rule this concerns' : 'Rules held open'}</span>{' '}
          {view.affectedRuleIds.map((ruleId, index) => (
            <span key={ruleId}>
              {index > 0 && '; '}
              {ruleTitle(ruleId) ?? ''} <span className="mono break">{ruleId}</span>
            </span>
          ))}
        </p>
      )}
      {footer}
    </article>
  );
}

function Claim({ claim, index, fields }: { claim: ClaimView; index: number; fields: string[] }) {
  const result = claim.evaluation ? resultMeta(claim.evaluation.result) : null;
  const structural = fields.filter((field) => !claim.stated.some((item) => item.field === field));
  return (
    <div className="claim" data-claim={claim.key}>
      <p className="claim__label">
        Source {index + 1} <span className="mono">{claim.docId}</span>
      </p>
      {claim.source ? (
        <p className="claim__authority">
          <strong>{sentence(claim.source.authority)}</strong> · {humanize(claim.source.source_type ?? 'unclassified')}
          {claim.source.capture_status === 'synthetic' && ' · synthetic, not actual law'}
        </p>
      ) : (
        <p className="claim__authority">Source record not loaded</p>
      )}
      {claim.rule && (
        <p className="claim__rule">
          {claim.rule.title}
          <span className="claim__citation">{claim.rule.citation}</span>
        </p>
      )}

      {claim.stated.length > 0 && (
        <dl className="claim__stated">
          {claim.stated.map((item) => (
            <div key={item.field}>
              <dt>{fieldLabel(item.field)}</dt>
              <dd>{stateValue(item.field, item.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {structural.length > 0 && <p className="hint">Also encoded differently: {structural.map(fieldLabel).join(', ').toLowerCase()}. Open the rule’s evidence to compare the encodings.</p>}

      {claim.quote && (
        <figure className="claim__quote">
          <blockquote>{claim.quote.text}</blockquote>
          <figcaption className="hint">
            Exact source text
            {claim.quote.start !== null && claim.quote.end !== null ? ` · characters ${claim.quote.start}–${claim.quote.end}` : ' · offsets not recorded'}
          </figcaption>
        </figure>
      )}

      <dl className="claim__meta">
        {claim.statusDates.map((item) => (
          <div key={`${item.status}-${item.on}`}>
            <dt>{sentence(item.status)}</dt>
            <dd>{formatDate(item.on)}</dd>
          </div>
        ))}
        <div>
          <dt>Retrieved</dt>
          <dd>{claim.source ? formatTimestamp(claim.source.retrieved_at) : 'Not loaded'}</dd>
        </div>
        {claim.source && (
          <div>
            <dt>Source URL</dt>
            <dd>
              <a className="link break" href={claim.source.url} target="_blank" rel="noreferrer noopener">
                {claim.source.url}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {result && (
        <p className="claim__result">
          <span className="hint">This property, under this record</span> <Tag tone={result.tone}>{result.label}</Tag>
        </p>
      )}
    </div>
  );
}
