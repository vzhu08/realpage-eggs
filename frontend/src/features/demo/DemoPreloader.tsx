import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LiveSource } from '../../api/live';
import type { LookupQuery } from '../../api/types';
import { Notice } from '../../components/ui';

/** Optional preparation controls; existing lookup, questions and evidence UI are reused. */
export function DemoPreloader({ source }: { source: LiveSource }) {
  const enabled = new URLSearchParams(window.location.search).get('preload') === '1';
  const pending = useSyncExternalStore(source.subscribe, source.pending, () => 0);
  const [status, setStatus] = useState('Preparing computed demo results…');
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState<LookupQuery | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    if (!pending) { setElapsed(0); return; }
    setCancelled(false);
    const started = performance.now();
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    setController(abort);
    void (async () => {
      const manifest = await source.demoManifest(abort.signal);
      for (const [index, step] of manifest.steps.entries()) {
        await source.preload(step.request, abort.signal);
        if (abort.signal.aborted) return;
        setStatus(`Prepared ${index + 1} of ${manifest.steps.length} computed demo requests.`);
      }
      const first = manifest.steps[0]!.request;
      setOpening(first);
      setReady(true);
      setController(null);
    })().catch((error: unknown) => {
      if (!abort.signal.aborted) {
        setStatus(error instanceof Error ? error.message : 'Preparation failed.');
        setController(null);
      }
    });
    return () => abort.abort();
  }, [source, enabled]);
  if (!enabled && !pending && !cancelled) return null;
  return <section aria-label="Analysis preparation" style={{ padding: '0.5rem 1rem' }}>
    {enabled && <Notice title={status} role="status" compact>
      <p>These are cached evaluator results on a research snapshot. Hypothetical answers are unverified. Partial analysis and evidence gaps remain visible.</p>
      {ready && opening && <button className="button button--small" onClick={() => source.openPrepared(opening)}>Open prepared property</button>}
      {controller && <button className="button button--small" onClick={() => { controller.abort(); setController(null); setStatus('Preparation cancelled. Completed requests may remain cached.'); }}>Cancel preparation</button>}
    </Notice>}
    {!!pending && <Notice title={`Analyzing the selected property… ${elapsed}s`} role="status" compact>
      <p>Waiting for a complete response. Earlier results, if visible, remain labeled with their original inputs.</p>
      <button className="button button--small" onClick={() => { source.cancelLookups(); setCancelled(true); }}>Cancel analysis</button>
    </Notice>}
    {cancelled && !pending && <p role="status">Analysis cancelled. The server may finish its computation; no later response will replace this screen.</p>}
  </section>;
}
