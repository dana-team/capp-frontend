import type { TileRequest, TileResponse } from './landscape.worker';
import { CACHE_VERSION } from './landscapeConfig';

/**
 * Tile service: one SVG tile per (depth layer, index). Tiles are generated sequentially in a
 * persistent worker (same seed, continuing x range) and cached in IndexedDB.
 */

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

// ---- IndexedDB -------------------------------------------------------------------------

const DB_NAME = 'capp-landscape';
const STORE = 'strips';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const prefix = (seed: string) => `${CACHE_VERSION}.${seed}.`;
const keyOf = (seed: string, layer: number, index: number) => `${prefix(seed)}${layer}.${index}`;

let pruned = false;

const readCache = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openDb();
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result instanceof Blob ? r.result : null);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
};

const writeCache = async (seed: string, key: string, blob: Blob): Promise<void> => {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        if (!pruned) {
          pruned = true; // drop other seeds / old formats once per page load
          const cur = store.openKeyCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            if (typeof c.key !== 'string' || !c.key.startsWith(prefix(seed))) store.delete(c.key);
            c.continue();
          };
        }
        store.put(blob, key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB unavailable / quota: tiles regenerate on demand
  }
};

// ---- worker ----------------------------------------------------------------------------

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();

const getWorker = (): Worker => {
  if (worker) return worker;
  const w = new Worker(new URL('./landscape.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<TileResponse>) => {
    const p = waiting.get(e.data.id);
    if (!p) return;
    waiting.delete(e.data.id);
    if ('error' in e.data) p.reject(new Error(e.data.error));
    else p.resolve(e.data.blob);
  };
  w.onerror = (e) => {
    const err = new Error(e.message || 'landscape worker failed');
    waiting.forEach((p) => p.reject(err));
    waiting.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
};

const generate = (seed: string, layer: number, index: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    const req: TileRequest = { id, seed, layer, index };
    getWorker().postMessage(req);
  });

// ---- public API ------------------------------------------------------------------------

const inflight = new Map<string, Promise<Blob>>();
// Tiles just produced, so a quick re-request (prewarm -> mount) does not regenerate them
// before the IndexedDB write lands.
const recent = new Map<string, Blob>();
const remember = (key: string, blob: Blob) => {
  recent.delete(key);
  recent.set(key, blob);
  if (recent.size > 8) recent.delete(recent.keys().next().value as string);
};

const loadBlob = (layer: number, index: number): Promise<Blob> => {
  const seed = getSeed();
  const key = keyOf(seed, layer, index);
  const hit = recent.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const cached = await readCache(key);
    if (cached) return cached;
    const blob = await generate(seed, layer, index);
    remember(key, blob);
    void writeCache(seed, key, blob);
    return blob;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

// Night: ink becomes pale on dark paper. Baked into the raster as an SVG color matrix
// (invert + hue-rotate 180deg) so no CSS filter has to run per frame on moving layers.
const NIGHT_FILTER =
  '<defs><filter id="n" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">' +
  '<feColorMatrix type="matrix" values="' +
  '0.574 -1.430 -0.144 0 1  -0.426 -0.430 -0.144 0 1  -0.426 -1.430 0.856 0 1  0 0 0 1 0"/>' +
  '</filter></defs><g filter="url(#n)">';

const toNight = async (blob: Blob): Promise<Blob> => {
  const text = await blob.text();
  const at = text.indexOf('>') + 1;
  return new Blob([text.slice(0, at), NIGHT_FILTER, text.slice(at, -6), '</g></svg>'], {
    type: 'image/svg+xml',
  });
};

/** Resolves to an object URL the caller owns and must revoke. */
export const loadTile = async (layer: number, index: number, dark = false): Promise<string> => {
  const blob = await loadBlob(layer, index);
  return URL.createObjectURL(dark ? await toNight(blob) : blob);
};

/** Kick off generation of the first tiles (e.g. before the landscape mounts). Never throws. */
export const prewarmLandscape = (): void => {
  for (let layer = 0; layer < 3; layer++) loadBlob(layer, 0).catch(() => undefined);
};
