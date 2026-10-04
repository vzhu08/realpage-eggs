import type { AddressItem, JurisdictionResolution, PropertyFacts } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, Facts, Notice, Tag } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { MATCH_QUALITY, formatValue, humanize, sentence } from '../../lib/labels';
import { addressLine } from './PropertyFinder';

interface Props {
  item: AddressItem;
  /** Opens the property chooser. */
  onChange: () => void;
}

/**
 * The property a lookup is about. The address, where it is legally located and the facts on
 * record are on one line each; provenance and the resolution record are a disclosure away.
 * A legal municipality that is not established is never tucked away: it stays on the page.
 */
export function PropertySummary({ item, onChange }: Props) {
  const { property, resolution } = item;
  const quality = MATCH_QUALITY[resolution.match_quality ?? 'unresolved'] ?? { label: sentence(resolution.match_quality ?? 'unresolved'), tone: 'unknown' as const, gloss: '' };
  const resolved = resolution.match_quality === 'resolved';
  const unresolved = resolution.unresolved ?? [];
  const facts = Object.entries(property.facts ?? {});
  const bounds = Object.entries(property.bounds ?? {});
  // A fact can be listed as missing while a value is present (e.g. a request-local value); show only real gaps here.
  const missing = (property.missing_facts ?? []).filter((name) => !(name in (property.facts ?? {})) && !(name in (property.bounds ?? {})));
  const place = [resolution.municipality, resolution.state].filter(Boolean).join(', ');
  return (
    <header className="subject">
      <div className="subject__top">
        <div className="subject__name">
          <p className="eyebrow">Property</p>
          <h1 className="subject__title">{addressLine(item)}</h1>
        </div>
        <button type="button" className="button subject__change" onClick={onChange}>
          <Icon name="search" />
          Change property
        </button>
      </div>

      <dl className="subject__line">
        <div className="subject__cell" data-jurisdiction={resolution.match_quality ?? 'unresolved'}>
          <dt>Legal location</dt>
          <dd>
            {resolved ? place : resolution.state ? `Municipality not established · ${resolution.state}` : 'Not established'}
            <Tag tone={quality.tone} title={quality.gloss}>
              {quality.label}
            </Tag>
          </dd>
        </div>
        {facts.map(([name, value]) => (
          <div className="subject__cell" key={name}>
            <dt>{sentence(name)}</dt>
            <dd className="num">{formatValue(value)}</dd>
          </div>
        ))}
        {bounds.map(([name, bound]) => (
          <div className="subject__cell" key={`bound-${name}`}>
            <dt>{sentence(name)}</dt>
            <dd className="num">
              {bound.lower ?? 'unbounded'} to {bound.upper ?? 'unbounded'}
            </dd>
          </div>
        ))}
        {missing.length > 0 && (
          <div className="subject__cell subject__cell--missing">
            <dt>Not on record</dt>
            <dd>{missing.map(humanize).join(', ')}</dd>
          </div>
        )}
      </dl>

      {!resolved && (
        <Notice tone="unknown" title="Legal municipality not established" compact>
          <p>{quality.gloss} The postal city on the address is not treated as the legal municipality.</p>
          {unresolved.length > 0 && (
            <ul className="plain-list plain-list--tight">
              {unresolved.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <Disclosure summary="Property record: fact provenance and how the location was established" className="subject__record">
        <div className="subject__grid">
          <JurisdictionBlock resolution={resolution} />
          <FactsBlock property={property} missing={missing} />
        </div>
      </Disclosure>
    </header>
  );
}

function JurisdictionBlock({ resolution }: { resolution: JurisdictionResolution }) {
  const quality = MATCH_QUALITY[resolution.match_quality ?? 'unresolved'] ?? { label: sentence(resolution.match_quality ?? 'unresolved'), tone: 'unknown' as const, gloss: '' };
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
          { label: 'Method', value: resolution.method ? sentence(resolution.method) : 'Not recorded', note: resolution.method ? <span className="mono">{resolution.method}</span> : undefined },
          ...(resolution.benchmark ? [{ label: 'Benchmark', value: resolution.benchmark }] : []),
          ...(resolution.vintage ? [{ label: 'Vintage', value: resolution.vintage }] : []),
          ...(resolution.retrieved_at ? [{ label: 'Retrieved', value: formatTimestamp(resolution.retrieved_at) }] : []),
          ...identifiers.map(([key, value]) => ({ label: sentence(key), value: <span className="mono">{value}</span> })),
          ...(attempts.length ? [{ label: 'Attempts', value: `${attempts.length} recorded` }] : []),
          { label: 'Property ID', value: <span className="mono">{resolution.address_id}</span> },
        ]}
      />
    </section>
  );
}

function FactsBlock({ property, missing }: { property: PropertyFacts; missing: string[] }) {
  const facts = Object.entries(property.facts ?? {});
  const bounds = Object.entries(property.bounds ?? {});
  const provenance = property.provenance ?? {};
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
