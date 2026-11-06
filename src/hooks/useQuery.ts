import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ApiError, isCancelled } from '../services/http/errors';
import { FRESH_FOR_MS } from '../services/config';
import { clearRequestMemo } from '../services/http/client';
import { type Emit, type QueryData } from '../services/http/fanout';
import { getSession } from '../services/session';

export interface QueryState<R> {
  status: 'loading' | 'ready' | 'error';
  rows: R[];
  fetching: boolean;
  stale: boolean;
  /** old rows are being kept behind the scenes while a new answer is loading (not for display on form reports) */
  held: boolean;
  failed: number;
  total: number;
  done: number;
  error: ApiError | null;
  updatedAt: number | null;
  note: string | null;
  retry: () => void;
}

/** `signal` is aborted when nobody looks at this query any more: fetchers pass it on so queued requests are dropped. */
type Fetcher<R> = (emit: Emit<R>, signal: AbortSignal) => Promise<QueryData<R>>;
interface Entry<R> {
  state: Omit<QueryState<R>, 'retry'>;
  listeners: Set<() => void>;
  fetcher: Fetcher<R>;
  inflight: boolean;
  abort: AbortController | null;
}

const store = new Map<string, Entry<unknown>>();
const PREFIX = 'smartx:';
const ABORT_AFTER_MS = 600;

function readCache<R>(key: string): { at: number; rows: R[]; note?: string } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; rows: R[]; note?: string };
    return Array.isArray(v.rows) ? v : null;
  } catch {
    return null;
  }
}
function pruneCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* no localStorage */
  }
}
/** Saving a big report to localStorage takes a moment: do it when the browser is idle, never while rows are being drawn. */
const later = (fn: () => void) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else window.setTimeout(fn, 200);
};
function writeCache<R>(key: string, rows: R[], note?: string) {
  if (rows.length > 40000) return;
  later(() => {
    try {
      const payload = JSON.stringify({ at: Date.now(), rows, note });
      try {
        localStorage.setItem(PREFIX + key, payload);
      } catch {
        // storage full: old saved reports are only a cache, clear them and save this one
        pruneCache();
        localStorage.setItem(PREFIX + key, payload);
      }
    } catch {
      /* still no room: the report just is not cached */
    }
  });
}

export function clearSmartxCache() {
  store.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
  }
}

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError('Something went wrong while loading this data.', 'server'));

function notify(e: Entry<unknown>) {
  e.listeners.forEach((l) => l());
}

function run<R>(key: string, entry: Entry<R>, force = false) {
  if (entry.inflight) return;
  if (force) { clearRequestMemo(); }
  const ctl = new AbortController();
  entry.abort = ctl;
  entry.inflight = true;
  const prev = entry.state;
  // rows that are already on screen (saved copy / earlier load) stay exactly as they are until the new answer is complete,
  // so the table never shrinks to the first few rows and grows again (that was the blinking)
  const holdOld = prev.rows.length > 0;
  entry.state = { ...prev, fetching: true, held: holdOld, error: null, done: 0, total: 0 };
  notify(entry as Entry<unknown>);

  const emit: Emit<R> = (p) => {
    if (ctl.signal.aborted) return;
    const hasRows = p.rows.length > 0;
    entry.state = {
      ...entry.state,
      ...(hasRows && !holdOld ? { status: 'ready' as const, rows: p.rows, stale: false, held: false } : {}),
      failed: p.failed,
      total: p.total,
      done: p.done,
      note: p.note ?? entry.state.note,
    };
    notify(entry as Entry<unknown>);
  };

  // nobody wants this answer any more (page left / filters changed): put the entry back as it was
  const dropped = () => {
    entry.inflight = false;
    entry.abort = null;
    entry.state = prev;
    notify(entry as Entry<unknown>);
    // somebody came back while it was being dropped
    if (entry.listeners.size > 0) run(key, entry);
  };

  Promise.resolve().then(() => entry.fetcher(emit, ctl.signal)).then(
    (data) => {
      if (ctl.signal.aborted) return dropped();
      entry.inflight = false;
      entry.abort = null;
      entry.state = { status: 'ready', rows: data.rows, fetching: false, stale: false, held: false, failed: data.failed, total: data.total, done: data.done, error: null, updatedAt: Date.now(), note: data.note ?? null };
      if (data.failed === 0) writeCache(key, data.rows, data.note);
      notify(entry as Entry<unknown>);
    },
    (err) => {
      if (ctl.signal.aborted || isCancelled(err)) return dropped();
      entry.inflight = false;
      entry.abort = null;
      const hasRows = entry.state.rows.length > 0;
      entry.state = {
        ...entry.state,
        status: hasRows ? 'ready' : 'error',
        fetching: false,
        stale: hasRows,
        held: false,
        error: toApiError(err),
      };
      notify(entry as Entry<unknown>);
    },
  );
}

