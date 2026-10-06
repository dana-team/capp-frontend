import type { PreviewLayer, PreviewRequest, TileRequest, WorkerResponse } from './landscape.worker';
import {
  CACHE_VERSION,
  DARK_TILE_ALPHA,
  MAX_TILE_PIXELS,
  OVERSCAN,
  PAPER_RGB,
  PREVIEW_MAX_B64,
  TILE_H,
  TILE_W,
  type Theme,
} from './landscapeConfig';

/**
 * Tile service: one raster tile per (depth layer, index, theme). Tiles are generated and
 * rasterized sequentially in a persistent worker and cached in IndexedDB (both themes), plus a
 * tiny blurred preview of the first view that is also mirrored into localStorage.
 */

export type { Theme };

export const activeTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/** requestIdleCallback with a timeout; setTimeout where it is missing. Returns a canceller. */
export const whenIdle = (fn: () => void, timeout = 1500): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const h = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(h);
  }
  const h = window.setTimeout(fn, 400);
  return () => window.clearTimeout(h);
};

const SEED_KEY = 'capp.landscape.seed';

const randomSeed = (): string =>
  Math.floor(Math.random() * 36 ** 8).toString(36).padStart(8, '0');
const memorySeed = randomSeed();

// The vendor PRNG hashes the seed string, keep it short.
export const getSeed = (): string => {
  try {
    const stored = sessionStorage.getItem(SEED_KEY);
    if (stored) return stored;
    const seed = randomSeed();
    sessionStorage.setItem(SEED_KEY, seed);
    return seed;
  } catch {
    return memorySeed;
  }
};

/** Raster height (device px) of every tile this page load; fixed so cache keys stay stable. */
let pxHMemo = 0;
export const rasterHeight = (): number => {
  if (pxHMemo) return pxHMemo;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const want = (window.innerHeight + OVERSCAN * 2) * dpr;
  const cap = Math.sqrt((MAX_TILE_PIXELS * TILE_H) / TILE_W);
  pxHMemo = Math.max(256, Math.floor(Math.min(want, cap) / 64) * 64 || 256);
  return pxHMemo;
};

// ---- IndexedDB -------------------------------------------------------------------------

const DB_NAME = 'capp-landscape';
const STORE = 'strips';

let dbPromise: Promise<IDBDatabase> | null = null;
const getDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  p.catch(() => {
    dbPromise = null;
  });
  dbPromise = p;
  return p;
};

const prefix = (seed: string) => `${CACHE_VERSION}.${seed}.`;
const PREVIEW_PREFIX = `${CACHE_VERSION}.preview.`;
const keyOf = (seed: string, layer: number, index: number, theme: Theme, pxH: number) =>
  `${prefix(seed)}${layer}.${index}.${theme}.${pxH}`;

let pruned = false;

const readCache = async (key: string): Promise<Blob | null> => {
  try {
    const db = await getDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result instanceof Blob ? r.result : null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return null;
  }
};

const writeCache = async (seed: string, key: string, blob: Blob): Promise<void> => {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      const store = t.objectStore(STORE);
      if (!pruned) {
        pruned = true; // drop other seeds / old formats once per page load
        const cur = store.openKeyCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          const k = c.key;
          if (typeof k !== 'string' || !(k.startsWith(prefix(seed)) || k.startsWith(PREVIEW_PREFIX))) {
            store.delete(k);
          }
          c.continue();
        };
      }
      store.put(blob, key);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } catch {
    // IndexedDB unavailable / quota: tiles regenerate on demand
  }
};

// ---- worker ----------------------------------------------------------------------------

