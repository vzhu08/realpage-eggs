/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Navigator API. Default "/api/v1" (proxied by the dev/preview server). */
  readonly VITE_API_BASE_URL?: string;
  /** Starting data mode: "live" (default) or "demo". */
  readonly VITE_DATA_MODE?: string;
  /** Set to "1" for builds that cannot reach a backend (hosted preview): live mode is disabled with an explanation. */
  readonly VITE_DEMO_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
