import { useEffect, useId, useState } from 'react';
import type { AddressItem, FixtureCaseSummary } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Empty, Skeleton, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { MATCH_QUALITY } from '../../lib/labels';
import { useSource } from '../../state/source';
import { useAsync } from '../../state/useAsync';

const PAGE = 25;

export const addressLine = (item: AddressItem): string => {
  const raw = item.property.raw_address;
  return `${raw.street_address}, ${raw.postal_city}, ${raw.state}${raw.zip ? ` ${raw.zip}` : ''}`;
};

interface Props {
  selectedId: string | null;
  selectedCase: string | null;
  onSelect: (item: AddressItem) => void;
  onSelectCase: (item: AddressItem, fixtureCase: FixtureCaseSummary) => void;
  onSwitchToDemo?: () => void;
}

export function PropertyFinder({ selectedId, selectedCase, onSelect, onSelectCase, onSwitchToDemo }: Props) {
  const source = useSource();
  const inputId = useId();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  // Debounce typing so a search is one request, not one per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(text.trim());
      setLimit(PAGE);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text]);

  const page = useAsync(`addresses:${query}:${limit}`, (signal) => source.addresses({ q: query, offset: 0, limit }, signal), 'GET /addresses');
  const catalog = source.catalog?.();
  // Fixture cases point at sample properties; resolve them through the same address source.
  const all = useAsync(catalog ? 'addresses:all' : null, (signal) => source.addresses({ q: '', offset: 0, limit: 100 }, signal), 'GET /addresses');

  const items = page.data?.items ?? [];
  const total = page.data?.total ?? 0;

  return (
    <div className="finder">
      <div className="finder__search">
        <label htmlFor={inputId} className="label">
          Sample properties
        </label>
        <div className="search">
          <Icon name="search" className="search__icon" />
          <input
            id={inputId}
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search address or ID"
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
          />
        </div>
        <p className="hint" aria-live="polite">
          {page.status === 'ready' ? `${total} ${total === 1 ? 'property' : 'properties'}${query ? ` matching “${query}”` : ''}` : page.status === 'loading' ? 'Searching…' : ' '}
        </p>
      </div>

      {page.status === 'loading' && !items.length && <Skeleton lines={4} label="Loading sample properties" />}

      {page.status === 'error' && (
        <div className="finder__error" role="alert">
          <p className="finder__error-title">The property list could not be loaded</p>
          <p>
            {page.error.kind === 'unavailable'
              ? `${page.error.message}. The list cannot be shown until the dataset is ingested; this is a service state, not an empty result.`
              : page.error.message}
          </p>
          <div className="finder__error-actions">
            <button type="button" className="button button--small" onClick={page.reload}>
              Try again
            </button>
            {onSwitchToDemo && (
              <button type="button" className="button button--small button--quiet" onClick={onSwitchToDemo}>
                Open the synthetic demo
              </button>
            )}
          </div>
        </div>
      )}

      {page.status === 'ready' && total === 0 && (
        <Empty title="No sample properties match" icon="search">
          <p>Search looks at the address and the property ID. Only the supplied sample properties can be looked up.</p>
        </Empty>
      )}

      {items.length > 0 && (
        <ul className="finder__list" aria-label="Sample properties">
          {items.map((item) => {
            const quality = MATCH_QUALITY[item.resolution.match_quality ?? 'unresolved'];
            const selected = item.property.address_id === selectedId && !selectedCase;
            return (
              <li key={item.property.address_id}>
                <button type="button" className="finder__item" aria-pressed={selected} onClick={() => onSelect(item)}>
                  <span className="finder__address">{addressLine(item)}</span>
                  <span className="finder__meta">
                    <span className="mono">{item.property.address_id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.resolution.municipality ?? 'Municipality not established'}</span>
                    {item.resolution.match_quality !== 'resolved' && quality && <Tag tone={quality.tone}>{quality.label}</Tag>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {page.status === 'ready' && total > items.length && (
        <button type="button" className="button button--small button--quiet finder__more" onClick={() => setLimit((value) => Math.min(value + PAGE, 100))} disabled={limit >= 100}>
          {limit >= 100 ? 'Refine the search to see others' : `Show more (${items.length} of ${total})`}
        </button>
      )}

      {catalog && (
        <section className="finder__cases" aria-labelledby={`${inputId}-cases`}>
          <h2 id={`${inputId}-cases`} className="label">
            Question-flow fixtures
          </h2>
          <p className="hint">Five contract examples for the planned assist service. Each opens with its own property and date.</p>
          <ul className="finder__list">
            {catalog.cases.map((fixtureCase) => {
              const item = all.data?.items.find((candidate) => candidate.property.address_id === fixtureCase.address_id);
              return (
                <li key={fixtureCase.id}>
                  <button type="button" className="finder__item" aria-pressed={selectedCase === fixtureCase.id} disabled={!item} onClick={() => item && onSelectCase(item, fixtureCase)}>
                    <span className="finder__address">{fixtureCase.title}</span>
                    <span className="finder__purpose">{fixtureCase.purpose}</span>
                    <span className="finder__meta">
                      <span className="mono">{fixtureCase.address_id}</span>
                      <span aria-hidden="true">·</span>
                      <span>as of {formatDate(fixtureCase.as_of)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
