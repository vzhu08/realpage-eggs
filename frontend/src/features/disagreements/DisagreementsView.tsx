import { useId, useMemo, useState } from 'react';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { DataMode, Rule, SourceDocument } from '../../api/types';
import { Empty, ErrorNotice, Notice, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { formatDate, isIsoDay } from '../../lib/dates';
import { disagreementFromProposed, disagreementsFromLookup } from '../../lib/disagreements';
import { isSynthetic, readMetadata } from '../../lib/metadata';
import { propertyLabel } from '../../lib/portfolio';
import { useSource } from '../../state/source';
import { useAsync } from '../../state/useAsync';
import { PropertyName } from '../changes/PortfolioDrillDown';
import { DisagreementCard } from './DisagreementCard';

interface Props {
  mode: DataMode;
  initial: { address: string | null; asOf: string | null };
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
  onOpen: (addressId: string, asOf: string) => void;
}

/**
 * Source disagreements. With a property and date in the address it shows the conflicts the
 * evaluator flagged in that lookup; without one it explains how to get here and, in the
 * synthetic demo, lists recorded examples and the labeled development fixture.
 */
export function DisagreementsView({ mode, initial, lookupHref, disagreementHref, onOpen }: Props) {
  const source = useSource();
  const id = useId();
  const catalog = useMemo(() => source.catalog?.(), [source]);
  const context = initial.address && initial.asOf && isIsoDay(initial.asOf) ? { address: initial.address, asOf: initial.asOf } : null;

  const lookup = useAsync(context ? `disagreements:${source.mode}:${context.address}:${context.asOf}` : null, (signal) => source.lookup({ address_id: context!.address, as_of: context!.asOf, answers: [] }, signal), 'lookup');

  // The development fixture's field-level entries name sources and rules by ID; read their records.
  const proposed = catalog?.development.proposedDisagreements ?? [];
  const proposedDocs = [...new Set(proposed.flatMap((entry) => entry.claims.map((claim) => claim.span.doc_id)))];
  const proposedRuleIds = [...new Set(proposed.flatMap((entry) => entry.affected_rule_ids))];
  const records = useAsync(
    proposed.length && !context ? `proposed:${proposedDocs.join(',')}:${proposedRuleIds.join(',')}` : null,
    async (signal) => {
      const sources = new Map<string, SourceDocument>();
      const rules = new Map<string, Rule>();
      await Promise.all([
        ...proposedDocs.map(async (docId) => sources.set(docId, await source.source(docId, signal))),
        ...proposedRuleIds.map(async (ruleId) => rules.set(ruleId, (await source.ruleDetail(ruleId, signal)).rule)),
      ]);
      return { sources, rules };
    },
    'source and rule records',
  );

  const [address, setAddress] = useState(initial.address ?? '');
  const [asOf, setAsOf] = useState(initial.asOf && isIsoDay(initial.asOf) ? initial.asOf : DEFAULT_AS_OF);
  const [touched, setTouched] = useState(false);
  const formError = !address.trim() ? 'Enter a property ID.' : !isIsoDay(asOf) ? 'Enter the date to evaluate.' : null;

  const outcome = lookup.data;
  const views = useMemo(() => (outcome ? disagreementsFromLookup(outcome) : []), [outcome]);
  const metadata = outcome ? readMetadata(outcome.lookup) : null;
  const synthetic = outcome ? isSynthetic(metadata!) || outcome.origin.kind !== 'live' : false;
  const conflictExamples = (catalog?.development.conflictLookups ?? []).filter((entry) => entry.as_of === '2027-01-15').slice(0, 6);

  return (
    <div className="disagreements">
      <header className="changes__intro">
        <p className="eyebrow">Disagreements</p>
        <h1 className="welcome__title">Where two sources say different things, and what would settle it.</h1>
        <p className="welcome__lead">
          Each conflict shows both claims with their exact text, the authority and retrieval date of each source, why it is unresolved and the next step. The workspace never chooses between them, and a result that depends on the conflict stays unknown.
        </p>
      </header>

      <form
        className="changes__form disagreements__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!formError) onOpen(address.trim(), asOf);
        }}
      >
        <div className="changes__fields">
          <div className="field">
            <label htmlFor={`${id}-address`} className="label">
              Property ID
            </label>
            <input id={`${id}-address`} type="text" className="input" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={touched && !address.trim() ? true : undefined} aria-describedby={`${id}-hint`} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-date`} className="label">
              As of
            </label>
            <input id={`${id}-date`} type="date" className="input input--date" value={asOf} onChange={(event) => setAsOf(event.target.value)} aria-invalid={touched && !isIsoDay(asOf) ? true : undefined} />
          </div>
          <div className="field field--action">
            <button type="submit" className="button button--primary" disabled={lookup.status === 'loading'}>
              {lookup.status === 'loading' ? 'Reading…' : 'Show conflicts'}
            </button>
          </div>
        </div>
        <p id={`${id}-hint`} className="hint">
          Conflicts are reported per property and date. A lookup or a comparison that carries a conflict flag links here with both filled in.
        </p>
        {touched && formError && (
          <p className="field__error" role="alert">
            {formError}
          </p>
        )}
      </form>

      <div className="disagreements__result" aria-live="polite">
        {context && lookup.status === 'loading' && <Skeleton lines={6} label={`Reading conflicts for ${context.address} as of ${formatDate(context.asOf)}`} />}
        {context && lookup.status === 'error' && (
          <ErrorNotice
            error={lookup.error}
            context={`Conflicts for ${context.address} as of ${formatDate(context.asOf)}`}
            actions={
              lookup.error.kind === 'not_recorded' || lookup.error.kind === 'not_found' || lookup.error.kind === 'invalid_request' ? (
                lookup.error.suggestions.map((date) => (
                  <a key={date} className="button button--small" href={disagreementHref(context.address, date)}>
                    Use {formatDate(date)}
                  </a>
                ))
              ) : (
                <button type="button" className="button button--small" onClick={lookup.reload}>
                  Try again
                </button>
              )
            }
          >
            {lookup.error.kind === 'unavailable' && <p>No conflicts can be read until the dataset is ready. This is a service state, not a finding that the sources agree.</p>}
          </ErrorNotice>
        )}

        {context && outcome && (
          <section className="section section--first" aria-labelledby={`${id}-found`}>
            <div className="context context--static" role="group" aria-label="Conflict context">
              <p className="context__asof">
                <span className="context__label">As of</span> <strong>{formatDate(outcome.lookup.as_of)}</strong>
              </p>
              <div className="context__tags">
                {synthetic && <Tag tone="unknown">Synthetic data · not actual law</Tag>}
                {metadata?.partialData && <Tag tone="unknown">Partial data</Tag>}
                <Tag tone="neutral" icon={false}>
                  {outcome.origin.label}
                </Tag>
              </div>
              <p className="context__disclaimer">{outcome.lookup.disclaimer}</p>
            </div>
            <div className="disagreements__property">
              <PropertyName label={propertyLabel(outcome.lookup.address.address_id, { property: outcome.lookup.address, resolution: outcome.lookup.jurisdiction })} />
              <a className="link" href={lookupHref(outcome.lookup.address.address_id, outcome.lookup.as_of)}>
                Open the full lookup
              </a>
            </div>
            <SectionHeading
              id={`${id}-found`}
              title={
                <>
                  Conflicts flagged by the evaluator <span className="count">{views.length}</span>
                </>
              }
            />
            {views.length === 0 ? (
              <Empty title="No conflict is flagged for this property on this date" icon="layers">
                <p>The evaluator returned no conflict flag in this lookup{metadata?.partialData ? ', within an incomplete dataset' : ''}. That is not a finding that every source agrees: only conflicts between extracted rules are reported.</p>
              </Empty>
            ) : (
              <div className="disagreements__list">
                {views.map((view) => (
                  <DisagreementCard key={view.id} view={view} ruleTitle={(ruleId) => outcome.lookup.rules.find((rule) => rule.team_rule_id === ruleId)?.title ?? null} />
                ))}
              </div>
            )}
          </section>
        )}

        {!context && (
          <>
            {mode === 'live' && (
              <Notice tone="info" title="Open this view from a result that carries a conflict flag">
                <p>The API reports conflicts inside lookups and comparisons. No route lists disagreements across the whole dataset yet, so this page starts from one property and date.</p>
              </Notice>
            )}

            {conflictExamples.length > 0 && (
              <section className="section section--first" aria-labelledby={`${id}-examples`}>
                <SectionHeading id={`${id}-examples`} title="Recorded lookups with a conflict flag" level={3} />
                <p className="section__lead">From the development portfolio (fictional law, evaluated by the backend). Each opens the conflicts the evaluator flagged for that property.</p>
                <ul className="disagreements__examples">
                  {conflictExamples.map((entry) => (
                    <li key={`${entry.address_id}-${entry.as_of}`}>
                      <a className="finder__item" href={disagreementHref(entry.address_id, entry.as_of)}>
                        <PropertyName label={propertyLabel(entry.address_id, catalog?.development.properties.find((item) => item.property.address_id === entry.address_id))} />
                        <span className="finder__meta">as of {formatDate(entry.as_of)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {proposed.length > 0 && (
              <section className="section" aria-labelledby={`${id}-proposed`}>
                <SectionHeading id={`${id}-proposed`} title="Field-level claims" level={3} />
                <Notice tone="synthetic" title="Development fixture in a proposed shape">
                  <p>
                    Comparing two sources on a single field, such as an effective date, needs a contract that does not exist yet (PLAT-06) and source comparisons from Core A (CORE-06). The example below was written by the UX lane to lay out the view. Its sources are fictional, the backend did not produce or evaluate it, and it is not connected to any result.
                  </p>
                </Notice>
                {records.status === 'loading' && <Skeleton lines={4} label="Reading the source records" />}
                {records.status === 'error' && <ErrorNotice error={records.error} context="Development fixture records" />}
                <div className="disagreements__list">
                  {proposed.map((entry) => (
                    <DisagreementCard
                      key={entry.disagreement_id}
                      view={disagreementFromProposed(entry, records.data?.sources ?? new Map())}
                      ruleTitle={(ruleId) => records.data?.rules.get(ruleId)?.title ?? null}
                      footer={
                        <p className="hint">
                          Contract status: <span className="mono">{entry.contract_status}</span>. {entry.authored_by}.
                        </p>
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
