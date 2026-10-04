import { useEffect, useRef } from 'react';
import type { LookupOutcome } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, Tag } from '../../components/ui';
import { diffOutcomes } from '../../lib/diff';
import type { RuleChange } from '../../lib/diff';
import { PROVENANCE_LABELS, formatValue, humanize, parseReason, resultMeta, sentence } from '../../lib/labels';

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
  // A result that moved, or one that is still unknown, is what the reader came for. Results that
  // were settled before and are the same now are kept, one disclosure down.
  const settled = (change: RuleChange) => change.kind === 'unchanged' && change.after?.result !== 'unknown';
  const lead = changes.filter((change) => !settled(change));
  const quiet = changes.filter(settled);
  const answers = outcome.query.answers;

  const item = (change: RuleChange) => {
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
  };

  return (
    <section className="changed" aria-labelledby="changed-heading" aria-live="polite">
      <h2 id="changed-heading" className="changed__title" ref={heading} tabIndex={-1}>
        {moved > 0 ? 'Re-evaluated with your answers' : 'Re-evaluated: nothing changed'}
      </h2>
      {answers.length > 0 && (
        <p className="changed__answers">
          <span className="changed__answers-label">Evaluated with</span>
          {answers.map((answer) => (
            <span key={answer.field} className="changed__answer">
              {sentence(answer.field)}: <strong>{answer.value === null ? 'I don’t know' : formatValue(answer.value)}</strong> · {PROVENANCE_LABELS[answer.provenance ?? 'user_provided'] ?? answer.provenance}
            </span>
          ))}
        </p>
      )}
      <ul className="changed__list">{lead.map(item)}</ul>
      {quiet.length > 0 && (
        <Disclosure summary={`${quiet.length} other ${quiet.length === 1 ? 'result' : 'results'} did not change`} className="changed__quiet">
          <ul className="changed__list">{quiet.map(item)}</ul>
        </Disclosure>
      )}
    </section>
  );
}
