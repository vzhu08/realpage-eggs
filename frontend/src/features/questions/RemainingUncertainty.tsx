import type { Answer, FactDefinition, LookupOutcome } from '../../api/types';
import { Disclosure, SectionHeading, Tag } from '../../components/ui';
import { humanize, sentence } from '../../lib/labels';
import { type OpenItem, groupOpenItems, openItems } from '../../lib/openItems';
import { ruleDisplayNames } from '../../lib/ruleNames';
import { TOPIC_HEADING, type UncertaintyTopic } from '../../lib/uncertainty';

interface Props {
  outcome: LookupOutcome;
  answers: Answer[];
  onInspect: (ruleId: string) => void;
  /** Fact meanings, so a missing fact is named in words rather than by its field name. */
  definitions?: Record<string, FactDefinition>;
  /** Where the conflicting sources for this property and date are compared. */
  disagreementHref?: string;
}

/**
 * What is still not known after the questions. Statements are grouped by their typed kind and
 * fact so the list reads as a few actionable topics; every original statement, with its exact
 * wording, remedy, rule and source text, is one disclosure away. A source gap or a legal
 * conflict is never presented as something a renter or owner could answer.
 */
export function RemainingUncertainty({ outcome, answers, onInspect, definitions = {}, disagreementHref }: Props) {
  const titles = ruleDisplayNames(outcome.lookup.rules);
  const plan = outcome.assist?.question_plan;
  const items = openItems(outcome, answers);
  if (!items.length) return null;
  const groups = groupOpenItems(items, new Set(titles.keys()));
  const topicCount = groups.answerable.length + groups.other.length;

  const heading = (topic: UncertaintyTopic<OpenItem>) => {
    if (topic.kind === 'property_fact' && topic.field) {
      const meaning = definitions[topic.field]?.meaning;
      return meaning ? `Not on record: ${meaning.charAt(0).toLowerCase()}${meaning.slice(1)}` : `Not on record: ${humanize(topic.field)}`;
    }
    return TOPIC_HEADING[topic.kind] ?? sentence(topic.kind);
  };

  const ruleLinks = (ruleIds: string[]) => {
    const listed = [...new Set(ruleIds)].filter((ruleId) => titles.has(ruleId));
    const outside = [...new Set(ruleIds)].filter((ruleId) => !titles.has(ruleId));
    return (
      <>
        {listed.map((ruleId, index) => (
          <span key={ruleId}>
            {index > 0 && ', '}
            <button type="button" className="link" onClick={() => onInspect(ruleId)}>
              {titles.get(ruleId)}
            </button>
          </span>
        ))}
        {outside.length > 0 && (
          <span className="uncertainty__outside" title={outside.join(', ')}>
            {listed.length > 0 ? ' and ' : ''}
            {outside.length} {outside.length === 1 ? 'rule' : 'rules'} not in this result
          </span>
        )}
      </>
    );
  };

  /** One original statement, exactly as the service gave it. */
  const statement = (row: OpenItem) => (
    <li key={row.key} className="statement" data-kind={row.kind} data-reason={row.reason}>
      <p className="statement__label">
        {row.label}
        {row.field && row.kind === 'property_fact' && <span className="mono"> {row.field}</span>}
      </p>
      <p className="statement__message">{row.message}</p>
      {row.remedy && (
        <p className="statement__line">
          <span className="statement__key">Next step</span> {row.remedy}
        </p>
      )}
      {row.who && <p className="statement__line">{row.who}</p>}
      {row.ruleIds.length > 0 && (
        <p className="statement__line">
          <span className="statement__key">Rule</span>{' '}
          {[...new Set(row.ruleIds)].map((ruleId, index) => (
            <span key={ruleId}>
              {index > 0 && '; '}
              {titles.get(ruleId) ?? 'Not in this result'} <span className="mono break">{ruleId}</span>
            </span>
          ))}
        </p>
      )}
      {row.sourceRefs.length > 0 && (
        <ul className="spans">
          {row.sourceRefs.map((ref, index) => (
            <li key={index}>
              <blockquote>{ref.text}</blockquote>
              <p className="hint">
                <span className="mono">{ref.doc_id}</span> · characters {ref.start}–{ref.end} · source hash <span className="mono break">{ref.source_hash}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  const topic = (entry: UncertaintyTopic<OpenItem>) => {
    const first = entry.statements[0] as OpenItem;
    const quotes = entry.statements.reduce((total, row) => total + row.sourceRefs.length, 0);
    return (
      <li key={entry.key} className="uncertainty__item" data-kind={entry.kind} data-field={entry.field ?? undefined} data-statements={entry.statements.length}>
        <div className="uncertainty__head">
          <Tag tone={first.answerable ? 'unknown' : 'muted'} icon={false}>
            {first.next}
          </Tag>
          <h3 className="uncertainty__title">{heading(entry)}</h3>
        </div>
        {entry.ruleIds.length > 0 && (
          <p className="uncertainty__affects">
            <span className="uncertainty__key">Holds back</span> {ruleLinks(entry.ruleIds)}
          </p>
        )}
        {entry.remedies.map((remedy) => (
          <p key={remedy} className="uncertainty__remedy">
            <span className="uncertainty__key">Next step</span> {remedy}
          </p>
        ))}
        {entry.kind === 'conflict' && disagreementHref && (
          <p className="uncertainty__action">
            <a className="button button--small" href={disagreementHref}>
              Compare the conflicting sources
            </a>
          </p>
        )}
        <Disclosure
          className="uncertainty__original"
          summary={`${entry.statements.length === 1 ? 'The service’s statement' : `All ${entry.statements.length} statements from the service`}${quotes > 0 ? ` · ${quotes} source ${quotes === 1 ? 'quote' : 'quotes'}` : ''}`}
        >
          <ul className="statements">{entry.statements.map(statement)}</ul>
        </Disclosure>
      </li>
    );
  };

  return (
    <section className="section" aria-labelledby="uncertainty-heading">
      <SectionHeading
        id="uncertainty-heading"
        title={
          <>
            What remains uncertain <span className="count">{topicCount}</span>
          </>
        }
        aside={
          <span className="hint">
            {groups.statements} {groups.statements === 1 ? 'statement' : 'statements'} from the service, grouped by kind
          </span>
        }
      />
      {groups.answerable.length > 0 && (
        <>
          <p className="uncertainty__group" id="uncertainty-answerable">
            A fact about the property can close these
          </p>
          <ul className="uncertainty" aria-labelledby="uncertainty-answerable">
            {groups.answerable.map(topic)}
          </ul>
        </>
      )}
      {groups.other.length > 0 && (
        <>
          <p className="uncertainty__group" id="uncertainty-other">
            Needs evidence, interpretation or more analysis
          </p>
          <ul className="uncertainty" aria-labelledby="uncertainty-other">
            {groups.other.map(topic)}
          </ul>
        </>
      )}
      {groups.outside.length > 0 && (
        <Disclosure summary={`${groups.outside.reduce((total, entry) => total + entry.statements.length, 0)} more ${groups.outside.reduce((total, entry) => total + entry.statements.length, 0) === 1 ? 'statement concerns a rule' : 'statements concern rules'} that do not reach this property`}>
          <p className="hint">The service reported these for rules outside this result. They do not hold back anything listed above.</p>
          <ul className="uncertainty">{groups.outside.map(topic)}</ul>
        </Disclosure>
      )}
      {plan && !plan.exhaustive && <p className="hint">The plan does not claim this list is exhaustive.</p>}
    </section>
  );
}
