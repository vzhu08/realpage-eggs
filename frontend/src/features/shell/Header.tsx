import { useEffect, useId, useRef, useState } from 'react';
import type { ApiError } from '../../api/errors';
import { API_TITLE, CONTRACT_DISCLAIMER } from '../../api/generated/meta';
import type { DataMode, DemoCatalog, HealthResponse } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Facts } from '../../components/ui';
import { DEFAULT_API_BASE, DEMO_ONLY } from '../../config';
import { sentence } from '../../lib/labels';
import type { View } from '../../state/route';

export interface HealthState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: HealthResponse | null;
  error: ApiError | null;
  reload: () => void;
}

interface Props {
  view: View;
  hrefFor: (view: View) => string;
  mode: DataMode;
  onMode: (mode: DataMode) => void;
  health: HealthState;
  apiBase: string;
  onApiBase: (base: string) => void;
  catalog: DemoCatalog | undefined;
  /** Clears the property, answers and results in every view and returns to the start. */
  onStartOver: () => void;
}

export function serviceSummary(mode: DataMode, health: HealthState): { label: string; tone: 'ok' | 'warn' | 'bad' | 'idle' } {
  if (mode === 'demo') return { label: 'Replaying recorded data', tone: 'warn' };
  if (health.status === 'loading' || health.status === 'idle') return { label: 'Checking the API…', tone: 'idle' };
  if (health.status === 'error' || !health.data) return { label: 'API not reachable', tone: 'bad' };
  if (health.data.dataset_readiness === 'available') return { label: 'Dataset ready', tone: 'ok' };
  if (health.data.dataset_readiness === 'partial') return { label: 'Partial dataset', tone: 'warn' };
  return { label: 'No dataset loaded', tone: 'bad' };
}

export function Header({ view, hrefFor, mode, onMode, health, apiBase, onApiBase, catalog, onStartOver }: Props) {
  const summary = serviceSummary(mode, health);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapper.current && event.target instanceof Node && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        wrapper.current?.querySelector<HTMLButtonElement>('.status-button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="header">
      <div className="header__inner">
        <a className="brand" href={hrefFor('lookup')}>
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <span className="brand__name">{API_TITLE}</span>
        </a>

        <nav className="nav" aria-label="Views">
          <a href={hrefFor('lookup')} aria-current={view === 'lookup' ? 'page' : undefined}>
            Property lookup
          </a>
          <a href={hrefFor('changes')} aria-current={view === 'changes' ? 'page' : undefined}>
            Portfolio changes
          </a>
          <a href={hrefFor('disagreements')} aria-current={view === 'disagreements' ? 'page' : undefined}>
            Compare sources
          </a>
        </nav>

        <div className="header__tools">
          <button type="button" className="button button--small button--quiet header__restart" onClick={onStartOver}>
            <Icon name="restart" />
            {mode === 'demo' ? 'Restart demo' : 'Start over'}
          </button>
          <fieldset className="mode" aria-label="Data source">
            <legend className="sr-only">Data source</legend>
            <label className="mode__option">
              <input type="radio" name="data-mode" checked={mode === 'live'} disabled={DEMO_ONLY} onChange={() => onMode('live')} />
              <span>Live API</span>
            </label>
            <label className="mode__option">
              <input type="radio" name="data-mode" checked={mode === 'demo'} onChange={() => onMode('demo')} />
              <span>Synthetic demo</span>
            </label>
          </fieldset>

          <div className="status" ref={wrapper}>
            <button type="button" className={`status-button status-button--${summary.tone}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
              <span className="status-button__dot" aria-hidden="true" />
              <span>{summary.label}</span>
              <Icon name="chevron" size={14} className="status-button__chevron" />
            </button>
            {open && (
              <div className="status-panel" id={panelId} role="group" aria-label="Data source details">
                {mode === 'demo' ? <DemoDetails catalog={catalog} /> : <LiveDetails health={health} apiBase={apiBase} onApiBase={onApiBase} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="header__disclaimer">{health.data?.disclaimer ?? CONTRACT_DISCLAIMER}</p>
    </header>
  );
}

function DemoDetails({ catalog }: { catalog: DemoCatalog | undefined }) {
  const manifest = catalog?.manifest ?? {};
  const commit = typeof manifest.backend_commit === 'string' ? manifest.backend_commit.slice(0, 10) : 'not recorded';
  return (
    <>
      <p className="status-panel__title">Synthetic demo</p>
      <p className="status-panel__text">Responses are replayed from files in the repository. Nothing is evaluated in the browser and no service is contacted.</p>
      <Facts
        dense
        rows={[
          { label: 'Contract examples', value: 'contracts/examples, contracts/research_examples' },
          { label: 'Recorded output', value: typeof manifest.generated_by === 'string' ? manifest.generated_by : 'frontend/scripts/record_demo.py' },
          { label: 'Backend commit', value: <span className="mono">{commit}</span> },
          { label: 'Question-flow fixtures', value: String(catalog?.cases.length ?? 0) },
          {
            label: 'Development portfolio',
            value: `${catalog?.development.properties.length ?? 0} fictional properties`,
            note: 'Authored by the UX lane for layout; rules and results come from the backend. See frontend/scripts/dev_portfolio.py.',
          },
        ]}
      />
      {DEMO_ONLY && <p className="status-panel__text">This hosted preview cannot reach a backend, so the live API mode is turned off here. Run the app locally to use it.</p>}
    </>
  );
}

function LiveDetails({ health, apiBase, onApiBase }: { health: HealthState; apiBase: string; onApiBase: (base: string) => void }) {
  const [draft, setDraft] = useState(apiBase);
  const inputId = useId();
  const data = health.data;
  return (
    <>
      <p className="status-panel__title">Live API</p>
      {health.status === 'error' && health.error && (
        <p className="status-panel__text status-panel__text--bad">
          {health.error.message} <span className="mono">({health.error.endpoint})</span>
        </p>
      )}
      {data && (
        <Facts
          dense
          rows={[
            { label: 'Dataset', value: sentence(data.dataset_readiness) },
            { label: 'Rules extracted', value: String(data.rules) },
            { label: 'Sources', value: String(data.sources) },
            { label: 'Sample properties', value: String(data.addresses) },
            { label: 'Municipalities resolved', value: `${data.resolved_municipalities} of ${data.addresses}` },
            { label: 'Last extraction', value: data.last_extraction_outcome ? sentence(data.last_extraction_outcome) : 'None recorded' },
            { label: 'Backend version', value: data.version },
          ]}
        />
      )}
      <form
        className="status-panel__form"
        onSubmit={(event) => {
          event.preventDefault();
          onApiBase(draft.trim() || DEFAULT_API_BASE);
        }}
      >
        <label htmlFor={inputId} className="label">
          API base URL
        </label>
        <input id={inputId} className="input" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} autoComplete="off" />
        <p className="hint">Default {DEFAULT_API_BASE} is proxied to the backend by the dev server.</p>
        <div className="status-panel__actions">
          <button type="submit" className="button button--small">
            Connect
          </button>
          <button type="button" className="button button--small button--quiet" onClick={health.reload}>
            Check again
          </button>
        </div>
      </form>
    </>
  );
}
