/**
 * Reads the records a comparison refers to: the sample properties (GET /addresses), each
 * compared rule (GET /rules/{id}) and each rule's source document (GET /sources/{id}). They
 * supply the legal location, the source text and the dates behind each change. The comparison
 * is usable before any of this arrives: POST /changes/summary already names every property and
 * rule, and a record that cannot be read keeps that name (or its ID when there is no summary).
 */
import { useEffect, useMemo, useState } from 'react';
import { type ApiError, isAbort, toApiError } from '../../api/errors';
import type { AddressItem, ChangeOutcome, DataSource, Rule, SourceDocument } from '../../api/types';
import { type Lookups, referencedAddressIds, referencedRuleIds } from '../../lib/portfolio';

export interface LoadProgress {
  status: 'idle' | 'loading' | 'ready' | 'error';
  loaded: number;
  total: number;
  /** IDs whose record could not be read; they keep their ID as their label. */
  failed: string[];
  error: ApiError | null;
}

export interface PortfolioDetails {
  lookups: Lookups;
  addresses: LoadProgress;
  rules: LoadProgress;
  sources: LoadProgress;
  retry: () => void;
}

const PAGE = 100;
/** A safety stop for the address list; the supplied sample has 500 properties. */
const MAX_PAGES = 30;
const idle = (): LoadProgress => ({ status: 'idle', loaded: 0, total: 0, failed: [], error: null });

interface Cache {
  addresses: Promise<Map<string, AddressItem>> | null;
  rules: Map<string, Rule>;
  sources: Map<string, SourceDocument>;
}
const caches = new WeakMap<DataSource, Cache>();
const cacheFor = (source: DataSource): Cache => {
  let cache = caches.get(source);
  if (!cache) {
    cache = { addresses: null, rules: new Map(), sources: new Map() };
    caches.set(source, cache);
  }
  return cache;
};

/** Shared by every comparison on a source, so it is never tied to one comparison's cancellation. */
async function allAddresses(source: DataSource): Promise<Map<string, AddressItem>> {
  const items = new Map<string, AddressItem>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await source.addresses({ q: '', offset: page * PAGE, limit: PAGE });
    for (const item of result.items) items.set(item.property.address_id, item);
    if (!result.items.length || items.size >= result.total) break;
  }
  return items;
}

/** Runs `task` over `ids` a few at a time. Stops quietly when aborted. */
async function each(ids: string[], limit: number, signal: AbortSignal, task: (id: string) => Promise<void>): Promise<void> {
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (signal.aborted) return;
      await task(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

export function usePortfolioDetails(source: DataSource, outcome: ChangeOutcome | null): PortfolioDetails {
  const [attempt, setAttempt] = useState(0);
  const [addresses, setAddresses] = useState<{ items: ReadonlyMap<string, AddressItem>; progress: LoadProgress }>({ items: new Map(), progress: idle() });
  const [rules, setRules] = useState<{ items: ReadonlyMap<string, Rule>; progress: LoadProgress }>({ items: new Map(), progress: idle() });
  const [sources, setSources] = useState<{ items: ReadonlyMap<string, SourceDocument>; progress: LoadProgress }>({ items: new Map(), progress: idle() });

  useEffect(() => {
    if (!outcome) {
      setAddresses({ items: new Map(), progress: idle() });
      setRules({ items: new Map(), progress: idle() });
      setSources({ items: new Map(), progress: idle() });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const cache = cacheFor(source);
    const live = () => !signal.aborted;

    const addressIds = referencedAddressIds(outcome.result);
    const ruleIds = referencedRuleIds(outcome.result);

    // Properties: one read of the sample list, shared by later comparisons on this source.
    if (!addressIds.length) {
      setAddresses({ items: new Map(), progress: { ...idle(), status: 'ready' } });
    } else {
      setAddresses((current) => ({ items: current.items, progress: { status: 'loading', loaded: 0, total: addressIds.length, failed: [], error: null } }));
      cache.addresses ??= allAddresses(source);
      const pending = cache.addresses;
      pending.then(
        (items) => {
          if (!live()) return;
          const failed = addressIds.filter((id) => !items.has(id));
          setAddresses({ items, progress: { status: 'ready', loaded: addressIds.length - failed.length, total: addressIds.length, failed, error: null } });
        },
        (error: unknown) => {
          if (cache.addresses === pending) cache.addresses = null;
          if (!live() || isAbort(error)) return;
          setAddresses({ items: new Map(), progress: { status: 'error', loaded: 0, total: addressIds.length, failed: addressIds, error: toApiError(error, 'GET /addresses') } });
        },
      );
    }

    // Rules, then the source document each rule was encoded from.
    void (async () => {
      const failedRules: string[] = [];
      let lastError: ApiError | null = null;
      const publishRules = (status: LoadProgress['status']) => {
        if (!live()) return;
        const items = new Map(ruleIds.filter((id) => cache.rules.has(id)).map((id) => [id, cache.rules.get(id) as Rule]));
        setRules({ items, progress: { status, loaded: items.size, total: ruleIds.length, failed: [...failedRules], error: status === 'error' ? lastError : null } });
      };
      publishRules(ruleIds.length ? 'loading' : 'ready');
      await each(ruleIds.filter((id) => !cache.rules.has(id)), 4, signal, async (id) => {
        try {
          const detail = await source.ruleDetail(id, signal);
          cache.rules.set(id, detail.rule);
        } catch (error) {
          if (isAbort(error) || signal.aborted) return;
          failedRules.push(id);
          lastError = toApiError(error, 'GET /rules/{id}');
        }
        publishRules('loading');
      });
      if (!live()) return;
      publishRules(ruleIds.length && failedRules.length === ruleIds.length ? 'error' : 'ready');

      const docIds = [...new Set(ruleIds.map((id) => cache.rules.get(id)?.source_doc_id).filter((id): id is string => !!id))].sort();
      const failedSources: string[] = [];
      let sourceError: ApiError | null = null;
      const publishSources = (status: LoadProgress['status']) => {
        if (!live()) return;
        const items = new Map(docIds.filter((id) => cache.sources.has(id)).map((id) => [id, cache.sources.get(id) as SourceDocument]));
        setSources({ items, progress: { status, loaded: items.size, total: docIds.length, failed: [...failedSources], error: status === 'error' ? sourceError : null } });
      };
      publishSources(docIds.length ? 'loading' : 'ready');
      await each(docIds.filter((id) => !cache.sources.has(id)), 3, signal, async (id) => {
        try {
          cache.sources.set(id, await source.source(id, signal));
        } catch (error) {
          if (isAbort(error) || signal.aborted) return;
          failedSources.push(id);
          sourceError = toApiError(error, 'GET /sources/{id}');
        }
        publishSources('loading');
      });
      publishSources(docIds.length && failedSources.length === docIds.length ? 'error' : 'ready');
    })();

    return () => controller.abort();
  }, [source, outcome, attempt]);

  const summary = outcome?.summary ?? null;
  const lookups = useMemo<Lookups>(() => ({ addresses: addresses.items, rules: rules.items, sources: sources.items, summary }), [addresses.items, rules.items, sources.items, summary]);
  return { lookups, addresses: addresses.progress, rules: rules.progress, sources: sources.progress, retry: () => setAttempt((value) => value + 1) };
}
