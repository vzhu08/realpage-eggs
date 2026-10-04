import { useState } from 'react';
import type { ApiError } from '../../api/errors';
import type { Evidence, Rule, SourceDocument } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Chip, ErrorNotice, Facts, Spinner } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { humanize, sentence } from '../../lib/labels';
import { checkQuote, excerptAround, shortHash } from '../../lib/text';

export type LoadedSource = { status: 'loading' } | { status: 'ready'; doc: SourceDocument } | { status: 'error'; error: ApiError };

interface Props {
  rule: Rule;
  evidence: Evidence[];
  /** Source metadata from the lookup response (text is omitted there to keep payloads small). */
  sources: SourceDocument[];
  /** Full source documents, fetched on demand for surrounding context. */
  loaded: Record<string, LoadedSource>;
  onRetry: () => void;
}

export function SourceTab({ rule, evidence, sources, loaded, onRetry }: Props) {
  const docIds = [...new Set(evidence.map((item) => item.doc_id))];
  return (
    <div className="evidence-tab">
      <p className="evidence-tab__lead">Exact text quoted from the source snapshot, with where it sits in the document. Citation: {rule.citation}.</p>
      <ol className="quotes">
        {evidence.map((item, index) => (
          <QuoteBlock key={`${item.doc_id}-${index}`} item={item} loaded={loaded[item.doc_id]} onRetry={onRetry} />
        ))}
      </ol>
      {docIds.map((docId) => {
        const state = loaded[docId];
        const doc = state?.status === 'ready' ? state.doc : sources.find((source) => source.doc_id === docId);
        return <SourceRecord key={docId} docId={docId} doc={doc} fallbackUrl={docId === rule.source_doc_id ? rule.source_url : undefined} />;
      })}
    </div>
  );
}

function QuoteBlock({ item, loaded, onRetry }: { item: Evidence; loaded: LoadedSource | undefined; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const hasOffsets = item.start !== null && item.start !== undefined && item.end !== null && item.end !== undefined;
  const text = loaded?.status === 'ready' ? loaded.doc.text : undefined;
  const check = checkQuote(text, item.quote, item.start, item.end);
  return (
    <li className="quote">
      <figure>
        <blockquote className="quote__text">
          <Icon name="quote" className="quote__mark" size={18} />
          <p>{item.quote}</p>
        </blockquote>
        <figcaption className="quote__caption">
          <p className="quote__supports">
            <span className="quote__supports-label">Cited for</span>
            {item.supports.map((support) => (
              <Chip key={support}>{humanize(support)}</Chip>
            ))}
          </p>
          <p className="quote__anchor">
            <span className="mono">{item.doc_id}</span>
            {hasOffsets ? (
              <>
                {' · characters '}
                <span className="num">
                  {item.start}–{item.end}
                </span>
              </>
            ) : (
              ' · no character offsets recorded'
            )}
          </p>
          <button type="button" className="button button--small button--quiet" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide surrounding text' : 'Show surrounding text'}
          </button>
        </figcaption>
      </figure>
      {open && (
        <div className="quote__context">
          {(!loaded || loaded.status === 'loading') && <Spinner label="Loading the source text" />}
          {loaded?.status === 'error' && (
            <ErrorNotice
              error={loaded.error}
              context="Source text"
              actions={
                <button type="button" className="button button--small" onClick={onRetry}>
                  Try again
                </button>
              }
            >
              <p>The quote above is still the exact text recorded with the rule; only the surrounding context is unavailable.</p>
            </ErrorNotice>
          )}
          {loaded?.status === 'ready' && !text && <p className="hint">This source has no captured text ({humanize(loaded.doc.capture_status)}), so surrounding context cannot be shown. That is a coverage gap, not evidence about the law.</p>}
          {loaded?.status === 'ready' && text && check.state === 'no_offsets' && <p className="hint">No character offsets are recorded for this quote, so its position in the source cannot be shown.</p>}
          {loaded?.status === 'ready' && text && check.state === 'mismatch' && (
            <p className="field__error">The text at the recorded offsets differs from the quote. The surrounding text is not shown, to avoid presenting the wrong passage.</p>
          )}
          {loaded?.status === 'ready' && text && check.state === 'match' && <Context text={text} start={check.start} end={check.end} />}
        </div>
      )}
    </li>
  );
}

function Context({ text, start, end }: { text: string; start: number; end: number }) {
  const excerpt = excerptAround(text, start, end);
  return (
    <div className="passage" role="group" aria-label="Surrounding source text">
      <p className="passage__text">
        {excerpt.clippedStart && <span className="passage__clip">… </span>}
        {excerpt.before}
        <mark>{excerpt.match}</mark>
        {excerpt.after}
        {excerpt.clippedEnd && <span className="passage__clip"> …</span>}
      </p>
      <p className="hint">Original source text, unchanged. The highlighted span is the quote at its recorded offsets.</p>
    </div>
  );
}

function SourceRecord({ docId, doc, fallbackUrl }: { docId: string; doc: SourceDocument | undefined; fallbackUrl?: string }) {
  const url = doc?.url ?? fallbackUrl;
  const synthetic = doc?.capture_status === 'synthetic';
  const issues = doc?.issues ?? [];
  return (
    <section className="record" aria-label={`Source document ${docId}`}>
      <h4 className="record__title">
        Source document <span className="mono">{docId}</span>
      </h4>
      <Facts
        dense
        rows={[
          {
            label: 'Original source',
            value: url ? (
              synthetic ? (
                <span className="mono break">{url}</span>
              ) : (
                <a className="link break" href={url} target="_blank" rel="noreferrer noopener">
                  {url}
                  <Icon name="external" size={14} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )
            ) : (
              'Not recorded'
            ),
            note: synthetic ? 'Placeholder address for a synthetic document. It does not resolve.' : undefined,
          },
          { label: 'Retrieved', value: formatTimestamp(doc?.retrieved_at) },
          ...(doc
            ? [
                { label: 'Capture', value: sentence(doc.capture_status) },
                { label: 'Authority', value: sentence(doc.authority) },
                { label: 'Source type', value: sentence(doc.source_type ?? 'unclassified') },
                { label: 'Jurisdictions', value: doc.jurisdictions.join('; ') || 'Not recorded' },
                { label: 'Snapshot hash', value: <span className="mono" title={doc.sha256}>{shortHash(doc.sha256)}</span>, note: 'SHA-256 of the captured text' },
                {
                  label: 'Declared hash',
                  value: doc.manifest_sha256 ? <span className="mono" title={doc.manifest_sha256}>{shortHash(doc.manifest_sha256)}</span> : 'None declared',
                  note: doc.manifest_sha256 ? (doc.manifest_sha256 === doc.sha256 ? 'Equal to the snapshot hash' : 'Differs from the snapshot hash') : undefined,
                },
                ...(doc.duplicate_of ? [{ label: 'Duplicate of', value: <span className="mono">{doc.duplicate_of}</span> }] : []),
              ]
            : []),
        ]}
      />
      {issues.length > 0 && (
        <div className="record__issues">
          <p className="record__issues-label">Capture issues</p>
          <ul className="plain-list plain-list--tight">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
