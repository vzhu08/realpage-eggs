/**
 * Runtime configuration. The data mode is always an explicit choice: a URL parameter, the
 * person's saved choice, or the build default. Nothing here switches modes after a failure.
 */
import type { DataMode } from './api/types';

// `import.meta.env` is supplied by Vite; unit tests run the same modules without it.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

/** Builds that cannot reach a backend at all (the hosted preview). */
export const DEMO_ONLY = env.VITE_DEMO_ONLY === '1';
export const DEFAULT_API_BASE = env.VITE_API_BASE_URL || '/api/v1';
const BUILD_MODE: DataMode = env.VITE_DATA_MODE === 'demo' || DEMO_ONLY ? 'demo' : 'live';

const MODE_KEY = 'navigator.dataMode';
const BASE_KEY = 'navigator.apiBase';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private windows, embedded previews); the choice then lasts for this page only.
  }
}

const asMode = (value: string | null | undefined): DataMode | null => (value === 'live' || value === 'demo' ? value : null);

export function initialMode(urlMode: string | null | undefined): DataMode {
  if (DEMO_ONLY) return 'demo';
  return asMode(urlMode) ?? asMode(read(MODE_KEY)) ?? BUILD_MODE;
}

export const saveMode = (mode: DataMode) => write(MODE_KEY, mode);
export const initialApiBase = () => read(BASE_KEY) || DEFAULT_API_BASE;
export const saveApiBase = (base: string) => write(BASE_KEY, base === DEFAULT_API_BASE ? null : base);
