import { type ReactNode, useState } from 'react';
import type { ChangeResult, Evaluation, Rule } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, Empty, Facts, Tabs, Tag, tabPanelProps } from '../../components/ui';
import { formatDate, formatTimestamp } from '../../lib/dates';
import { categoryLabel, humanize, parseReason, resultMeta, sentence } from '../../lib/labels';
import { type ImpactRow, type Lookups, type PropertyLabel, type RuleNode, propertyLabel, propertyTree, sourceTree } from '../../lib/portfolio';

export type Grouping = 'source' | 'property';

const PAGE = 20;

interface Props {
  result: ChangeResult;
  rows: ImpactRow[];
  /** Rows before filtering, so an empty filtered view can say so. */
  totalRows: number;
  lookups: Lookups;
  grouping: Grouping;
  onGrouping: (grouping: Grouping) => void;
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
}

/** Source document → changed rule → impacted property, or the same rows grouped by property. */
export function PortfolioDrillDown({ result, rows, totalRows, lookups, grouping, onGrouping, lookupHref, disagreementHref }: Props) {
  const links = { result, lookupHref, disagreementHref };
  return (
    <div className="drill" data-grouping={grouping}>
      <Tabs
        idBase="drill"
        label="Group the comparison results"
        active={grouping}
        onChange={(id) => onGrouping(id === 'property' ? 'property' : 'source')}
        tabs={[
          { id: 'source', label: 'By source and rule' },
          { id: 'property', label: 'By property' },
        ]}
      />
      <div {...tabPanelProps('drill', grouping)} className="drill__panel">
        {rows.length === 0 ? (
          <Empty title={totalRows ? 'No comparison result matches the selected filters' : 'No comparison results'} icon="layers">
            {totalRows > 0 && <p>Clear a filter to see the other comparison results.</p>}
          </Empty>
        ) : grouping === 'source' ? (
          <ul className="drill__sources">
            {sourceTree(rows, lookups).map((node, index) => (
              <li key={node.docId || 'unloaded'} className="source-node" data-source={node.docId || 'unloaded'}>
                <Branch
                  defaultOpen={index === 0}
                  summary={
                    <span className="source-node__head">
                      <span className="eyebrow">Source</span>
                      <span className="source-node__title">
                        {node.docId ? <span className="mono">{node.docId}</span> : 'Source not known yet'}
                        {node.source && (
                          <span className="source-node__kind">
                            {sentence(node.source.authority)} · {humanize(node.source.source_type ?? 'unclassified')}
                          </span>
                        )}
                      </span>
                      <span className="source-node__count">
                        {node.rules.length} compared {node.rules.length === 1 ? 'rule' : 'rules'} · {node.properties} {node.properties === 1 ? 'property' : 'properties'}
                      </span>
                    </span>
                  }
                >
                  {node.docId ? (
                    node.source ? (
                      <p className="source-node__meta">
                        {node.source.jurisdictions.join(', ')} · retrieved {formatTimestamp(node.source.retrieved_at)} ·{' '}
                        <a className="link break" href={node.source.url} target="_blank" rel="noreferrer noopener">
                          {node.source.url}
                        </a>
                        {node.source.capture_status === 'synthetic' && ' · synthetic source, not actual law'}
                      </p>
                    ) : (
                      <p className="source-node__meta">Source record not loaded.</p>
                    )
                  ) : (
                    <p className="source-node__meta">The rule records for these results have not been read, so their source is not known here.</p>
                  )}
                  <ul className="source-node__rules">
                    {node.rules.map((rule, ruleIndex) => (
                      <RuleBranch key={rule.ruleId} node={rule} lookups={lookups} defaultOpen={index === 0 && ruleIndex === 0} {...links} />
                    ))}
                  </ul>
                </Branch>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="drill__properties">
            {propertyTree(rows, lookups).map((node) => (
              <li key={node.addressId} className="property-node" data-address={node.addressId}>
                <div className="property-node__head">
                  <PropertyName label={node.label} />
                  {result.conflict_flag_address_ids.includes(node.addressId) && <Tag tone="danger">Conflict flagged</Tag>}
                  <a className="link property-node__open" href={lookupHref(node.addressId, result.after)}>
                    Open lookup as of {formatDate(result.after)}
                  </a>
                </div>
                <ul className="impact-rows">
                  {node.rows.map((row) => (
                    <ImpactRowView key={row.key} row={row} heading={<RuleName ruleId={row.ruleId} rule={lookups.rules.get(row.ruleId)} showSource />} {...links} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface Links {
  result: ChangeResult;
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
}

/** One level of the drill-down: a native <details>, so it works from the keyboard without script. */
function Branch({ summary, children, defaultOpen = false, className }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details className={className ? `branch ${className}` : 'branch'} open={defaultOpen}>
      <summary>
        <Icon name="chevron" size={16} className="branch__chevron" />
        <span className="branch__summary">{summary}</span>
      </summary>
      <div className="branch__content">{children}</div>
    </details>
  );
}

function RuleBranch({ node, lookups, defaultOpen, ...links }: { node: RuleNode; lookups: Lookups; defaultOpen: boolean } & Links) {
  const [shown, setShown] = useState(PAGE);
  const { rule } = node;
  const definite = node.rows.filter((row) => row.certainty === 'definite').length;
  const uncertain = node.rows.filter((row) => row.certainty === 'uncertain').length;
  const anchor = rule?.evidence.find((item) => item.quote === rule.quoted_span);
  return (
    <li className="rule-node" data-rule={node.ruleId}>
      <Branch
        defaultOpen={defaultOpen}
        summary={
          <span className="rule-node__head">
            <span className="eyebrow">Compared rule</span>
            <RuleName ruleId={node.ruleId} rule={rule ?? undefined} large />
            <span className="rule-node__count">
              {node.rows.length} {node.rows.length === 1 ? 'property' : 'properties'}
              {definite > 0 && ` · ${definite} definite`}
              {uncertain > 0 && ` · ${uncertain} uncertain`}
            </span>
          </span>
        }
      >
        {rule && (
          <div className="rule-node__source">
            <blockquote className="rule-node__quote">{rule.quoted_span}</blockquote>
            <p className="hint">
              <span className="mono">{rule.source_doc_id}</span>
              {anchor && anchor.start !== null && anchor.start !== undefined ? ` · characters ${anchor.start}–${anchor.end}` : ''} · exact source text
            </p>
            <Disclosure summary="Rule record">
              <Facts
                dense
                rows={[
                  { label: 'Requirement as encoded', value: rule.requirement },
                  { label: 'Jurisdiction', value: rule.jurisdiction },
                  { label: 'Category', value: categoryLabel(rule.category) },
                  { label: 'Lifecycle', value: sentence(rule.lifecycle) },
                  { label: 'Effective date', value: rule.effective_date ? formatDate(rule.effective_date) : 'Not stated on the record' },
                  ...(rule.end_date ? [{ label: 'End date', value: formatDate(rule.end_date) }] : []),
                  { label: 'Semantic review', value: sentence(rule.semantic_verification), note: rule.semantic_verification === 'model_reviewed' ? 'A model review, not an independent human review.' : undefined },
                  { label: 'Rule ID', value: <span className="mono break">{rule.team_rule_id}</span> },
                ]}
              />
            </Disclosure>
          </div>
        )}
        <p className="eyebrow rule-node__impacted">Impacted properties</p>
        <ul className="impact-rows">
          {node.rows.slice(0, shown).map((row) => (
            <ImpactRowView key={row.key} row={row} heading={<PropertyName label={propertyLabel(row.addressId, lookups.addresses.get(row.addressId))} />} {...links} />
          ))}
        </ul>
        {node.rows.length > shown && (
          <button type="button" className="button button--small button--quiet" onClick={() => setShown(node.rows.length)}>
            Show all {node.rows.length} properties
          </button>
        )}
      </Branch>
    </li>
  );
}

export function PropertyName({ label }: { label: PropertyLabel }) {
  return (
    <span className="property-name">
      <span className="property-name__street">{label.street ?? <span className="mono">{label.addressId}</span>}</span>
      <span className="property-name__meta">
        {label.street && <span className="mono">{label.addressId}</span>}
        <span className={label.resolved ? undefined : 'property-name__open'}>{label.place}</span>
      </span>
    </span>
  );
}

export function RuleName({ ruleId, rule, large = false, showSource = false }: { ruleId: string; rule: Rule | undefined; large?: boolean; showSource?: boolean }) {
  if (!rule) {
    return (
      <span className={large ? 'rule-name rule-name--large' : 'rule-name'}>
        <span className="rule-name__title mono break">{ruleId}</span>
        <span className="rule-name__meta">Rule record not loaded</span>
      </span>
    );
  }
  return (
    <span className={large ? 'rule-name rule-name--large' : 'rule-name'}>
      <span className="rule-name__title">{rule.title}</span>
      <span className="rule-name__meta">
        {rule.citation} · {rule.jurisdiction} · {categoryLabel(rule.category)}
        {showSource && (
          <>
            {' · '}
            <span className="mono">{rule.source_doc_id}</span>
          </>
        )}
      </span>
    </span>
  );
}

function ImpactRowView({ row, heading, result, lookupHref, disagreementHref }: { row: ImpactRow; heading: ReactNode } & Links) {
  const was = row.before ? resultMeta(row.before.result) : null;
  const now = row.after ? resultMeta(row.after.result) : null;
  const definite = row.certainty === 'definite';
  return (
    <li className="impact-row" data-certainty={row.certainty} data-address={row.addressId} data-rule={row.ruleId}>
      <Branch
        className="branch--row"
        summary={
          <span className="impact-row__head">
            <span className="impact-row__name">{heading}</span>
            <span className="impact-row__state">
              <Tag tone={definite ? 'applies' : 'unknown'} icon={false}>
                {definite ? 'Definite' : row.certainty === 'uncertain' ? 'Uncertain' : sentence(row.certainty)}
              </Tag>
              <span className="delta__states">
                {was ? <Tag tone={was.tone}>{was.label}</Tag> : <Tag tone="muted">Not compared</Tag>}
                <span aria-hidden="true">→</span>
                <span className="sr-only">then</span>
                {now ? <Tag tone={now.tone}>{now.label}</Tag> : <Tag tone="muted">Not listed</Tag>}
              </span>
              {row.conflict && <Tag tone="danger">Conflict</Tag>}
            </span>
          </span>
        }
      >
        <div className="delta__sides">
          <Side label={`Before · ${formatDate(result.before)}`} evaluation={row.before} absent="This scenario compares the later date only; there is no earlier evaluation." />
          <Side label={`After · ${formatDate(result.after)}`} evaluation={row.after} absent="No evaluation was returned." />
        </div>
        <p className="impact-row__links">
          <a className="link" href={lookupHref(row.addressId, result.after)}>
            Open lookup as of {formatDate(result.after)}
          </a>
          {row.conflict && (
            <a className="link" href={disagreementHref(row.addressId, result.after)}>
              Compare the conflicting sources
            </a>
          )}
        </p>
      </Branch>
    </li>
  );
}

function Side({ label, evaluation, absent }: { label: string; evaluation: Evaluation | null; absent: string }) {
  if (!evaluation) {
    return (
      <div className="delta__side">
        <p className="delta__label">{label}</p>
        <p className="hint">{absent}</p>
      </div>
    );
  }
  const reasons = (evaluation.uncertainty_reasons ?? []).map(parseReason);
  return (
    <div className="delta__side">
      <p className="delta__label">{label}</p>
      <p className="delta__explanation">{evaluation.explanation}</p>
      {(evaluation.missing_facts ?? []).length > 0 && <p className="hint">Needs: {(evaluation.missing_facts ?? []).map(humanize).join(', ')}</p>}
      {reasons
        .filter((reason) => reason.kind !== 'missing_property_fact')
        .map((reason) => (
          <p key={reason.raw} className="hint">
            {reason.label}: {reason.message}
          </p>
        ))}
      {evaluation.evidence.length > 0 && (
        <Disclosure summary={`Evidence (${evaluation.evidence.length} ${evaluation.evidence.length === 1 ? 'quote' : 'quotes'})`}>
          <ul className="spans">
            {evaluation.evidence.map((item, index) => (
              <li key={index}>
                <blockquote>{item.quote}</blockquote>
                <p className="hint">
                  <span className="mono">{item.doc_id}</span>
                  {item.start !== null && item.start !== undefined ? ` · characters ${item.start}–${item.end}` : ''} · cited for {item.supports.map(humanize).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
