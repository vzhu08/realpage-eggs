import { useId, useMemo, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../../api/errors';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { ChangeOutcome, ChangeRequest } from '../../api/types';
import { ErrorNotice, Skeleton } from '../../components/ui';
import { formatDate, isIsoDay } from '../../lib/dates';
import { useSource } from '../../state/source';
import { ChangeResultView } from './ChangeResultView';

type Kind = 'dates' | 'scenario';
type State = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; outcome: ChangeOutcome } | { status: 'error'; error: ApiError };

/** Published scenario IDs named in docs/FRONTEND_HANDOFF.md. Their definitions live in the dataset, not here. */
const DOCUMENTED_SCENARIOS = ['T1', 'T2', 'T3', 'T4', 'T5'];

export function ChangesView({ lookupHref }: { lookupHref: (addressId: string, asOf: string) => string }) {
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

  const build = (): ChangeRequest => {
    if (kind === 'scenario') return { test_id: testId.trim() };
    const ids = ruleIds.split(/[\s,]+/).filter(Boolean);
    return { before, after, scenario, ...(ids.length ? { rule_ids: ids } : {}) };
  };

  const recorded = catalog?.changeRequests ?? [];
  const recordedDates = recorded.filter((entry) => !entry.request.test_id);
  const recordedScenarios = recorded.filter((entry) => entry.request.test_id);

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

  return (
    <div className="changes">
      <header className="changes__intro">
        <p className="eyebrow">Changes</p>
        <h1 className="welcome__title">What changes for the sample properties between two dates.</h1>
        <p className="welcome__lead">
          Compare the rules on two dates, or run a published scenario. Properties that are definitely affected are kept apart from those where the effect is uncertain. A blocked comparison is reported as blocked, never as “nothing changed”.
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
                <input type="radio" name={`${id}-kind`} checked={kind === option.value} onChange={() => setKind(option.value)} />
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
              <input id={`${id}-before`} type="date" className="input input--date" value={before} onChange={(event) => setBefore(event.target.value)} aria-invalid={touched && errors.before ? true : undefined} aria-describedby={touched && errors.before ? `${id}-before-error` : undefined} />
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
              <input id={`${id}-after`} type="date" className="input input--date" value={after} onChange={(event) => setAfter(event.target.value)} aria-invalid={touched && errors.after ? true : undefined} aria-describedby={touched && errors.after ? `${id}-after-error` : undefined} />
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
              <select id={`${id}-scenario`} className="input" value={scenario} onChange={(event) => setScenario(event.target.value === 'if_enacted' ? 'if_enacted' : 'actual')}>
                <option value="actual">Pending (actual law)</option>
                <option value="if_enacted">Enacted (hypothetical)</option>
              </select>
            </div>
            <div className="field field--wide">
              <label htmlFor={`${id}-rules`} className="label">
                Limit to rule IDs <span className="label__optional">optional</span>
              </label>
              <input id={`${id}-rules`} type="text" className="input" value={ruleIds} onChange={(event) => setRuleIds(event.target.value)} placeholder="All rules" autoComplete="off" spellCheck={false} aria-describedby={`${id}-rules-hint`} />
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
              <input id={`${id}-test`} type="text" className="input" list={`${id}-tests`} value={testId} onChange={(event) => setTestId(event.target.value)} placeholder="T1" autoComplete="off" spellCheck={false} aria-invalid={touched && errors.testId ? true : undefined} aria-describedby={`${id}-test-hint`} />
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

        {recorded.length > 0 && (
          <div className="changes__recorded">
            <p className="label">Recorded in the synthetic demo</p>
            <div className="changes__pills">
              {recordedDates.map((entry) => (
                <button key={`${entry.request.before}-${entry.request.after}-${entry.request.scenario}`} type="button" className="pill" onClick={() => apply(entry.request)}>
                  {formatDate(entry.request.before)} → {formatDate(entry.request.after)}
                  {entry.request.scenario === 'if_enacted' ? ' · if enacted' : ''}
                </button>
              ))}
              {recordedScenarios.map((entry) => (
                <button key={entry.request.test_id ?? 'scenario'} type="button" className="pill" onClick={() => apply(entry.request)}>
                  Scenario {entry.request.test_id}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      <div className="changes__result" aria-live="polite">
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
        {state.status === 'ready' && <ChangeResultView outcome={state.outcome} lookupHref={lookupHref} />}
      </div>
    </div>
  );
}