function entryFor<R>(key: string, fetcher: Fetcher<R>): Entry<R> {
  let e = store.get(key) as Entry<R> | undefined;
  if (!e) {
    const cached = readCache<R>(key);
    e = {
      state: {
        status: cached ? 'ready' : 'loading',
        rows: cached?.rows ?? [],
        fetching: false,
        stale: !!cached,
        held: false,
        failed: 0,
        total: 0,
        done: 0,
        error: null,
        updatedAt: cached?.at ?? null,
        note: cached?.note ?? null,
      },
      listeners: new Set(),
      fetcher,
      inflight: false,
      abort: null,
    };
    store.set(key, e as Entry<unknown>);
  }
  e.fetcher = fetcher;
  return e;
}


export function refetchAll() {
  store.forEach((e, key) => { if (e.listeners.size > 0) run(key, e, true); });
}

const IDLE: QueryState<never> = {
  status: 'loading', rows: [], fetching: false, stale: false, held: false, failed: 0, total: 0, done: 0, error: null, updatedAt: null, note: null, retry: () => {},
};


export interface QueryOptions {
  /**
   * For reports behind a filter form: while the answer for the submitted filters is loading, do NOT show the saved / earlier rows,
   * show the loader instead. Rows appear only when the new data has arrived.
   */
  hideOldWhileLoading?: boolean;
}

export function useQuery<R>(key: string | null, fetcher: Fetcher<R>, options?: QueryOptions): QueryState<R> {
  const scoped = key ? `${getSession()?.scope ?? 'anon'}:${key}` : null;
  const entry = scoped ? entryFor(scoped, fetcher) : null;

  const subscribe = useCallback(
    (cb: () => void) => {
      entry?.listeners.add(cb);
      return () => void entry?.listeners.delete(cb);
    },
    [entry],
  );
  const snapshot = useSyncExternalStore(subscribe, () => entry?.state ?? null);

  useEffect(() => {
    if (!entry || !scoped) return undefined;
    const fresh = entry.state.updatedAt !== null && !entry.state.stale && Date.now() - entry.state.updatedAt < FRESH_FOR_MS;
    if (!fresh) run(scoped, entry);
    return () => {
      // the page was left or the filters changed: after a short grace time (React re-mounts in dev) stop the requests of this
      // query nobody is looking at, so they do not hold the 10 request slots in front of the report that is wanted now
      window.setTimeout(() => {
        if (entry.listeners.size === 0) entry.abort?.abort();
      }, ABORT_AFTER_MS);
    };
  }, [entry, scoped]);

  const retry = useCallback(() => {
    if (entry && scoped) run(scoped, entry, true);
  }, [entry, scoped]);

  if (!snapshot) return IDLE as QueryState<R>;
  if (options?.hideOldWhileLoading && snapshot.fetching && snapshot.held) {
    return { ...snapshot, status: 'loading', rows: [], failed: 0, retry };
  }
  return { ...snapshot, retry };
}
