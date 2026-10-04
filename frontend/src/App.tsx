import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveSource } from './api/live';
import type { ChangeRequest, DataMode, DataSource, DemoExample } from './api/types';
import { initialApiBase, initialMode, saveApiBase, saveMode } from './config';
import { ChangesView } from './features/changes/ChangesView';
import { DisagreementsView } from './features/disagreements/DisagreementsView';
import { LookupView } from './features/lookup/LookupView';
import { ServiceNotice, SyntheticBanner } from './features/shell/Banners';
import { Header } from './features/shell/Header';
import { Skeleton } from './components/ui';
import { type View, buildHash, useRoute } from './state/route';
import { SourceProvider } from './state/source';
import { useAsync } from './state/useAsync';

export function App() {
  const { route, go, replaceParams } = useRoute();
  const urlMode = route.params.get('mode');
  const [mode, setModeState] = useState<DataMode>(() => initialMode(urlMode));
  const [apiBase, setApiBaseState] = useState(initialApiBase);
  /** Bumped by "Start over": every view is rebuilt, so no property, answer or result carries over. */
  const [epoch, setEpoch] = useState(0);

  // A mode named in the URL wins, so shared links open in the mode they were made in.
  useEffect(() => {
    const next = initialMode(urlMode);
    if (urlMode && next !== mode) setModeState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMode]);

  const live = useMemo<DataSource>(() => new LiveSource(apiBase), [apiBase]);
  // The demo adapter and its fixtures load only when the demo is opened, so the live app never ships them up front.
  const [demo, setDemo] = useState<DataSource | null>(null);
  useEffect(() => {
    if (mode !== 'demo' || demo) return;
    let cancelled = false;
    void import('./api/demo').then((module) => {
      if (!cancelled) setDemo(new module.DemoSource());
    });
    return () => {
      cancelled = true;
    };
  }, [mode, demo]);
  const source = mode === 'demo' ? demo : live;

  const health = useAsync(mode === 'live' ? `health:${apiBase}` : null, (signal) => live.health(signal), 'GET /health');
  const catalog = useMemo(() => source?.catalog?.(), [source]);

  const setMode = useCallback(
    (next: DataMode) => {
      saveMode(next);
      setModeState(next);
      go(route.view, { mode: next });
    },
    [go, route.view],
  );
  const setApiBase = useCallback((base: string) => {
    saveApiBase(base);
    setApiBaseState(base);
  }, []);

  const startOver = useCallback(() => {
    setEpoch((value) => value + 1);
    go('lookup', { mode });
    window.scrollTo({ top: 0 });
  }, [go, mode]);

  const hrefFor = useCallback((view: View) => buildHash(view, { mode }), [mode]);
  const changesHref = useCallback(
    (request: ChangeRequest) => buildHash('changes', request.test_id ? { mode, test: request.test_id } : { mode, before: request.before, after: request.after, scenario: request.scenario === 'if_enacted' ? 'if_enacted' : null }),
    [mode],
  );
  const exampleHref = useCallback(
    (example: DemoExample) =>
      example.target.view === 'changes' ? changesHref(example.target.request) : example.target.view === 'lookup' ? buildHash('lookup', { mode, address: example.target.address_id, as_of: example.target.as_of, run: '1' }) : buildHash(example.target.view, { mode }),
    [changesHref, mode],
  );
  const lookupHref = useCallback((addressId: string, asOf: string) => buildHash('lookup', { mode, address: addressId, as_of: asOf }), [mode]);
  const disagreementHref = useCallback((addressId: string, asOf: string) => buildHash('disagreements', { mode, address: addressId, as_of: asOf }), [mode]);
  const openDisagreement = useCallback((addressId: string, asOf: string) => go('disagreements', { mode, address: addressId, as_of: asOf }), [go, mode]);
  const onLookupParams = useCallback((params: { address: string | null; as_of: string | null; case: string | null }) => replaceParams({ mode, ...params }), [mode, replaceParams]);

  // Deep-link parameters are read by the view once, when it mounts.
  const initial = { address: route.params.get('address'), asOf: route.params.get('as_of'), fixtureCase: route.params.get('case'), run: route.params.get('run') === '1' };
  const initialChange = { before: route.params.get('before'), after: route.params.get('after'), scenario: route.params.get('scenario'), test: route.params.get('test') };

  if (!source) {
    return (
      <div className="app app--demo">
        <SyntheticBanner onLive={() => setMode('live')} />
        <main className="main">
          <div className="page-notice">
            <Skeleton lines={3} label="Loading the synthetic demo" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <SourceProvider value={source}>
      <div className={mode === 'demo' ? 'app app--demo' : 'app'}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mode === 'demo' && <SyntheticBanner onLive={() => setMode('live')} />}
      <Header view={route.view} hrefFor={hrefFor} mode={mode} onMode={setMode} health={health} apiBase={apiBase} onApiBase={setApiBase} catalog={catalog} onStartOver={startOver} />
      <main id="main" className="main" tabIndex={-1}>
        <ServiceNotice mode={mode} health={health} onDemo={() => setMode('demo')} />
        <div className="view-transition" key={route.view}>
        {route.view === 'changes' ? (
          <ChangesView key={`changes:${mode}:${apiBase}:${epoch}`} initial={initialChange} lookupHref={lookupHref} disagreementHref={disagreementHref} />
        ) : route.view === 'disagreements' ? (
          <DisagreementsView
            key={`disagreements:${mode}:${apiBase}:${epoch}:${initial.address ?? ''}:${initial.asOf ?? ''}`}
            mode={mode}
            initial={initial}
            lookupHref={lookupHref}
            disagreementHref={disagreementHref}
            onOpen={openDisagreement}
          />
        ) : (
          <LookupView
            key={`lookup:${mode}:${apiBase}:${epoch}`}
            mode={mode}
            initial={initial}
            onParams={onLookupParams}
            disagreementHref={disagreementHref}
            viewHref={hrefFor}
            exampleHref={exampleHref}
            apiBase={apiBase}
            onSwitchToDemo={mode === 'live' ? () => setMode('demo') : undefined}
          />
        )}
        </div>
      </main>
      <footer className="app-footer"><span className="app-footer__brand">TENENT</span><span>Housing law. In context.</span><span>Built around the evidence.</span></footer>
      </div>
    </SourceProvider>
  );
}
