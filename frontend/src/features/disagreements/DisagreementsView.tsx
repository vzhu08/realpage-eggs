import { ViewArtwork } from '../shell/TenentVisuals';
import { useId, useMemo, useState } from 'react';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { DataMode, Rule } from '../../api/types';
import { Disclosure, Empty, ErrorNotice, Facts, Notice, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { formatDate, isIsoDay } from '../../lib/dates';
import { disagreementsFromLookup } from '../../lib/disagreements';
import { isSynthetic, readMetadata } from '../../lib/metadata';
import { propertyLabel } from '../../lib/portfolio';
import { CLASSIFICATION, COUNT_ORDER, arrangeComparisons, comparisonCounts, countPhrase } from '../../lib/sourceComparisons';
import { useSource } from '../../state/source';
import { useAsync } from '../../state/useAsync';
import { PropertyName } from '../changes/PortfolioDrillDown';
import { ComparisonCard } from './ComparisonCard';
import { DisagreementCard } from './DisagreementCard';

interface Props {
  mode: DataMode;
  initial: { address: string | null; asOf: string | null };
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
  onOpen: (addressId: string, asOf: string) => void;
}

/**
 * Two kinds of comparison, kept apart. Claim observations (GET /source-comparisons) set two
 * recorded claims about one field side by side, across the whole snapshot. Evaluator conflicts
 * belong to one property and date: rule records the evaluator could not reconcile in a lookup.
 * Neither names a winner, and a difference between two texts is not called a legal conflict.
 */
export function DisagreementsView({ mode, initial, lookupHref, disagreementHref, onOpen }: Props) {
  const source = useSource();
  const id = useId();
  const catalog = useMemo(() => source.catalog?.(), [source]);
  const context = initial.address && initial.asOf && isIsoDay(initial.asOf) ? { address: initial.address, asOf: initial.asOf } : null;
  const lookup = useAsync(context ? `disagreements:${source.mode}:${context.address}:${context.asOf}` : null, (signal) => source.lookup({ address_id: context!.address, as_of: context!.asOf, answers: [] }, signal), 'lookup');

  const comparisons = useAsync(`comparisons:${source.mode}`, (signal) => source.sourceComparisons(signal), 'GET /source-comparisons');
  const views = useMemo(() => (comparisons.data ? arrangeComparisons(comparisons.data.response) : []), [comparisons.data]);
  const counts = comparisonCounts(views);
  // Observations name rules by ID; read their records for a title. A rule that cannot be read keeps its ID.
  const namedRuleIds = useMemo(() => [...new Set(views.flatMap((view) => view.observation.rule_ids))].sort(), [views]);
  const ruleRecords = useAsync(
    namedRuleIds.length ? `comparison-rules:${source.mode}:${namedRuleIds.join(',')}` : null,
    async (signal) => {
      const rules = new Map<string, Rule>();
      await Promise.all(
        namedRuleIds.map(async (ruleId) => {
          try {
            rules.set(ruleId, (await source.ruleDetail(ruleId, signal)).rule);
          } catch (error) {
            if (signal.aborted) throw error;
          }
        }),
      );
      return rules;
    },
    'GET /rules/{id}',
  );

  const [address, setAddress] = useState(initial.address ?? '');
  const [asOf, setAsOf] = useState(initial.asOf && isIsoDay(initial.asOf) ? initial.asOf : DEFAULT_AS_OF);
  const [touched, setTouched] = useState(false);
  const formError = !address.trim() ? 'Enter a property ID.' : !isIsoDay(asOf) ? 'Enter the date to evaluate.' : null;

  const outcome = lookup.data;
  const conflicts = useMemo(() => (outcome ? disagreementsFromLookup(outcome) : []), [outcome]);
  const conflictRuleIds = useMemo(() => new Set(conflicts.flatMap((view) => view.affectedRuleIds)), [conflicts]);
  const metadata = outcome ? readMetadata(outcome.lookup) : null;
  const synthetic = outcome ? isSynthetic(metadata!) || outcome.origin.kind !== 'live' : false;
  const conflictExamples = (catalog?.development.conflictLookups ?? []).filter((entry) => entry.as_of === '2027-01-15').slice(0, 6);
  const fixtureLabel = comparisons.data?.recordedStore === 'dev_portfolio' ? 'Development fixture · fictional sources' : undefined;
  // In a conflict's context, observations about its rules come first.
  const ordered = useMemo(() => [...views].sort((a, b) => Number(b.observation.rule_ids.some((ruleId) => conflictRuleIds.has(ruleId))) - Number(a.observation.rule_ids.some((ruleId) => conflictRuleIds.has(ruleId)))), [views, conflictRuleIds]);

  return (
    <div className="disagreements">
      <header className="changes__intro workspace-intro">
        <div><p className="eyebrow">A CLOSER LOOK AT THE EVIDENCE</p><h1 className="page-title">Two sources.<br/>The full context.</h1>
        <p className="page-lead">Compare the original words, their authority, and what remains unresolved. Every claim keeps its context. No source is given a winner.</p></div>
        <ViewArtwork kind="sources"/>
      </header>

      {context && (
        <div className="disagreements__result" aria-live="polite">
          {lookup.status === 'loading' && <Skeleton lines={6} label={`Reading conflicts for ${context.address} as of ${formatDate(context.asOf)}`} />}
          {lookup.status === 'error' && (
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
          {outcome && (
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
                <a className="button button--small" href={lookupHref(outcome.lookup.address.address_id, outcome.lookup.as_of)}>
                  Open the full lookup
                </a>
              </div>
              <SectionHeading
                id={`${id}-found`}
                title={
                  <>
                    Conflicts flagged by the evaluator <span className="count">{conflicts.length}</span>
                  </>
                }
              />
              {conflicts.length === 0 ? (
                <Empty title="No conflict is flagged for this property on this date" icon="layers">
                  <p>The evaluator returned no conflict flag in this lookup{metadata?.partialData ? ', within an incomplete dataset' : ''}. That is not a finding that every source agrees: only conflicts between extracted rules are reported.</p>
                </Empty>
              ) : (
                <div className="disagreements__list">
                  {conflicts.map((view) => (
                    <DisagreementCard key={view.id} view={view} ruleTitle={(ruleId) => outcome.lookup.rules.find((rule) => rule.team_rule_id === ruleId)?.title ?? null} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <section className={context ? 'section' : 'section section--first'} aria-labelledby={`${id}-claims`} data-comparisons={comparisons.status}>
        <SectionHeading
          id={`${id}-claims`}
          title={
            <>
              Claims compared across sources {comparisons.status === 'ready' && <span className="count">{views.length}</span>}
            </>
          }
          aside={comparisons.data && <span className="hint">{comparisons.data.origin.label}</span>}
        />
        {comparisons.status === 'loading' && <Skeleton lines={5} label="Reading the claim comparisons" />}
        {comparisons.status === 'error' && (
          <ErrorNotice
            error={comparisons.error}
            context="Claim comparisons"
            actions={
              comparisons.error.kind === 'not_implemented' ? undefined : (
                <button type="button" className="button button--small" onClick={comparisons.reload}>
                  Try again
                </button>
              )
            }
          >
            {comparisons.error.kind === 'not_implemented' ? (
              <p>This backend has no GET /source-comparisons route, so no claim comparisons can be listed. That is a missing capability, not a finding that the sources agree. Conflicts flagged in a lookup are still shown for one property and date.</p>
            ) : comparisons.error.kind === 'unavailable' ? (
              <p>The comparisons cannot be read until the dataset is ready. This is a service state, not a finding that the sources agree.</p>
            ) : (
              <p>No comparisons are shown. This is a failure to read them, not a finding that the sources agree.</p>
            )}
          </ErrorNotice>
        )}
        {comparisons.data && comparisons.data.response.status === 'unavailable' && (
          <Empty title="No claim comparisons are saved with this snapshot" icon="layers">
            <p>The service reports that its snapshot carries no claim annotations. That is an absence of comparisons, not a finding that the sources agree.</p>
            <ServiceNotes notes={comparisons.data.response.notes} />
          </Empty>
        )}
        {comparisons.data && comparisons.data.response.status === 'available' && (
          <>
            {fixtureLabel && (
              <Notice tone="synthetic" title="Development fixture · fictional sources" compact>
                <p>These claims and sources are fictional and were written for layout development. The anchor checks and each classification were computed by the backend. They are shown only in the synthetic demo.</p>
              </Notice>
            )}
            <p className="section__lead">Each comparison is a pair of recorded claims about one field, saved during source review. The service re-checks every cited passage against its stored source on each request. It does not check meaning, and it does not decide which claim is right.</p>
            {views.length === 0 ? (
              <Empty title="The snapshot’s annotations contain no claim comparisons" icon="layers">
                <p>The annotations were read, and none of them is a claim comparison. That is not a finding that the sources agree.</p>
                <ServiceNotes notes={comparisons.data.response.notes} />
              </Empty>
            ) : (
              <>
                <ul className="comparison-counts" aria-label="Comparisons by outcome">
                  {COUNT_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
                    <li key={kind} data-kind={kind}>
                      <Tag tone={CLASSIFICATION[kind].tone}>{countPhrase(kind, counts[kind])}</Tag>
                    </li>
                  ))}
                </ul>
                <div className="disagreements__list">
                  {ordered.map((view) => (
                    <ComparisonCard key={view.id} view={view} fixtureLabel={fixtureLabel} related={view.observation.rule_ids.some((ruleId) => conflictRuleIds.has(ruleId))} ruleTitle={(ruleId) => ruleRecords.data?.get(ruleId)?.title ?? outcome?.lookup.rules.find((rule) => rule.team_rule_id === ruleId)?.title ?? null} />
                  ))}
                </div>
              </>
            )}
            <Disclosure summary="About these comparisons" className="about">
              <ServiceNotes notes={comparisons.data.response.notes} />
              <Facts
                dense
                rows={[
                  { label: 'Source of this list', value: comparisons.data.origin.label, note: comparisons.data.origin.detail },
                  { label: 'Annotations hash', value: <span className="mono break">{comparisons.data.response.annotation_sha256 ?? 'Not reported'}</span> },
                  { label: 'Sources re-checked', value: String(Object.keys(comparisons.data.response.source_hashes).length), note: 'The hash of each stored source text, as the service computed it for this response, is listed below.' },
                ]}
              />
              {Object.keys(comparisons.data.response.source_hashes).length > 0 && (
                <ul className="plain-list plain-list--tight" aria-label="Hash of each stored source text">
                  {Object.entries(comparisons.data.response.source_hashes).map(([docId, hash]) => (
                    <li key={docId}>
                      <span className="mono break">{docId}</span> <span className="mono break">{hash}</span>
                    </li>
                  ))}
                </ul>
              )}
              {comparisons.data.contractWarnings.length > 0 && (
                <>
                  <p className="hint">The response carried fields that are not in this page’s contract. They are ignored, and listed here:</p>
                  <ul className="plain-list plain-list--tight" aria-label="Fields not in the contract">
                    {comparisons.data.contractWarnings.map((warning) => (
                      <li key={warning} className="mono break">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="hint">{comparisons.data.response.disclaimer}</p>
            </Disclosure>
          </>
        )}
      </section>

      <section className="section" aria-labelledby={`${id}-property`}>
        <SectionHeading id={`${id}-property`} title="Conflicts flagged for one property" />
        <p className="section__lead">The evaluator reports a conflict inside a lookup when two rule records cannot be reconciled. A result or a comparison that carries a conflict flag links here with both fields filled in.</p>
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
              <input id={`${id}-address`} type="text" className="input" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={touched && !address.trim() ? true : undefined} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-date`} className="label">
                As of
              </label>
              <input id={`${id}-date`} type="date" className="input input--date" value={asOf} onChange={(event) => setAsOf(event.target.value)} aria-invalid={touched && !isIsoDay(asOf) ? true : undefined} />
            </div>
            <div className="field field--action">
              <button type="submit" className="button" disabled={lookup.status === 'loading'}>
                {lookup.status === 'loading' ? 'Reading…' : 'Show conflicts'}
              </button>
            </div>
          </div>
          {touched && formError && (
            <p className="field__error" role="alert">
              {formError}
            </p>
          )}
        </form>
        {conflictExamples.length > 0 && (
          <div className="disagreements__recorded">
            <p className="label" id={`${id}-examples`}>
              Recorded lookups with a conflict flag
            </p>
            <ul className="disagreements__examples" aria-labelledby={`${id}-examples`}>
              {conflictExamples.map((entry) => (
                <li key={`${entry.address_id}-${entry.as_of}`}>
                  <a className="finder__item" href={disagreementHref(entry.address_id, entry.as_of)}>
                    <PropertyName label={propertyLabel(entry.address_id, catalog?.development.properties.find((item) => item.property.address_id === entry.address_id))} />
                    <span className="finder__meta">as of {formatDate(entry.as_of)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mode === 'live' && !context && (
          <Notice tone="neutral" title="Conflicts are reported per property and date" compact>
            <p>No route lists evaluator conflicts across the whole dataset, so this part starts from one property and date.</p>
          </Notice>
        )}
      </section>
    </div>
  );
}

function ServiceNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="plain-list plain-list--tight" aria-label="Notes from the service">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
