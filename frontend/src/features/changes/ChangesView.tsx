import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../../api/errors';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { ChangeOutcome, ChangeRequest, RecordedStore } from '../../api/types';
import { Disclosure, ErrorNotice, Skeleton } from '../../components/ui';
import { formatDate, isIsoDay } from '../../lib/dates';
import { useSource } from '../../state/source';
import { ChangeResultView } from './ChangeResultView';

type Kind = 'dates' | 'scenario';
type State = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; outcome: ChangeOutcome } | { status: 'error'; error: ApiError };

/** Published scenario IDs named in docs/FRONTEND_HANDOFF.md. Their definitions live in the dataset, not here. */
const DOCUMENTED_SCENARIOS = ['T1', 'T2', 'T3', 'T4', 'T5'];

/** How each recorded dataset is introduced in the demo. They are separate stores and are never combined. */
const STORE_COPY: Record<RecordedStore, { title: string; note: string }> = {
  dev_portfolio: { title: 'Development portfolio', note: '14 fictional properties in a fictional state. Backend-evaluated; authored for layout development.' },
  synthetic: { title: 'Maple Harbor contract example', note: '3 fictional properties and one fictional ordinance from the backend’s own synthetic store.' },
  no_extracted_rules: { title: 'Published scenarios with no extracted rules', note: 'The backend’s answer before any rule is extracted: blocked, never an empty result.' },
};
const STORE_ORDER: RecordedStore[] = ['dev_portfolio', 'synthetic', 'no_extracted_rules'];

interface Props {
  lookupHref: (addressId: string, asOf: string) => string;
  disagreementHref: (addressId: string, asOf: string) => string;
}

