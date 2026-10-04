import { useMemo, useState } from 'react';
import type { ChangeOutcome } from '../../api/types';
import { Disclosure, Facts, Notice, SectionHeading, Spinner, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { categoryLabel } from '../../lib/labels';
import { type Filters, type ImpactKind, NO_FILTERS, buildTimeline, filterRows, impactRows, propertyLabel, summarizeByCategory, summarizeByPlace, summarizeGroups } from '../../lib/portfolio';
import { useSource } from '../../state/source';
import { type Grouping, PortfolioDrillDown, PropertyName } from './PortfolioDrillDown';
import { SummaryTable } from './PortfolioSummaries';
import { PortfolioTimeline } from './PortfolioTimeline';
import { type LoadProgress, usePortfolioDetails } from './usePortfolioDetails';

const STATUS = {
  complete: { label: 'Complete', tone: 'applies' as const, gloss: 'Every referenced rule was found and evaluated without uncertainty.' },
  partial: { label: 'Partial', tone: 'unknown' as const, gloss: 'Some impacts are uncertain or some referenced evidence is missing.' },
  blocked: { label: 'Blocked', tone: 'danger' as const, gloss: 'The comparison could not be established.' },
};

const IMPACT: Array<{ kind: ImpactKind; title: string; tone: 'applies' | 'unknown' | 'danger'; empty: string; gloss: string }> = [
  { kind: 'definite', title: 'Definitely affected', tone: 'applies', empty: 'No property is definitely affected.', gloss: 'A rule’s effect on these properties changes, with no open uncertainty.' },
  { kind: 'uncertain', title: 'Uncertain', tone: 'unknown', empty: 'No property has an uncertain impact.', gloss: 'The effect may change, but a fact, source or jurisdiction is unresolved. Kept apart from the definite list.' },
  { kind: 'conflict', title: 'Conflict flagged', tone: 'danger', empty: 'No property carries a conflict flag.', gloss: 'Rules or sources that may conflict reach these properties. Needs review, not an answer.' },
];

interface Props {
  outcome: ChangeOutcome;
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
  /** Run another comparison from the timeline. */
  onCompare: (before: string, after: string) => void;
  busy: boolean;
}

export function ChangeResultView({ outcome, lookupHref, disagreementHref, onCompare, busy }: Props) {
  const source = useSource();
  const { result } = outcome;
  const status = STATUS[result.status];
  const blocked = result.status === 'blocked';
  const hypothetical = result.scenario === 'if_enacted';
  const sameDay = result.before === result.after;
  const mapped = Object.entries(result.mapped_rule_ids ?? {});

  const details = usePortfolioDetails(source, outcome);
  const { lookups } = details;
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [grouping, setGrouping] = useState<Grouping>('property');

  const { rows, unreadable } = useMemo(() => impactRows(result), [result]);
  const visible = useMemo(() => filterRows(rows, filters, lookups), [rows, filters, lookups]);
  // With a summary the groups are the service's own; otherwise they are regrouped from the records as they load.
  const { summary } = outcome;
  const places = useMemo(() => (summary ? [] : summarizeByPlace(rows, lookups)), [summary, rows, lookups]);
  const jurisdictions = useMemo(() => (summary ? summarizeGroups(summary.by_jurisdiction, (key) => key) : []), [summary]);
  const categories = useMemo(() => (summary ? summarizeGroups(summary.by_category, categoryLabel) : summarizeByCategory(rows, lookups)), [summary, rows, lookups]);
  const timeline = useMemo(() => buildTimeline(result, [...lookups.rules.values()]), [result, lookups.rules]);

  const counts: Record<ImpactKind, string[]> = { definite: result.affected_address_ids, uncertain: result.uncertain_address_ids, conflict: result.conflict_flag_address_ids };
  // A flagged property whose result is the same on both dates has no changed row to drill into.
  const flaggedWithoutChange = result.conflict_flag_address_ids.filter((addressId) => !rows.some((row) => row.addressId === addressId && row.conflict));
  const syntheticRules = [...lookups.rules.values()].some((rule) => rule.evidence_mode === 'synthetic');
  const development = outcome.recordedStore === 'dev_portfolio';
  const activeFilters = [
    filters.impact && { key: 'impact' as const, label: IMPACT.find((item) => item.kind === filters.impact)?.title ?? filters.impact },
    filters.place && { key: 'place' as const, label: places.find((group) => group.key === filters.place)?.label ?? 'Location' },
    filters.jurisdiction && { key: 'jurisdiction' as const, label: `Rules of ${filters.jurisdiction}` },
    filters.category && { key: 'category' as const, label: categories.find((group) => group.key === filters.category)?.label ?? 'Category' },
  ].filter((item): item is { key: keyof Filters; label: string } => !!item);
  const shownProperties = new Set(visible.map((row) => row.addressId)).size;

  return (
    <article className="change-result" aria-labelledby="change-heading" data-status={result.status}>
      <div className="context context--static" role="group" aria-label="Comparison context">
        <p className="context__asof">
          <span className="context__label">{sameDay ? 'On' : 'From'}</span> <strong>{formatDate(result.before)}</strong>
          {!sameDay && (
            <>
              {' '}
              <span className="context__label">to</span> <strong>{formatDate(result.after)}</strong>
            </>
          )}
        </p>
        <div className="context__tags">
          <Tag tone={status.tone}>{status.label}</Tag>
          {development ? <Tag tone="unknown">Development fixture · fictional law</Tag> : (outcome.recordedStore || syntheticRules) && <Tag tone="unknown">Synthetic data · not actual law</Tag>}
          {hypothetical ? <Tag tone="pending">Hypothetical · if enacted</Tag> : <Tag tone="neutral" icon={false}>Actual law</Tag>}
          {result.test_id && (
            <Tag tone="neutral" icon={false}>
              Scenario {result.test_id}
            </Tag>
          )}
          <Tag tone="neutral" icon={false}>
            {outcome.origin.label}
          </Tag>
        </div>
        <p className="context__disclaimer">{result.disclaimer}</p>
      </div>

      <h2 id="change-heading" className="sr-only">
        Comparison result
      </h2>

      {outcome.notices.map((notice) => (
        <Notice key={notice} tone="info" title={notice} role="status" compact />
      ))}
      {blocked && (
        <Notice tone="danger" title="Blocked: this comparison could not be established" role="status">
          <p>The counts below are not zero: they could not be computed. Do not read this as a verified empty set.</p>
          <Notes notes={result.notes} />
        </Notice>
      )}
      {hypothetical && (
        <Notice tone="info" title="Hypothetical: assumes the selected pending rules are enacted" compact>
          <p>Pending rules are treated as enacted and effective on the comparison date for this comparison only. Stored law is unchanged, and nothing here says the rules will be enacted.</p>
        </Notice>
      )}

      <section className="section section--first" aria-labelledby="change-impact">
        <SectionHeading id="change-impact" title="Impact on sample properties" level={3} aside={!blocked && rows.length > 0 ? <span className="hint">Select a count to filter the detail below</span> : undefined} />
        <div className="impact">
          {IMPACT.map((item) => {
            const ids = counts[item.kind];
            const active = filters.impact === item.kind;
            return (
              <div key={item.kind} className={`impact__column impact__column--${item.tone}`} data-impact={item.title} data-count={blocked ? 'blocked' : ids.length}>
                <p className="impact__title">{item.title}</p>
                {blocked || ids.length === 0 ? (
                  <p className="impact__count">{blocked ? '—' : 0}</p>
                ) : (
                  <button type="button" className="impact__count impact__count--button" aria-pressed={active} onClick={() => setFilters((current) => ({ ...current, impact: active ? null : item.kind }))}>
                    {ids.length}
                    <span className="sr-only">
                      {' '}
                      {ids.length === 1 ? 'property' : 'properties'}: {item.title}. {active ? 'Showing only these. Select to show all.' : 'Select to show only these.'}
                    </span>
                  </button>
                )}
                <p className="impact__gloss">{blocked ? 'Not established: the comparison is blocked.' : ids.length ? item.gloss : item.empty}</p>
              </div>
            );
          })}
        </div>
        {!blocked && rows.length > 0 && (
          <p className="hint impact__overlap">
            The three counts are separate lists and they overlap
            {result.affected_address_ids.some((id) => result.uncertain_address_ids.includes(id)) ? ': a property is counted under both “definitely affected” and “uncertain” when one rule’s effect on it is settled and another’s is not.' : ': a property can be in more than one, so they do not add up to a total.'}
          </p>
        )}
        {result.status === 'partial' && (
          <Notice tone="unknown" title="Partial result" compact>
            <p>{status.gloss} Read the notes before relying on either list.</p>
            <Notes notes={result.notes} />
          </Notice>
        )}
        {result.status === 'complete' && result.notes.length > 0 && (
          <Notice tone="neutral" title="Notes from the comparison" compact>
            <Notes notes={result.notes} />
          </Notice>
        )}
        {flaggedWithoutChange.length > 0 && (
          <Disclosure summary={`${flaggedWithoutChange.length} flagged ${flaggedWithoutChange.length === 1 ? 'property has' : 'properties have'} no comparison result between these dates`}>
            <ul className="plain-list plain-list--tight">
              {flaggedWithoutChange.map((addressId) => (
                <li key={addressId} className="flagged">
                  <PropertyName label={propertyLabel(addressId, lookups.addresses.get(addressId), summary?.property_labels[addressId])} />
                  <a className="link" href={disagreementHref(addressId, result.after)}>
                    Compare the conflicting sources
                  </a>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </section>

      {!blocked && rows.length > 0 && (
        <section className="section" aria-labelledby="change-summaries">
          <SectionHeading id="change-summaries" title="Where and what" level={3} aside={<span className="hint">Select a row to filter the detail below</span>} />
          <div className="summaries">
            {summary ? (
              <SummaryTable caption="By rule jurisdiction" columnLabel="Jurisdiction of the rule" groups={jurisdictions} selected={filters.jurisdiction} onSelect={(jurisdiction) => setFilters((current) => ({ ...current, jurisdiction }))} />
            ) : (
              <SummaryTable caption="By property location" columnLabel="Legal municipality" groups={places} selected={filters.place} onSelect={(place) => setFilters((current) => ({ ...current, place }))} pending={details.addresses.status === 'loading' ? 'Reading the property list…' : undefined} />
            )}
            <SummaryTable caption="By rule category" columnLabel="Category" groups={categories} selected={filters.category} onSelect={(category) => setFilters((current) => ({ ...current, category }))} pending={!summary && details.rules.status === 'loading' ? 'Reading the rule records…' : undefined} />
          </div>
          <p className="hint">
            {summary
              ? 'Groups are the service’s own unions of its per-property results. A property can be in several groups and in more than one column, so the numbers are not additive.'
              : 'Groups regroup the comparison’s per-property results. A property under two headings is counted in both.'}
          </p>
        </section>
      )}

      {(rows.length > 0 || !blocked) && (
        <section className="section" aria-labelledby="change-diffs">
          <SectionHeading
            id="change-diffs"
            title="Property by property, and source by source"
            level={3}
            aside={
              rows.length > 0 ? (
                <span className="hint" aria-live="polite">
                  {shownProperties} {shownProperties === 1 ? 'property' : 'properties'} · {visible.length} comparison {visible.length === 1 ? 'result' : 'results'}
                </span>
              ) : undefined
            }
          />
          {activeFilters.length > 0 && (
            <div className="filters" role="group" aria-label="Active filters">
              {activeFilters.map((filter) => (
                <button key={filter.key} type="button" className="pill pill--removable" onClick={() => setFilters((current) => ({ ...current, [filter.key]: null }))}>
                  {filter.label}
                  <span aria-hidden="true"> ×</span>
                  <span className="sr-only"> — remove filter</span>
                </button>
              ))}
              <button type="button" className="button button--small button--quiet" onClick={() => setFilters(NO_FILTERS)}>
                Clear filters
              </button>
            </div>
          )}
          <DetailStatus details={details} named={!!summary} />
          <PortfolioDrillDown
            result={result}
            rows={visible}
            totalRows={rows.length}
            lookups={lookups}
            grouping={grouping}
            onGrouping={setGrouping}
            lookupHref={lookupHref}
            disagreementHref={disagreementHref}
            timelineCount={timeline.events.length}
            timeline={
              blocked ? null : (
                <>
                  <p className="section__lead">Dated statements on the rule records in this comparison, in order, with the two compared dates marked. Each date is shown as its source states it.</p>
                  <PortfolioTimeline timeline={timeline} rules={lookups.rules} rows={rows} loading={details.rules.status === 'loading'} blocked={blocked} busy={busy} onCompare={onCompare} />
                </>
              )
            }
          />
          {unreadable.length > 0 && (
            <Disclosure summary={`${unreadable.reduce((total, item) => total + item.entries.length, 0)} entries in an unexpected shape`}>
              <pre className="raw">{JSON.stringify(unreadable, null, 2)}</pre>
            </Disclosure>
          )}
        </section>
      )}

      {development && (
        <Disclosure summary="About this development fixture" className="about">
          <p>
            UX development fixture: fictional sources and properties. The state “ZZ”, its cities, their ordinances and these properties are invented so this view has several jurisdictions, categories and dates to lay out. The rules were created by the backend’s extraction checks and every result here was computed by the backend evaluator. It is not a real snapshot, not Core A’s corpus and not legal evidence.
          </p>
        </Disclosure>
      )}
      {outcome.recordedStore === 'no_extracted_rules' && (
        <Notice tone="synthetic" title="Recorded against a store with no extracted rules" compact>
          <p>This is the backend’s answer for the published scenario when sample properties exist but no rules have been extracted — the state of the real dataset before a provider is configured. It demonstrates the blocked state; it is not a legal result.</p>
        </Notice>
      )}

      {mapped.length > 0 && (
        <section className="section" aria-labelledby="change-mapping">
          <SectionHeading id="change-mapping" title="Scenario references" level={3} />
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Extracted rules matched</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map(([reference, ids]) => (
                <tr key={reference}>
                  <th scope="row" className="mono">
                    {reference}
                  </th>
                  <td>
                    {ids.length ? (
                      <ul className="plain-list plain-list--tight">
                        {ids.map((id) => (
                          <li key={id}>
                            {lookups.rules.get(id)?.title ?? summary?.rule_labels[id] ?? ''} <span className="mono break">{id}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="table__warn">No extracted rule matches this reference</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Disclosure summary="About this comparison" className="about">
        <Facts
          dense
          rows={[
            { label: 'Source of this result', value: outcome.origin.label, note: outcome.origin.detail },
            { label: 'Request', value: <span className="mono break">{JSON.stringify(outcome.request)}</span> },
            { label: 'Scenario', value: result.scenario },
            {
              label: 'Names and groups',
              value: summary ? 'From POST /changes/summary; locations, source text and dates from GET /addresses, GET /rules/{id} and GET /sources/{id}' : 'Read from GET /addresses, GET /rules/{id} and GET /sources/{id}',
              note: 'Groupings and the timeline rearrange values those records and this comparison returned. Nothing is evaluated in the browser.',
            },
            ...(summary?.notes.length ? [{ label: 'Notes on the groups', value: summary.notes.join(' ') }] : []),
          ]}
        />
      </Disclosure>
    </article>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="plain-list plain-list--tight" aria-label="Notes from the comparison">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

/** Progress and failures of the label lookups. The comparison itself is already on screen. */
function DetailStatus({ details, named }: { details: ReturnType<typeof usePortfolioDetails>; named: boolean }) {
  const parts: Array<[string, LoadProgress]> = [
    ['property', details.addresses],
    ['rule', details.rules],
    ['source', details.sources],
  ];
  const loading = parts.filter(([, progress]) => progress.status === 'loading');
  const failed = parts.filter(([, progress]) => progress.failed.length > 0);
  if (!loading.length && !failed.length) return null;
  return (
    <div className="detail-status" aria-live="polite">
      {loading.length > 0 && <Spinner label={`Reading ${loading.map(([name]) => `${name} records`).join(' and ')}…`} />}
      {!loading.length && failed.length > 0 && (
        <Notice
          tone="unknown"
          compact
          title="Some records could not be read"
          actions={
            <button type="button" className="button button--small" onClick={details.retry}>
              Try again
            </button>
          }
        >
          <p>
            {failed.map(([name, progress]) => `${progress.failed.length} ${name} ${progress.failed.length === 1 ? 'record' : 'records'}${progress.error ? ` (${progress.error.message})` : ''}`).join('; ')}.{' '}
            {named ? 'Those entries keep the name the comparison gave them' : 'Those entries keep their ID as their label'}; the source text, dates and legal location that come from the records are missing until they load. The comparison itself is unaffected.
          </p>
        </Notice>
      )}
    </div>
  );
}
