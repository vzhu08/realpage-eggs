import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../api/errors';

export type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiError };

/**
 * Runs `load` whenever `key` changes, aborting the previous run so a slow response can
 * never overwrite a newer one. A null key means "nothing to load".
 */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, endpoint: string): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    if (key === null) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    loader.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setState({ status: 'error', data: null, error: toApiError(error, endpoint) });
      },
    );
    return () => controller.abort();
  }, [key, attempt, endpoint]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
