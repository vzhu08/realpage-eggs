/**
 * Minimal hash routing: `#/lookup?mode=demo&case=decisive_question`. Hash routes need no
 * server rewrite rules, so the same build works from the dev server, a static host or a file.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type View = 'lookup' | 'changes';

export interface Route {
  view: View;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '');
  const [path = '', query = ''] = cleaned.split('?');
  return { view: path === 'changes' ? 'changes' : 'lookup', params: new URLSearchParams(query) };
}

export function buildHash(view: View, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return `#/${view}${text ? `?${text}` : ''}`;
}

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};
const snapshot = () => window.location.hash;

export function useRoute(): { route: Route; go: (view: View, params?: Record<string, string | null | undefined>) => void; replaceParams: (params: Record<string, string | null | undefined>) => void } {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  const route = parseHash(hash);
  const go = useCallback((view: View, params: Record<string, string | null | undefined> = {}) => {
    window.location.hash = buildHash(view, params);
  }, []);
  /** Keep the URL shareable without adding history entries for every keystroke. */
  const replaceParams = useCallback((params: Record<string, string | null | undefined>) => {
    const current = parseHash(window.location.hash);
    const next = buildHash(current.view, params);
    if (next === window.location.hash) return;
    try {
      window.history.replaceState(null, '', next);
    } catch {
      // Some embedded frames refuse history changes; the URL then simply stays as it was.
    }
  }, []);
  return { route, go, replaceParams };
}