export function ChangesView({ lookupHref, disagreementHref }: Props) {
  const source = useSource();
  const id = useId();
  const catalog = useMemo(() => source.catalog?.(), [source]);
  const [kind, setKind] = useState<Kind>('dates');
  const [before, setBefore] = useState(DEFAULT_AS_OF);
  const [after, setAfter] = useState('');
  const [scenario, setScenario] = useState<'actual' | 'if_enacted'>('actual');
  const [ruleIds, setRuleIds] = useState('');
  const [testId, setTestId] = useState('');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const resultRegion = useRef<HTMLDivElement | null>(null);
  /** Set when a comparison is started from inside a result, so the new result is brought into view. */
  const reveal = useRef(false);

  // Leaving the view must not let a late response touch it.
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (state.status !== 'ready' || !reveal.current) return;
    reveal.current = false;
    const region = resultRegion.current;
    if (!region) return;
    region.focus({ preventScroll: true });
    region.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state]);

  const errors = {
    before: kind === 'dates' && !isIsoDay(before) ? 'Enter the earlier date.' : null,
    after: kind === 'dates' && !isIsoDay(after) ? 'Enter the later date.' : kind === 'dates' && isIsoDay(before) && after < before ? 'The second date is earlier than the first.' : null,
    testId: kind === 'scenario' && !testId.trim() ? 'Enter a scenario ID.' : null,
  };
  const invalid = !!(errors.before || errors.after || errors.testId);

  const submit = async (request: ChangeRequest) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'loading' });
    try {
      const outcome = await source.changes(request, abort.signal);
      if (!abort.signal.aborted) setState({ status: 'ready', outcome });
    } catch (error) {
      if (abort.signal.aborted || isAbort(error)) return;
      setState({ status: 'error', error: toApiError(error, 'POST /changes') });
    }
  };

  /**
   * Editing the request while a comparison is still running withdraws that comparison: its
   * response, whenever it arrives, is for a question that is no longer being asked.
   */
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    if (state.status === 'loading') {
      controller.current?.abort();
      setState({ status: 'idle' });
    }
    setter(value);
  };

  const build = (): ChangeRequest => {
    if (kind === 'scenario') return { test_id: testId.trim() };
    const ids = ruleIds.split(/[\s,]+/).filter(Boolean);
    return { before, after, scenario, ...(ids.length ? { rule_ids: ids } : {}) };
  };

  const recorded = catalog?.changeRequests ?? [];
  const recordedGroups = STORE_ORDER.map((store) => ({ store, entries: recorded.filter((entry) => entry.store === store) })).filter((group) => group.entries.length > 0);
  const pillLabel = (request: ChangeRequest) =>
    request.test_id ? `Scenario ${request.test_id}` : `${formatDate(request.before)} → ${formatDate(request.after)}${request.scenario === 'if_enacted' ? ' · if enacted' : ''}`;

  const apply = (request: ChangeRequest) => {
    if (request.test_id) {
      setKind('scenario');
      setTestId(request.test_id);
    } else {
      setKind('dates');
      setBefore(request.before ?? '');
      setAfter(request.after ?? '');
      setScenario(request.scenario === 'if_enacted' ? 'if_enacted' : 'actual');
      setRuleIds('');
    }
    void submit(request);
  };

  /** From the timeline: compare two days under actual law, keeping the form in step. */
  const compareDates = (first: string, second: string) => {
    reveal.current = true;
    apply({ before: first, after: second, scenario: 'actual' });
  };

  return (
    <div className="changes">
      <header className="changes__intro">
        <p className="eyebrow">Changes</p>
        <h1 className="welcome__title">What changes for the sample properties between two dates.</h1>
        <p className="welcome__lead">
          Compare the rules on two dates, or run a published scenario, then follow each change from its source to the rule to the properties it reaches. Definite and uncertain impacts stay apart, and a blocked comparison is reported as blocked, never as “nothing changed”.
        </p>
      </header>

      <form
        className="changes__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!invalid) void submit(build());
        }}
      >
        <fieldset className="segmented" aria-label="Comparison type">
          <legend className="label">Compare by</legend>
          <div className="segmented__options">
            {[
              { value: 'dates' as const, label: 'Two dates' },
              { value: 'scenario' as const, label: 'Published scenario' },
            ].map((option) => (
              <label key={option.value} className="segmented__option">
                <input type="radio" name={`${id}-kind`} checked={kind === option.value} onChange={() => edit(setKind)(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'dates' ? (
          <div className="changes__fields">
            <div className="field">
              <label htmlFor={`${id}-before`} className="label">
                From date
              </label>
              <input id={`${id}-before`} type="date" className="input input--date" value={before} onChange={(event) => edit(setBefore)(event.target.value)} aria-invalid={touched && errors.before ? true : undefined} aria-describedby={touched && errors.before ? `${id}-before-error` : undefined} />
              {touched && errors.before && (
                <p id={`${id}-before-error`} className="field__error" role="alert">
                  {errors.before}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${id}-after`} className="label">
                To date
              </label>
              <input id={`${id}-after`} type="date" className="input input--date" value={after} onChange={(event) => edit(setAfter)(event.target.value)} aria-invalid={touched && errors.after ? true : undefined} aria-describedby={touched && errors.after ? `${id}-after-error` : undefined} />
              {touched && errors.after && (
                <p id={`${id}-after-error`} className="field__error" role="alert">
                  {errors.after}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${id}-scenario`} className="label">
                Treat pending rules as
              </label>
              <select id={`${id}-scenario`} className="input" value={scenario} onChange={(event) => edit(setScenario)(event.target.value === 'if_enacted' ? 'if_enacted' : 'actual')}>
                <option value="actual">Pending (actual law)</option>
                <option value="if_enacted">Enacted (hypothetical)</option>
              </select>
            </div>
            <div className="field field--wide">
              <label htmlFor={`${id}-rules`} className="label">
                Limit to rule IDs <span className="label__optional">optional</span>
              </label>
              <input id={`${id}-rules`} type="text" className="input" value={ruleIds} onChange={(event) => edit(setRuleIds)(event.target.value)} placeholder="All rules" autoComplete="off" spellCheck={false} aria-describedby={`${id}-rules-hint`} />
              <p id={`${id}-rules-hint`} className="hint">
                Separate IDs with commas. The first date starts at the contract default, {formatDate(DEFAULT_AS_OF)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="changes__fields">
            <div className="field">
              <label htmlFor={`${id}-test`} className="label">
                Scenario ID
              </label>
              <input id={`${id}-test`} type="text" className="input" list={`${id}-tests`} value={testId} onChange={(event) => edit(setTestId)(event.target.value)} placeholder="T1" autoComplete="off" spellCheck={false} aria-invalid={touched && errors.testId ? true : undefined} aria-describedby={`${id}-test-hint`} />
              <datalist id={`${id}-tests`}>
                {DOCUMENTED_SCENARIOS.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              {touched && errors.testId && (
                <p className="field__error" role="alert">
                  {errors.testId}
                </p>
              )}
            </div>
            <p id={`${id}-test-hint`} className="hint field--wide">
              A scenario uses its own published dates and setting; they cannot be overridden. T1–T5 are the documented IDs.
            </p>
          </div>
        )}

        <div className="changes__actions">
          <button type="submit" className="button button--primary" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Comparing…' : 'Compare'}
          </button>
        </div>

        {recordedGroups.length > 0 && (
          <div className="changes__recorded">
            <p className="label">Recorded in the synthetic demo</p>
            <p className="hint">The demo replays recorded backend output and cannot compute other comparisons. Each group is a separate fictional dataset.</p>
            {recordedGroups.map((group) => {
              // The first few entries are the ones a walkthrough starts from; the rest step across single dates.
              const lead = group.store === 'dev_portfolio' ? group.entries.slice(0, 3) : group.entries;
              const rest = group.store === 'dev_portfolio' ? group.entries.slice(3) : [];
              return (
                <div key={group.store} className="changes__group" data-store={group.store}>
                  <p className="changes__group-title">{STORE_COPY[group.store].title}</p>
                  <p className="hint">{STORE_COPY[group.store].note}</p>
                  <div className="changes__pills">
                    {lead.map((entry) => (
                      <button key={pillLabel(entry.request)} type="button" className="pill" onClick={() => apply(entry.request)}>
                        {pillLabel(entry.request)}
                      </button>
                    ))}
                  </div>
                  {rest.length > 0 && (
                    <Disclosure summary={`Single-date steps (${rest.length})`} className="changes__more">
                      <div className="changes__pills">
                        {rest.map((entry) => (
                          <button key={pillLabel(entry.request)} type="button" className="pill" onClick={() => apply(entry.request)}>
                            {pillLabel(entry.request)}
                          </button>
                        ))}
                      </div>
                    </Disclosure>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </form>

      <div className="changes__result" aria-live="polite" ref={resultRegion} tabIndex={-1}>
        {state.status === 'loading' && <Skeleton lines={5} label="Comparing dates" />}
        {state.status === 'error' && (
          <ErrorNotice
            error={state.error}
            context="Change comparison"
            actions={
              state.error.kind === 'not_recorded' || state.error.kind === 'invalid_request' || state.error.kind === 'not_found' ? undefined : (
                <button type="button" className="button button--small" onClick={() => void submit(build())}>
                  Try again
                </button>
              )
            }
          >
            {state.error.kind === 'not_found' && <p>The scenario or rule ID is not in the connected dataset.</p>}
            {state.error.kind === 'unavailable' && <p>No comparison can be computed until the dataset is ingested. This is a service state, not an empty result.</p>}
            {state.error.suggestions.length > 0 && <p>Recorded comparisons: {state.error.suggestions.join('; ')}.</p>}
          </ErrorNotice>
        )}
        {state.status === 'ready' && (
          <ChangeResultView key={JSON.stringify(state.outcome.request)} outcome={state.outcome} lookupHref={lookupHref} disagreementHref={disagreementHref} onCompare={compareDates} busy={false} />
        )}
      </div>
    </div>
  );
}
