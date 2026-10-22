import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError };

/**
 * Loads on mount and whenever `deps` (primitives only) change; stale responses are ignored;
 * `reload` retries. While a new key is loading the state is 'loading' (never a stale result).
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: (string | number)[]) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  const [settled, setSettled] = useState<{ key: string; state: AsyncState<T> } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    loadRef
      .current(ctrl.signal)
      .then((data) => !ctrl.signal.aborted && setSettled({ key, state: { status: 'success', data } }))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        const error = e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Unknown');
        setSettled({ key, state: { status: 'error', error } });
      });
    return () => ctrl.abort();
  }, [key]);

  const state: AsyncState<T> = settled && settled.key === key ? settled.state : { status: 'loading' };
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
