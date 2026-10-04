import type { Rule } from '../../api/types';
import { Disclosure, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { humanize, sentence } from '../../lib/labels';
import { type ComparisonOffer, type ImpactRow, type Timeline, type TimelineEvent, comparisonsAcross } from '../../lib/portfolio';

const EVENT_LABEL = (event: TimelineEvent): { label: string; tone: 'applies' | 'pending' | 'muted' | 'future' | 'neutral' } => {
  if (event.type === 'effective') return { label: 'Takes effect', tone: 'applies' };
  if (event.type === 'end') return { label: 'Ends', tone: 'muted' };
  if (event.type === 'observed') return { label: `Status recorded: ${humanize(event.status ?? 'unknown')}`, tone: 'neutral' };
  if (event.status === 'enacted') return { label: 'Enacted', tone: 'future' };
  if (event.status === 'pending') return { label: 'Recorded as pending', tone: 'pending' };
  return { label: sentence(event.status ?? 'status'), tone: 'muted' };
};

const POSITION_NOTE: Record<TimelineEvent['position'], string> = {
  earlier: 'On or before the first date, so both sides of the comparison already reflect it.',
  between: 'Between the two dates.',
  later: 'After the second date. Not part of this comparison.',
  overlaps: 'The stated date is not a single day and overlaps a compared date.',
};

const OFFER_LABEL: Record<ComparisonOffer['meaning'], string> = {
  day_before_to_day: 'Compare the day before with this day',
  day_before_to_first_possible_day: 'Compare the day before with the first possible day',
  day_before_to_last_possible_day: 'Compare the day before with the last possible day',
};

interface Props {
  timeline: Timeline;
  rules: ReadonlyMap<string, Rule>;
  rows: ImpactRow[];
  /** True while rule records are still being read; the two compared dates are shown meanwhile. */
  loading: boolean;
  blocked: boolean;
  busy: boolean;
  onCompare: (before: string, after: string) => void;
}

type Entry = { kind: 'event'; event: TimelineEvent } | { kind: 'query'; role: 'from' | 'to'; date: string };

/**
 * The dated statements on the rule records behind a comparison, in order, with the two
 * compared dates marked. Dates keep the precision the source gave them.
 */
export function PortfolioTimeline({ timeline, rules, rows, loading, blocked, busy, onCompare }: Props) {
  const sameDay = timeline.before === timeline.after;
  const entries: Entry[] = [];
  let fromPlaced = false;
  let toPlaced = false;
  const placeMarkers = (low: string | null) => {
    if (!fromPlaced && (low === null || low > timeline.before)) {
      entries.push({ kind: 'query', role: 'from', date: timeline.before });
      fromPlaced = true;
    }
    if (!toPlaced && (low === null || low > timeline.after)) {
      if (!sameDay) entries.push({ kind: 'query', role: 'to', date: timeline.after });
      toPlaced = true;
    }
  };
  for (const event of timeline.events) {
    placeMarkers(event.low);
    entries.push({ kind: 'event', event });
  }
  placeMarkers(null);

  // Two records of one provision share a title; name it once and say how many records there are.
  const namesFor = (event: TimelineEvent) => {
    const names = new Map<string, { key: string; title: string | null; count: number }>();
    for (const ruleId of event.ruleIds) {
      const title = rules.get(ruleId)?.title ?? null;
      const key = title ?? ruleId;
      const entry = names.get(key) ?? { key, title, count: 0 };
      entry.count += 1;
      names.set(key, entry);
    }
    return [...names.values()];
  };
  const propertiesFor = (event: TimelineEvent) => new Set(rows.filter((row) => event.ruleIds.includes(row.ruleId)).map((row) => row.addressId)).size;

  return (
    <div className="timeline" data-timeline>
      <ol className="timeline__list">
        {entries.map((entry) => {
          if (entry.kind === 'query') {
            return (
              <li key={`query-${entry.role}`} className="timeline__item timeline__item--query" data-query={entry.role}>
                <p className="timeline__date">
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                </p>
                <div className="timeline__body">
                  <p className="timeline__query">{sameDay ? 'Compared date' : entry.role === 'from' ? 'First compared date' : 'Second compared date'}</p>
                  <p className="hint">{sameDay ? 'Both sides of the comparison use this day.' : entry.role === 'from' ? 'Results before the change are evaluated on this day.' : 'Results after the change are evaluated on this day.'}</p>
                </div>
              </li>
            );
          }
          const { event } = entry;
          const meta = EVENT_LABEL(event);
          const offers = comparisonsAcross(event).filter((offer) => !(offer.before === timeline.before && offer.after === timeline.after));
          // Dates between the compared days are the ones a reader will want to step across.
          const prominent = event.position === 'between' || event.position === 'overlaps';
          const affected = prominent ? propertiesFor(event) : 0;
          const compareButtons = (
            <div className="timeline__actions">
              {offers.map((offer) => (
                <button key={offer.meaning} type="button" className="button button--small button--quiet" disabled={busy} onClick={() => onCompare(offer.before, offer.after)}>
                  {OFFER_LABEL[offer.meaning]}
                  <span className="timeline__pair">
                    {formatDate(offer.before)} → {formatDate(offer.after)}
                  </span>
                </button>
              ))}
            </div>
          );
          return (
            <li key={event.key} className="timeline__item" data-position={event.position} data-event={event.key}>
              <p className="timeline__date">
                <time dateTime={event.date}>{formatDate(event.date)}</time>
                {event.precision !== 'day' && <span className="timeline__precision">{event.precision === 'month' ? 'month only' : 'year only'}</span>}
              </p>
              <div className="timeline__body">
                <p className="timeline__label">
                  <Tag tone={meta.tone} icon={false}>
                    {meta.label}
                  </Tag>
                  <span className="timeline__rules">
                    {namesFor(event).map((name, index) => (
                      <span key={name.key}>
                        {index > 0 && '; '}
                        {name.title ?? <span className="mono">{name.key}</span>}
                        {name.count > 1 && <span className="timeline__records"> ({name.count} records)</span>}
                      </span>
                    ))}
                  </span>
                </p>
                <p className="hint">
                  {POSITION_NOTE[event.position]}
                  {affected > 0 && ` ${affected === 1 ? '1 property has' : `${affected} properties have`} a definite or possible impact under ${event.ruleIds.length === 1 ? 'this rule' : 'these rules'} in this comparison.`}
                </p>
                {event.precision !== 'day' && (
                  <p className="timeline__imprecise">
                    The source states only the {event.precision}: {formatDate(event.low)} to {formatDate(event.high)}. The evaluator returns unknown for a query date inside that span; the interface does not pick a day.
                  </p>
                )}
                {(event.evidence.length > 0 || (!prominent && offers.length > 0)) && (
                  <Disclosure summary={event.evidence.length > 0 ? `Source text for this date (${event.evidence.length})` : 'Compare across this date'}>
                    {event.evidence.length > 0 && (
                      <ul className="spans">
                        {event.evidence.map((item, index) => (
                          <li key={index}>
                            <blockquote>{item.quote}</blockquote>
                            <p className="hint">
                              <span className="mono">{item.doc_id}</span>
                              {item.start !== null && item.start !== undefined ? ` · characters ${item.start}–${item.end}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!prominent && offers.length > 0 && compareButtons}
                  </Disclosure>
                )}
                {prominent && offers.length > 0 && compareButtons}
              </div>
            </li>
          );
        })}
      </ol>
      {loading && <p className="hint">Reading the rule records for their dates…</p>}
      {!loading && timeline.events.length === 0 && (
        <p className="hint">{blocked ? 'No dated rule records to show: the comparison is blocked.' : 'No rule record with a comparison result carries a date, so only the two compared dates are shown.'}</p>
      )}
      {timeline.unreadable.length > 0 && (
        <p className="hint">
          {timeline.unreadable.length} {timeline.unreadable.length === 1 ? 'date' : 'dates'} on the rule records could not be read and {timeline.unreadable.length === 1 ? 'is' : 'are'} not placed: {timeline.unreadable.map((item) => `${item.value} (${item.ruleId})`).join(', ')}.
        </p>
      )}
    </div>
  );
}
