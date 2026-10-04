import type { AddressItem, JurisdictionResolution, PropertyFacts } from '../../api/types';
import { Disclosure, Facts, Tag } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { MATCH_QUALITY, formatValue, humanize, sentence } from '../../lib/labels';
import { addressLine } from './PropertyFinder';

/** Property facts and jurisdiction quality are kept apart: one is about the building, the other about which local law can be matched. */
export function PropertySummary({ item }: { item: AddressItem }) {
  return (
    <header className="property">
      <p className="eyebrow">
        Property <span className="mono">{item.property.address_id}</span>
      </p>
      <h1 className="property__title">{addressLine(item)}</h1>
      <div className="property__grid">
        <JurisdictionBlock resolution={item.resolution} />
        <FactsBlock property={item.property} />
      </div>
    </header>
  );
}

function JurisdictionBlock({ resolution }: { resolution: JurisdictionResolution }) {
  const quality = MATCH_QUALITY[resolution.match_quality ?? 'unresolved'] ?? { label: sentence(resolution.match_quality ?? 'unresolved'), tone: 'unknown' as const, gloss: '' };
  const unresolved = resolution.unresolved ?? [];
  const identifiers = Object.entries(resolution.identifiers ?? {});
  const attempts = resolution.attempts ?? [];
  return (
    <section className="block" aria-labelledby="jurisdiction-heading">
      <div className="block__head">
        <h2 id="jurisdiction-heading" className="block__title">
          Jurisdiction
        </h2>
        <Tag tone={quality.tone} title={quality.gloss}>
          {quality.label}
        </Tag>
      </div>
      <Facts
        dense
        rows={[
          { label: 'State', value: resolution.state ?? 'Not established' },
          { label: 'Municipality', value: resolution.municipality ?? 'Not established' },
          ...(resolution.county ? [{ label: 'County', value: resolution.county }] : []),
          { label: 'Method', value: <span className="mono">{resolution.method ?? 'not recorded'}</span> },
        ]}
      />
      {resolution.match_quality !== 'resolved' && <p className="block__note block__note--warn">{quality.gloss} The postal city on the address is not treated as the legal municipality.</p>}
      {unresolved.length > 0 && (
        <ul className="plain-list plain-list--tight">
          {unresolved.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {(resolution.benchmark || resolution.retrieved_at || identifiers.length > 0 || attempts.length > 0) && (
        <Disclosure summary="Resolution record">
          <Facts
            dense
            rows={[
              ...(resolution.benchmark ? [{ label: 'Benchmark', value: resolution.benchmark }] : []),
              ...(resolution.vintage ? [{ label: 'Vintage', value: resolution.vintage }] : []),
              ...(resolution.retrieved_at ? [{ label: 'Retrieved', value: formatTimestamp(resolution.retrieved_at) }] : []),
              ...identifiers.map(([key, value]) => ({ label: sentence(key), value: <span className="mono">{value}</span> })),
              ...(attempts.length ? [{ label: 'Attempts', value: `${attempts.length} recorded` }] : []),
            ]}
          />
        </Disclosure>
      )}
    </section>
  );
}

function FactsBlock({ property }: { property: PropertyFacts }) {
  const facts = Object.entries(property.facts ?? {});
  const bounds = Object.entries(property.bounds ?? {});
  const provenance = property.provenance ?? {};
  // A fact can be listed as missing while a value is present (e.g. a request-local value); show only real gaps here.
  const missing = (property.missing_facts ?? []).filter((name) => !(name in (property.facts ?? {})) && !(name in (property.bounds ?? {})));
  return (
    <section className="block" aria-labelledby="facts-heading">
      <div className="block__head">
        <h2 id="facts-heading" className="block__title">
          Property facts
        </h2>
      </div>
      {facts.length + bounds.length === 0 ? (
        <p className="block__note">No property facts are recorded for this address.</p>
      ) : (
        <table className="table table--facts">
          <thead>
            <tr>
              <th scope="col">Fact</th>
              <th scope="col">Value</th>
              <th scope="col">Provenance</th>
            </tr>
          </thead>
          <tbody>
            {facts.map(([name, value]) => (
              <tr key={name}>
                <th scope="row">{sentence(name)}</th>
                <td className="num">{formatValue(value)}</td>
                <td className="table__muted">{provenance[name] ?? 'Not recorded'}</td>
              </tr>
            ))}
            {bounds.map(([name, bound]) => (
              <tr key={`bound-${name}`}>
                <th scope="row">{sentence(name)}</th>
                <td className="num">
                  {bound.lower ?? 'unbounded'} to {bound.upper ?? 'unbounded'}
                </td>
                <td className="table__muted">{bound.provenance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {missing.length > 0 && (
        <p className="block__note">
          <span className="block__note-label">Not on record:</span> {missing.map(humanize).join(', ')}
        </p>
      )}
    </section>
  );
}