interface Waiter {
  resolve: (r: { blob: Blob; kind: string }) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, Waiter>();

const getWorker = (): Worker => {
  if (worker) return worker;
  const w = new Worker(new URL('./landscape.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const p = waiting.get(e.data.id);
    if (!p) return;
    waiting.delete(e.data.id);
    if ('error' in e.data) p.reject(new Error(e.data.error));
    else p.resolve({ blob: e.data.blob, kind: e.data.kind });
  };
  w.onerror = (e) => {
    const err = new Error(e.message || 'landscape worker failed');
    waiting.forEach((p) => p.reject(err));
    waiting.clear();
    inFlight = 0;
    lazyInFlight = 0;
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
};

// Priority queue in front of the worker: the active theme always goes before lazy work, and
// lazy work only runs while nothing else is in flight.
interface Job {
  lazy: boolean;
  send: () => void;
  settle: Waiter;
  id: number;
}
const queue: Job[] = [];
let inFlight = 0;
let lazyInFlight = 0;

const pump = () => {
  while (queue.length) {
    const hasUrgent = queue.some((j) => !j.lazy);
    const next = hasUrgent ? queue.findIndex((j) => !j.lazy) : 0;
    const job = queue[next];
    if (job.lazy && inFlight > 0) return;
    if (!job.lazy && inFlight - lazyInFlight >= 2) return;
    queue.splice(next, 1);
    inFlight++;
    if (job.lazy) lazyInFlight++;
    waiting.set(job.id, {
      resolve: (r) => {
        done(job);
        job.settle.resolve(r);
      },
      reject: (e) => {
        done(job);
        job.settle.reject(e);
      },
    });
    job.send();
  }
};
const done = (job: Job) => {
  inFlight = Math.max(0, inFlight - 1);
  if (job.lazy) lazyInFlight = Math.max(0, lazyInFlight - 1);
  queueMicrotask(pump);
};

const submit = (
  lazy: boolean,
  build: (id: number) => TileRequest | PreviewRequest,
): Promise<{ blob: Blob; kind: string }> =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    queue.push({
      lazy,
      id,
      settle: { resolve, reject },
      send: () => {
        try {
          getWorker().postMessage(build(id));
        } catch (err) {
          waiting.delete(id);
          done({ lazy, id, send: () => undefined, settle: { resolve, reject } });
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
    pump();
  });

// ---- public API ------------------------------------------------------------------------

const inflight = new Map<string, Promise<Blob>>();
/** `${seed}.${layer}.${index}` of tiles the worker rendered itself (it keeps a small copy). */
const renderedHere = new Set<string>();
// Recently produced / read tiles, so remounts and quick re-requests never regenerate.
const recent = new Map<string, Blob>();
const MEMORY_TILES = 32;
const remember = (key: string, blob: Blob) => {
  recent.delete(key);
  recent.set(key, blob);
  if (recent.size > MEMORY_TILES) recent.delete(recent.keys().next().value as string);
};

/**
 * Raster (or, without OffscreenCanvas, SVG) blob of one tile in one theme. `lazy` marks
 * background work (the inactive theme) that must never delay the active one.
 */
export const loadTile = (
  layer: number,
  index: number,
  theme: Theme,
  lazy = false,
): Promise<Blob> => {
  const seed = getSeed();
  const pxH = rasterHeight();
  const key = keyOf(seed, layer, index, theme, pxH);
  const hit = recent.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const cached = await readCache(key);
    if (cached) {
      remember(key, cached);
      return cached;
    }
    const { blob } = await submit(lazy, (id) => ({
      op: 'tile',
      id,
      seed,
      layer,
      index,
      theme,
      pxH,
    }));
    if (blob.type !== 'image/svg+xml') renderedHere.add(`${seed}.${layer}.${index}`);
    remember(key, blob);
    // SVG fallback blobs are cached under the same key (they carry their own mime type).
    void writeCache(seed, key, blob);
    return blob;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

/** Kick off the first tiles of the active theme once the app has had a chance to paint. */
export const prewarmLandscape = (): void => {
  whenIdle(() => {
    const theme = activeTheme();
    for (let layer = 0; layer < 3; layer++) loadTile(layer, 0, theme).catch(() => undefined);
  }, 1500);
};

// ---- blurred preview -------------------------------------------------------------------

const lsKey = (variant: string, theme: Theme) => `capp.landscape.preview.${CACHE_VERSION}.${variant}.${theme}`;
const idbPreviewKey = (variant: string, theme: Theme) => `${PREVIEW_PREFIX}${variant}.${theme}`;

/** Synchronous read of the stored preview (data URL), or null. */
export const readStoredPreview = (variant: string, theme: Theme): string | null => {
  try {
    const raw = localStorage.getItem(lsKey(variant, theme));
    if (!raw) return null;
    const sep = raw.indexOf('|');
    return sep > 0 ? raw.slice(sep + 1) : null;
  } catch {
    return null;
  }
};

export const storedPreviewSeed = (variant: string, theme: Theme): string | null => {
  try {
    const raw = localStorage.getItem(lsKey(variant, theme));
    if (!raw) return null;
    const sep = raw.indexOf('|');
    return sep > 0 ? raw.slice(0, sep) : null;
  } catch {
    return null;
  }
};

/** Async fallback when the localStorage copy is missing: object URL the caller must revoke. */
export const readPreviewFromIdb = async (variant: string, theme: Theme): Promise<string | null> => {
  const blob = await readCache(idbPreviewKey(variant, theme));
  return blob ? URL.createObjectURL(blob) : null;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export interface PreviewSpec {
  variant: string;
  theme: Theme;
  vw: number;
  vh: number;
  /** layer -> tiles (index, left in css px, tile width in css px) at the preview's scroll position */
  layers: { layer: number; index: number; x: number; w: number }[];
}

/** Composites the first view in the worker, then stores it in IndexedDB and localStorage. */
export const buildPreview = async (spec: PreviewSpec): Promise<void> => {
  const seed = getSeed();
  if (storedPreviewSeed(spec.variant, spec.theme) === seed) return;
  const lazy = spec.theme !== activeTheme();
  const tiles: PreviewLayer[] = [];
  for (const t of spec.layers) {
    const blob = await loadTile(t.layer, t.index, spec.theme, lazy);
    if (!/^image\/(webp|png)$/.test(blob.type)) return; // SVG fallback: no preview
    const rendered = renderedHere.has(`${seed}.${t.layer}.${t.index}`);
    tiles.push({
      seed,
      layer: t.layer,
      index: t.index,
      blob: rendered ? undefined : blob,
      x: t.x,
      y: -OVERSCAN,
      w: t.w,
      h: spec.vh + OVERSCAN * 2,
    });
  }
  const { blob } = await submit(true, (id) => ({
    op: 'preview',
    id,
    theme: spec.theme,
    vw: spec.vw,
    vh: spec.vh,
    bg: PAPER_RGB[spec.theme],
    alpha: spec.theme === 'dark' ? DARK_TILE_ALPHA : 1,
    layers: tiles,
  }));
  void writeCache(seed, idbPreviewKey(spec.variant, spec.theme), blob);
  const url = await blobToDataUrl(blob);
  if (url.length <= PREVIEW_MAX_B64) {
    try {
      localStorage.setItem(lsKey(spec.variant, spec.theme), `${seed}|${url}`);
    } catch {
      // quota / private mode
    }
  }
};
