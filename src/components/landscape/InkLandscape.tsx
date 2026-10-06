import { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  activeTheme,
  buildPreview,
  loadTile,
  readPreviewFromIdb,
  readStoredPreview,
  whenIdle,
  type Theme,
} from './useLandscape';
import {
  LAYER_COUNT,
  MIST_RGB,
  OVERSCAN,
  PAPER_RGB,
  SURFACE_RGB,
  TILE_H,
  TILE_W,
} from './landscapeConfig';
import './InkLandscape.css';

export { prewarmLandscape } from './useLandscape';

interface InkLandscapeProps {
  variant: 'hero' | 'backdrop' | 'stage';
  /** stage only: 0..1 position along the painting. */
  station?: number;
  className?: string;
}

// ---- animation parameters -----------------------------------------------------------------

/** Parallax factor per depth layer: far, mid, near. */
const SPEEDS = [0.35, 0.7, 1];
/** Base drift of the nearest layer in px/s at 900px viewport height (scales with height). */
const DRIFT_PX_S = 12;
/** Full station range 0..1 equals this many viewport widths of travel. */
const STATION_SPAN = 1.5;
const GLIDE_MS = 1200;
/** Pointer parallax amplitude in px per layer (x, y). */
const PTR_X = [3, 6, 10];
const PTR_Y = [1.5, 3, 5];
/** Preload the next tile when its left edge is within this fraction of a tile of the view. */
const LOOKAHEAD = 0.6;
/** Safety net: start animating even if some tile never arrives. */
const READY_TIMEOUT_MS = 9000;

/** Travel survives remounts (login -> app shell) so the painting never snaps back. */
const travel = { drift: 0, station: 0 };

// cubic-bezier(.22, 1, .36, 1)
const bezier = (() => {
  const [x1, y1, x2, y2] = [0.22, 1, 0.36, 1];
  const c = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = c(x1, x2, t) - x;
      const d =
        3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * (1 - t) * t + 3 * (1 - x2) * t ** 2;
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return c(y1, y2, Math.min(1, Math.max(0, t)));
  };
})();

// ---- paper texture ------------------------------------------------------------------------

const TEX = 256;
const textures = new Map<string, string>();

/** Reads a color token written either as `H S% L%` or `#rrggbb`. */
const readRgb = (name: string, fallback: [number, number, number]): [number, number, number] => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = raw.match(/([\d.]+)\D+([\d.]+)%\D+([\d.]+)%/);
  if (!m) return fallback;
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

// Tileable value noise: lattice wraps at `period`.
function makeNoise(period: number) {
  const grid = Array.from({ length: period * period }, () => Math.random());
  const at = (x: number, y: number) => grid[(y % period) * period + (x % period)];
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const sx = (x - xi) ** 2 * (3 - 2 * (x - xi));
    const sy = (y - yi) ** 2 * (3 - 2 * (y - yi));
    const top = at(xi, yi) + sx * (at(xi + 1, yi) - at(xi, yi));
    const bot = at(xi, yi + 1) + sx * (at(xi + 1, yi + 1) - at(xi, yi + 1));
    return top + sy * (bot - top);
  };
}

/** `live`: read the active theme's tokens; otherwise use the constants (inactive theme). */
function paperTexture(dark: boolean, live: boolean): string | null {
  const key = dark ? 'dark' : 'light';
  const hit = textures.get(key);
  if (hit) return hit;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const bg = live ? readRgb('--background', [...PAPER_RGB[key]]) : [...PAPER_RGB[key]];
    const sf = live ? readRgb('--surface', [...SURFACE_RGB[key]]) : [...SURFACE_RGB[key]];
    const fibre = makeNoise(8);
    const img = ctx.createImageData(TEX, TEX);
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const t = fibre((x / TEX) * 8, (y / TEX) * 8);
        const grain = (Math.random() - 0.5) * (dark ? 6 : 10);
        const i = (y * TEX + x) * 4;
        for (let c = 0; c < 3; c++) {
          img.data[i + c] = bg[c] + (sf[c] - bg[c]) * t + grain;
        }
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = `url(${canvas.toDataURL('image/png')})`;
    textures.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/** Soft elliptical puff, pre-rasterized once per theme so drifting it costs only compositing. */
const mistTextures = new Map<string, string>();
function mistTexture(dark: boolean): string | null {
  const key = dark ? 'dark' : 'light';
  const hit = mistTextures.get(key);
  if (hit) return hit;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const [r, g, b] = MIST_RGB[dark ? 'dark' : 'light'];
    ctx.translate(128, 48);
    ctx.scale(128, 48);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const c = (a: number) => `rgba(${r},${g},${b},${a})`;
    grad.addColorStop(0, c(1));
    grad.addColorStop(0.55, c(0.4));
    grad.addColorStop(1, c(0));
    ctx.fillStyle = grad;
    ctx.fillRect(-1, -1, 2, 2);
    const url = `url(${canvas.toDataURL('image/png')})`;
    mistTextures.set(key, url);
    return url;
  } catch {
    return null;
  }
}

