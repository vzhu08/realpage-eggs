import { useEffect, useRef } from 'react';
import type { LookupOutcome } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Tag } from '../../components/ui';
import { diffOutcomes } from '../../lib/diff';
import { humanize, parseReason, resultMeta } from '../../lib/labels';

/** After a re-evaluation: exactly which results moved, and which did not. */
export function WhatChanged({ previous, outcome }: { previous: LookupOutcome; outcome: LookupOutcome }) {
  const changes = diffOutcomes(previous, outcome);
  const heading = useRef<HTMLHeadingElement | null>(null);
  // The answer was given further down the page; bring the outcome of answering it into view.
  useEffect(() => {
    const element = heading.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [outcome]);
  if (!changes.length) return null;
  const moved = changes.filter((change) => change.kind !== 'unchanged').length;
  return (
    <section className="changed" aria-labelledby="changed-heading" aria-live="polite">
      <h2 id="changed-heading" className="changed__title" ref={heading} tabIndex={-1}>
        {moved > 0 ? 'Re-evaluated with your answers' : 'Re-evaluated: nothing changed'}
      </h2>
      <ul className="changed__list">
        {changes.map((change) => {
          const before = change.before ? resultMeta(change.before.result) : null;
          const after = change.after ? resultMeta(change.after.result) : change.recordedAfter ? resultMeta(change.recordedAfter.result) : null;
          const still = change.after?.missing_facts ?? [];
          const sameResult = !!change.before && !!change.after && change.before.result === change.after.result;
          // Why a result is still open after the answer: the evaluator's own reasons other than a missing fact.
          const open = change.after && change.after.result === 'unknown' ? [...new Set((change.after.uncertainty_reasons ?? []).map(parseReason).filter((reason) => reason.kind !== 'missing_property_fact').map((reason) => `${reason.label}: ${reason.message}`))] : [];
          return (
            <li key={change.ruleId} className="changed__item" data-change={change.kind}>
              <p className="changed__rule">{change.title}</p>
              <p className="changed__flow">
                {before ? <Tag tone={before.tone}>{before.label}</Tag> : <Tag tone="muted">Not listed</Tag>}
                <Icon name="arrow" className="changed__arrow" />
                <span className="sr-only">became</span>
                {after ? <Tag tone={after.tone}>{after.label}</Tag> : <Tag tone="muted">No longer listed</Tag>}
                {sameResult && <span className="changed__same">{change.kind === 'unchanged' ? 'No change' : 'Result unchanged; what it needs has changed'}</span>}
              </p>
              {change.after && still.length > 0 && <p className="changed__note changed__note--needs">Still needs: {still.map(humanize).join(', ')}.</p>}
              {open.length > 0 && (
                <p className="changed__note changed__note--needs" data-still-unknown>
                  Still unknown: {open.join('; ')}.
                </p>
              )}
              {change.kind === 'no_longer_listed' && (
                <p className="changed__note">
                  {change.recordedAfter
                    ? change.recordedAfter.explanation
                    : 'The service no longer returns this rule for these facts. Lookup results list only rules that apply, are unknown, pending, not yet effective or superseded.'}
                </p>
              )}
              {change.kind === 'changed' && change.after && <p className="changed__note">{change.after.explanation}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
