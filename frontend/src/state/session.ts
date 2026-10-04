/**
 * The lookup session: one property, one explicit as-of date, and the answers accumulated for
 * it. Answers are request-local — they live only in this state and are resent in full with
 * every request (docs/ASSIST_CONTRACT.md). Changing the property, date or fixture clears them.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { type ApiError, isAbort, toApiError } from '../api/errors';
import type { AddressItem, Answer, AnswerValue, DataSource, FactDefinition, FixtureCaseSummary, LookupOutcome } from '../api/types';

export interface AnswerEvent {
  seq: number;
  field: string;
  action: 'answered' | 'changed' | 'marked_unknown' | 'removed';
  value: AnswerValue;
  previous?: AnswerValue;
  provenance: Answer['provenance'];
}

export interface SessionState {
  selection: AddressItem | null;
  fixtureCase: FixtureCaseSummary | null;
  asOf: string;
  answers: Answer[];
  history: AnswerEvent[];
  /** Fact definitions seen in any question plan this session, so answers stay editable. */
  definitions: Record<string, FactDefinition>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  outcome: LookupOutcome | null;
  /** The result before the latest answer change, for showing what moved. */
  previous: LookupOutcome | null;
  error: ApiError | null;
  /** A failed re-evaluation after an answer. The earlier result stays on screen, labeled as such. */
  answerError: ApiError | null;
  /** True when property/date changed since the shown result was requested. */
  dirty: boolean;
  /** True while an answer change is being re-evaluated; the earlier result stays visible. */
  reevaluating: boolean;
  runs: number;
}

type Action =
  | { type: 'select'; item: AddressItem; fixtureCase: FixtureCaseSummary | null; asOf?: string }
  | { type: 'clear' }
  | { type: 'asOf'; value: string }
  | { type: 'answers'; answers: Answer[]; event: Omit<AnswerEvent, 'seq'> }
  | { type: 'start'; keepPrevious: boolean }
  | { type: 'success'; outcome: LookupOutcome }
  | { type: 'failure'; error: ApiError; keepOutcome: boolean };

export const initialSession = (asOf: string): SessionState => ({
  selection: null,
  fixtureCase: null,
  asOf,
  answers: [],
  history: [],
  definitions: {},
  status: 'idle',
  outcome: null,
  previous: null,
  error: null,
  answerError: null,
  dirty: false,
  reevaluating: false,
  runs: 0,
});

export function sessionReducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'select':
      return { ...initialSession(action.asOf ?? state.asOf), selection: action.item, fixtureCase: action.fixtureCase, dirty: true };
    case 'clear':
      return initialSession(state.asOf);
    case 'asOf':
      // A new date is a new question: answers given for another date's plan do not carry over,
      // and a fixture case is pinned to its own recorded date.
      if (action.value === state.asOf) return state;
      return {
        ...state, asOf: action.value, fixtureCase: null, answers: [], history: [], definitions: {},
        status: state.outcome ? 'ready' : 'idle', error: null, answerError: null,
        previous: null, dirty: true, reevaluating: false,
      };
    case 'answers':
      return { ...state, answers: action.answers, history: [...state.history, { ...action.event, seq: state.history.length + 1 }] };
    case 'start':
      return { ...state, status: 'loading', error: null, answerError: null, reevaluating: action.keepPrevious && !!state.outcome, previous: action.keepPrevious ? state.outcome : null };
    case 'success': {
      const definitions = { ...state.definitions };
      for (const question of action.outcome.assist?.question_plan.questions ?? []) definitions[question.fact.field] = question.fact;
      return { ...state, status: 'ready', outcome: action.outcome, error: null, dirty: false, reevaluating: false, definitions, runs: state.runs + 1 };
    }
    case 'failure':
      // A rejected answer must not erase the result it was meant to refine.
      if (action.keepOutcome && state.outcome) return { ...state, status: 'ready', answerError: action.error, previous: null, reevaluating: false };
      return { ...state, status: 'error', error: action.error, outcome: null, previous: null, dirty: false, reevaluating: false };
  }
}

/** Replace or add the answer for one field; `undefined` removes it. */
export function withAnswer(answers: Answer[], field: string, next: Answer | undefined): Answer[] {
  const rest = answers.filter((answer) => answer.field !== field);
  return next ? [...rest, next] : rest;
}

export function useSession(source: DataSource, defaultAsOf: string) {
  const [state, dispatch] = useReducer(sessionReducer, defaultAsOf, initialSession);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => () => controller.current?.abort(), []);

  const execute = useCallback(
    async (overrides: { answers?: Answer[]; keepPrevious: boolean; item?: AddressItem; fixtureCase?: FixtureCaseSummary | null; asOf?: string }) => {
      const current = latest.current;
      const item = overrides.item ?? current.selection;
      if (!item) return;
      const fixtureCase = overrides.fixtureCase === undefined ? current.fixtureCase : overrides.fixtureCase;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      dispatch({ type: 'start', keepPrevious: overrides.keepPrevious });
      try {
        const outcome = await source.lookup(
          { address_id: item.property.address_id, as_of: overrides.asOf ?? current.asOf, answers: overrides.answers ?? current.answers, fixtureCase: fixtureCase?.id },
          abort.signal,
        );
        if (!abort.signal.aborted) dispatch({ type: 'success', outcome });
      } catch (error) {
        if (abort.signal.aborted || isAbort(error)) return;
        dispatch({ type: 'failure', error: toApiError(error, 'lookup'), keepOutcome: overrides.keepPrevious });
      }
    },
    [source],
  );

  const select = useCallback((item: AddressItem) => {
    // Invalidate the old completion even when the transport cannot stop its response.
    controller.current?.abort();
    dispatch({ type: 'select', item, fixtureCase: null });
  }, []);
  const selectCase = useCallback(
    (item: AddressItem, fixtureCase: FixtureCaseSummary) => {
      dispatch({ type: 'select', item, fixtureCase, asOf: fixtureCase.as_of });
      void execute({ keepPrevious: false, item, fixtureCase, asOf: fixtureCase.as_of, answers: [] });
    },
    [execute],
  );
  const clear = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: 'clear' });
  }, []);
  const setAsOf = useCallback((value: string) => {
    if (value === latest.current.asOf) return;
    controller.current?.abort();
    dispatch({ type: 'asOf', value });
  }, []);
  const run = useCallback(() => void execute({ keepPrevious: false }), [execute]);

  /** Record an answer (or an explicit unknown) and re-evaluate with every accumulated answer. */
  const answer = useCallback(
    (field: string, value: AnswerValue, provenance: Answer['provenance'] = 'user_provided') => {
      const current = latest.current;
      const existing = current.answers.find((item) => item.field === field);
      const answers = withAnswer(current.answers, field, { field, value, provenance });
      dispatch({
        type: 'answers',
        answers,
        event: { field, value, previous: existing?.value, provenance, action: value === null ? 'marked_unknown' : existing ? 'changed' : 'answered' },
      });
      void execute({ answers, keepPrevious: true });
    },
    [execute],
  );

  const removeAnswer = useCallback(
    (field: string) => {
      const current = latest.current;
      const existing = current.answers.find((item) => item.field === field);
      if (!existing) return;
      const answers = withAnswer(current.answers, field, undefined);
      dispatch({ type: 'answers', answers, event: { field, value: null, previous: existing.value, provenance: existing.provenance, action: 'removed' } });
      void execute({ answers, keepPrevious: true });
    },
    [execute],
  );

  return { state, select, selectCase, clear, setAsOf, run, answer, removeAnswer };
}

export type Session = ReturnType<typeof useSession>;