// ---- tiled strip engine -------------------------------------------------------------------

/** One tile position: a decoded image per theme, cross-faded by the `is-on` class. */
interface Tile {
  imgs: Partial<Record<Theme, HTMLImageElement>>;
  urls: Partial<Record<Theme, string>>;
}

interface Layer {
  el: HTMLDivElement;
  speed: number;
  tiles: Map<number, Tile>;
  /** `${index}.${theme}` of loads in flight; active-theme ones gate lookahead. */
  pending: Set<string>;
  retryAt: Map<string, number>;
}

const BIRD_SVG =
  '<svg viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">' +
  '<g class="ink-bird__wing ink-bird__wing--l"><path d="M12 8 Q6 0 0 3"/></g>' +
  '<g class="ink-bird__wing ink-bird__wing--r"><path d="M12 8 Q18 0 24 3"/></g></svg>';

export function InkLandscape({ variant, station = 0, className }: InkLandscapeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const birdsRef = useRef<HTMLDivElement>(null);
  const targetStation = variant === 'stage' ? Math.min(1, Math.max(0, station)) : 0;
  const stationRef = useRef(targetStation);
  stationRef.current = targetStation;

  // Blurred preview of the last visit, read synchronously before the first paint.
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const url = readStoredPreview(variant, activeTheme());
    if (url) el.style.backgroundImage = `url("${url}")`;
  }, [variant]);

  useEffect(() => {
    const root = rootRef.current;
    const birds = birdsRef.current;
    const previewEl = previewRef.current;
    if (!root || !birds || !previewEl) return;
    let alive = true;
    let started = false;
    let raf = 0;
    let birdTimer = 0;
    let readyTimer = 0;
    let previewObjectUrl: string | null = null;
    const cancels: (() => void)[] = [];

    const layers: Layer[] = [];
    for (let i = 0; i < LAYER_COUNT; i++) {
      const el = layerRefs.current[i];
      if (!el) return;
      layers.push({ el, speed: SPEEDS[i], tiles: new Map(), pending: new Set(), retryAt: new Map() });
    }

    const isDark = () => document.documentElement.classList.contains('dark');
    const themeOf = (): Theme => (isDark() ? 'dark' : 'light');
    const otherOf = (t: Theme): Theme => (t === 'dark' ? 'light' : 'dark');
    let dark = isDark();

    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionMq.matches;
    const finePointer = window.matchMedia('(pointer: fine)');

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let segPx = 0;
    const placeTile = (tile: Tile, index: number) => {
      for (const img of Object.values(tile.imgs)) {
        img.style.left = `${index * segPx}px`;
        img.style.width = `${segPx}px`;
      }
    };
    const measure = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const h = vh + OVERSCAN * 2;
      segPx = (TILE_W / TILE_H) * h;
      for (const layer of layers) {
        layer.el.style.top = `${-OVERSCAN}px`;
        layer.el.style.height = `${h}px`;
        layer.tiles.forEach((tile, index) => placeTile(tile, index));
      }
    };

    // -- theme-aware tile display --
    /** Show the active theme's image, or keep the other one until the active one is decoded. */
    const applyShown = (tile: Tile) => {
      const want = themeOf();
      const pick = tile.imgs[want] ? want : tile.imgs[otherOf(want)] ? otherOf(want) : null;
      (['light', 'dark'] as Theme[]).forEach((t) => tile.imgs[t]?.classList.toggle('is-on', t === pick));
    };

    // -- tile management --
    const dropTile = (layer: Layer, index: number) => {
      const tile = layer.tiles.get(index);
      if (!tile) return;
      for (const img of Object.values(tile.imgs)) img.remove();
      for (const url of Object.values(tile.urls)) if (url) URL.revokeObjectURL(url);
      layer.tiles.delete(index);
    };

    const ensureVariant = (layer: Layer, index: number, theme: Theme, lazy: boolean) => {
      const key = `${index}.${theme}`;
      if (layer.tiles.get(index)?.imgs[theme] || layer.pending.has(key)) return;
      if ((layer.retryAt.get(key) ?? 0) > performance.now()) return;
      let tile = layer.tiles.get(index);
      if (!tile) {
        tile = { imgs: {}, urls: {} };
        layer.tiles.set(index, tile);
      }
      const mine = tile;
      layer.pending.add(key);
      loadTile(layers.indexOf(layer), index, theme, lazy)
        .then(async (blob) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.decoding = 'async';
          img.alt = '';
          img.draggable = false;
          img.className = `ink-tile ink-tile--${theme}`;
          img.src = url;
          // Raster decode happens off the main thread; the tile is only attached once decoded.
          await img.decode().catch(() => undefined);
          if (!alive || layer.tiles.get(index) !== mine) {
            URL.revokeObjectURL(url);
            return;
          }
          mine.imgs[theme] = img;
          mine.urls[theme] = url;
          placeTile(mine, index);
          layer.el.appendChild(img);
          requestAnimationFrame(() => applyShown(mine));
          afterTile();
        })
        .catch(() => {
          layer.retryAt.set(key, performance.now() + 5000);
          if (!started) window.setTimeout(() => alive && afterTile(), 5100);
        })
        .finally(() => layer.pending.delete(key));
    };

    const range = (layer: Layer, off: number): [number, number] => {
      const first = Math.max(0, Math.floor(off / segPx));
      return [first, Math.max(first, Math.floor((off + vw) / segPx))];
    };

    const manage = (layer: Layer, off: number, lookahead: boolean) => {
      const theme = themeOf();
      const [first, last] = range(layer, off);
      for (let i = first; i <= last; i++) ensureVariant(layer, i, theme, false);
      let ahead = last;
      if (lookahead) {
        // Background lookahead only once every visible tile of every layer is in.
        const idle = !layers.some(activePending);
        ahead = Math.floor((off + vw + segPx * LOOKAHEAD) / segPx);
        if (idle && ahead > last) ensureVariant(layer, ahead, theme, false);
        ahead = Math.max(last, ahead);
      }
      for (const index of Array.from(layer.tiles.keys())) {
        if (index < first || index > ahead) dropTile(layer, index);
      }
    };

    const activePending = (l: Layer) => {
      const suffix = `.${themeOf()}`;
      for (const k of l.pending) if (k.endsWith(suffix)) return true;
      return false;
    };

    // The inactive theme is produced lazily so a theme switch is only a cross-fade.
    const lazyOther = () => {
      const other = otherOf(themeOf());
      if (layers.some((l) => activePending(l) || l.pending.size > 0)) return; // one at a time
      for (const layer of layers) {
        for (const [index, tile] of layer.tiles) {
          if (!tile.imgs[themeOf()]) continue;
          if (!tile.imgs[other]) {
            ensureVariant(layer, index, other, true);
            return;
          }
        }
      }
    };

    const world = () => travel.drift + travel.station * STATION_SPAN * vw;
    const offFor = (i: number) => world() * layers[i].speed;

    // -- preview (a ~480px blurred snapshot of the first view, kept for the next visit) --
    let startOff: number[] = [];
    const snapshotSpec = (theme: Theme) => {
      const specLayers: { layer: number; index: number; x: number; w: number }[] = [];
      layers.forEach((layer, li) => {
        const [first, last] = range(layer, startOff[li]);
        for (let idx = first; idx <= last; idx++) {
          specLayers.push({ layer: li, index: idx, x: idx * segPx - startOff[li], w: segPx });
        }
      });
      return { variant, theme, vw, vh, layers: specLayers };
    };
    let previewEligible = false;
    const queuePreviews = () => {
      if (!previewEligible || variant === 'backdrop') return;
      const first = themeOf();
      void buildPreview(snapshotSpec(first)).catch(() => undefined);
      cancels.push(
        whenIdle(() => {
          if (alive) void buildPreview(snapshotSpec(otherOf(first))).catch(() => undefined);
        }, 6000),
      );
    };

    // -- startup: static until the sharp tiles are decoded --
    const allVisibleReady = () => {
      const theme = themeOf();
      return layers.every((layer, i) => {
        const [first, last] = range(layer, offFor(i) );
        for (let idx = first; idx <= last; idx++) if (!layer.tiles.get(idx)?.imgs[theme]) return false;
        return true;
      });
    };
    const setStatic = () => {
      for (let i = 0; i < layers.length; i++) {
        layers[i].el.style.transform = `translate3d(${(-offFor(i)).toFixed(2)}px, 0, 0)`;
      }
    };
    const afterTile = () => {
      if (!alive) return;
      if (started) return;
      layers.forEach((layer, i) => manage(layer, offFor(i), false));
      if (allVisibleReady()) begin();
    };

    // First load of this page (not a remount after login): the start view is reproducible.
    const freshLoad = travel.drift === 0 && travel.station === 0;
    let from = travel.station;
    let to = stationRef.current;
    // The first frame used to jump straight to the target station; do it up front so the
    // static start view equals the one the animation begins from.
    travel.station = to;
    let glideStart = 0;
    let lastTarget = to;
    let last = performance.now();
    const ptr = { tx: 0, ty: 0, x: 0, y: 0 };

    const frame = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;

      const wanted = stationRef.current;
      if (wanted !== lastTarget) {
        lastTarget = wanted;
        from = travel.station;
        to = wanted;
        glideStart = now;
      }
      if (reduced) {
        travel.station = to;
      } else if (travel.station !== to) {
        const p = Math.min(1, (now - glideStart) / GLIDE_MS);
        travel.station = p >= 1 ? to : from + (to - from) * bezier(p);
      }
      if (!reduced && !document.hidden) travel.drift += DRIFT_PX_S * (vh / 900) * dt;

      const k = reduced ? 0 : 1 - Math.exp(-dt * 4);
      ptr.x += (ptr.tx - ptr.x) * k;
      ptr.y += (ptr.ty - ptr.y) * k;

      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const off = offFor(i);
        const x = -off - ptr.x * PTR_X[i];
        const y = -ptr.y * PTR_Y[i];
        layer.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        manage(layer, off, true);
      }
      lazyOther();
    };

    function begin() {
      if (started || !alive) return;
      started = true;
      window.clearTimeout(readyTimer);
      previewEligible = freshLoad;
      startOff = layers.map((_, i) => offFor(i));
      root!.dataset.ready = 'true';
      // Preview fades out after the sharp tiles have faded in; then it is released.
      window.setTimeout(() => {
        if (!alive) return;
        previewEl!.style.backgroundImage = 'none';
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }, 1600);
      last = performance.now();
      raf = requestAnimationFrame((t) => {
        last = t;
        frame(t);
      });
      cancels.push(whenIdle(queuePreviews, 3000));
    }

    const onPointer = (e: PointerEvent) => {
      if (reduced || vw < 1024 || !finePointer.matches) return;
      ptr.tx = (e.clientX / vw - 0.5) * 2;
      ptr.ty = (e.clientY / vh - 0.5) * 2;
    };

    // -- birds --
    const spawnBird = () => {
      if (!alive) return;
      if (!reduced && !document.hidden && started) {
        const flock = 1 + Math.floor(Math.random() * 3);
        const baseY = 6 + Math.random() * 28; // % of height
        const dur = 22000 + Math.random() * 12000;
        const dir = Math.random() < 0.7 ? 1 : -1;
        for (let b = 0; b < flock; b++) {
          const el = document.createElement('div');
          el.className = 'ink-bird';
          el.innerHTML = BIRD_SVG;
          const sc = 0.7 + Math.random() * 0.5;
          el.style.top = `${baseY + b * 2.2 + Math.random() * 1.5}%`;
          el.style.setProperty('--flap', `${0.55 + Math.random() * 0.25}s`);
          birds.appendChild(el);
          const x0 = dir > 0 ? -60 : vw + 60;
          const x1 = dir > 0 ? vw + 60 : -60;
          const lag = b * (dir > 0 ? -45 : 45) - (b ? Math.random() * 20 : 0);
          const anim = el.animate(
            [
              { transform: `translate3d(${x0 + lag}px, 0, 0) scale(${sc * dir}, ${sc})` },
              { transform: `translate3d(${(x0 + x1) / 2 + lag}px, -${10 + b * 4}px, 0) scale(${sc * dir}, ${sc})` },
              { transform: `translate3d(${x1 + lag}px, 4px, 0) scale(${sc * dir}, ${sc})` },
            ],
            { duration: dur, easing: 'linear', delay: b * 350 },
          );
          anim.onfinish = () => el.remove();
        }
      }
      birdTimer = window.setTimeout(spawnBird, 20000 + Math.random() * 20000);
    };
    birdTimer = window.setTimeout(spawnBird, 6000 + Math.random() * 6000);

    const onMotion = () => {
      reduced = motionMq.matches;
      root.classList.toggle('ink-landscape--still', reduced);
      if (reduced) {
        ptr.tx = ptr.ty = ptr.x = ptr.y = 0;
        birds.replaceChildren();
      }
    };
    root.classList.toggle('ink-landscape--still', reduced);

    // Theme switch: both variants are already decoded, so this is only a CSS cross-fade.
    const themeObserver = new MutationObserver(() => {
      if (isDark() === dark) return;
      dark = isDark();
      layers.forEach((layer) => layer.tiles.forEach(applyShown));
      if (!started) {
        const url = readStoredPreview(variant, themeOf());
        previewEl.style.backgroundImage = url ? `url("${url}")` : 'none';
        afterTile();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    const onVisible = () => {
      last = performance.now();
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    motionMq.addEventListener('change', onMotion);

    // Nothing but the placeholder / stored preview exists until the app has had time to paint.
    cancels.push(
      whenIdle(() => {
        if (!alive) return;
        setStatic();
        layers.forEach((layer, i) => manage(layer, offFor(i), false));
        readyTimer = window.setTimeout(begin, READY_TIMEOUT_MS);
        if (!previewEl.style.backgroundImage || previewEl.style.backgroundImage === 'none') {
          void readPreviewFromIdb(variant, themeOf())
            .then((url) => {
              if (!url) return;
              if (!alive || started) URL.revokeObjectURL(url);
              else {
                previewObjectUrl = url;
                previewEl.style.backgroundImage = `url("${url}")`;
              }
            })
            .catch(() => undefined);
        }
        // Paper / mist textures: built off the critical path.
        applyTextures();
        // The inactive theme's textures are built in their own idle slot, so a switch is free.
        cancels.push(
          whenIdle(() => {
            if (!alive) return;
            paperTexture(!isDark(), false);
            mistTexture(!isDark());
          }, 4000),
        );
      }, 1500),
    );

    let texturesApplied = false;
    const applyTextures = () => {
      texturesApplied = true;
      const d = isDark();
      const url = paperTexture(d, true);
      if (url) root.style.setProperty('--ink-paper', url);
      const mist = mistTexture(d);
      if (mist) root.style.setProperty('--ink-mist-tex', mist);
    };
    const textureObserver = new MutationObserver(() => {
      if (texturesApplied) applyTextures();
    });
    textureObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(birdTimer);
      window.clearTimeout(readyTimer);
      cancels.forEach((c) => c());
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisible);
      motionMq.removeEventListener('change', onMotion);
      themeObserver.disconnect();
      textureObserver.disconnect();
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      birds.replaceChildren();
      for (const layer of layers) {
        Array.from(layer.tiles.keys()).forEach((i) => dropTile(layer, i));
      }
    };
  }, [variant]);

  const mist = (band: 'far' | 'near') => (
    <div className={`ink-mist ink-mist--${band}`} aria-hidden="true">
      {[0, 1].map((i) => (
        <span key={i} className="ink-mist__blob" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  );

  const layer = (i: number) => (
    <div
      key={i}
      ref={(el) => {
        layerRefs.current[i] = el;
      }}
      className={`ink-landscape__layer ink-landscape__layer--${i}`}
    />
  );

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn('ink-landscape', `ink-landscape--${variant}`, className)}
    >
      <div className="ink-landscape__placeholder" />
      <div ref={previewRef} className="ink-landscape__preview" />
      {layer(0)}
      {mist('far')}
      {layer(1)}
      {mist('near')}
      {layer(2)}
      <div className="ink-water" />
      <div ref={birdsRef} className="ink-birds" />
    </div>
  );
}
