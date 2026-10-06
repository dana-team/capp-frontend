import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { loadTile } from './useLandscape';
import { LAYER_COUNT, TILE_H, TILE_W } from './landscapeConfig';
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
/** Vertical overscan (px each side) so pointer parallax never reveals an edge. */
const OVERSCAN = 12;
/** Preload the next tile when its left edge is within this fraction of a tile of the view. */
const LOOKAHEAD = 0.6;

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

function paperTexture(dark: boolean): string | null {
  const key = dark ? 'dark' : 'light';
  const hit = textures.get(key);
  if (hit) return hit;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const bg = readRgb('--background', [238, 241, 239]);
    const sf = readRgb('--surface', [228, 232, 230]);
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
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--mist-rgb').trim();
    const [r, g, b] = raw.split(/\s+/).map(Number);
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

interface Tile {
  img: HTMLImageElement;
  url: string;
}

interface Layer {
  el: HTMLDivElement;
  speed: number;
  tiles: Map<number, Tile>;
  pending: Set<number>;
  retryAt: Map<number, number>;
}

const BIRD_SVG =
  '<svg viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">' +
  '<g class="ink-bird__wing ink-bird__wing--l"><path d="M12 8 Q6 0 0 3"/></g>' +
  '<g class="ink-bird__wing ink-bird__wing--r"><path d="M12 8 Q18 0 24 3"/></g></svg>';

export function InkLandscape({ variant, station = 0, className }: InkLandscapeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const birdsRef = useRef<HTMLDivElement>(null);
  const targetStation = variant === 'stage' ? Math.min(1, Math.max(0, station)) : 0;
  const stationRef = useRef(targetStation);
  stationRef.current = targetStation;
  const [ready, setReady] = useState(false);

  // Paper texture: built once per theme, regenerated when `.dark` toggles.
  useEffect(() => {
    const apply = () => {
      const dark = document.documentElement.classList.contains('dark');
      const url = paperTexture(dark);
      if (url) rootRef.current?.style.setProperty('--ink-paper', url);
      const mist = mistTexture(dark);
      if (mist) rootRef.current?.style.setProperty('--ink-mist-tex', mist);
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [variant]);

  useEffect(() => {
    const root = rootRef.current;
    const birds = birdsRef.current;
    if (!root || !birds) return;
    let alive = true;

    const layers: Layer[] = [];
    for (let i = 0; i < LAYER_COUNT; i++) {
      const el = layerRefs.current[i];
      if (!el) return;
      layers.push({ el, speed: SPEEDS[i], tiles: new Map(), pending: new Set(), retryAt: new Map() });
    }

    const isDark = () => document.documentElement.classList.contains('dark');
    let dark = isDark();

    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionMq.matches;
    const finePointer = window.matchMedia('(pointer: fine)');

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let segPx = 0;
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
    const placeTile = (tile: Tile, index: number) => {
      tile.img.style.left = `${index * segPx}px`;
      tile.img.style.width = `${segPx}px`;
    };

    // -- tile management --
    const dropTile = (layer: Layer, index: number) => {
      const tile = layer.tiles.get(index);
      if (!tile) return;
      tile.img.remove();
      URL.revokeObjectURL(tile.url);
      layer.tiles.delete(index);
    };

    const request = (layer: Layer, index: number) => {
      if (layer.tiles.has(index) || layer.pending.has(index)) return;
      if ((layer.retryAt.get(index) ?? 0) > performance.now()) return;
      layer.pending.add(index);
      const forDark = dark;
      loadTile(layers.indexOf(layer), index, forDark)
        .then(async (url) => {
          const img = new Image();
          img.decoding = 'async';
          img.alt = '';
          img.draggable = false;
          img.src = url;
          await img.decode().catch(() => undefined);
          if (!alive || forDark !== dark) {
            URL.revokeObjectURL(url);
            return;
          }
          const tile = { img, url };
          layer.tiles.set(index, tile);
          placeTile(tile, index);
          layer.el.appendChild(img);
          requestAnimationFrame(() => img.classList.add('is-in'));
          setReady(true);
        })
        .catch(() => layer.retryAt.set(index, performance.now() + 5000))
        .finally(() => layer.pending.delete(index));
    };

    const manage = (layer: Layer, off: number) => {
      const first = Math.max(0, Math.floor(off / segPx));
      const last = Math.max(first, Math.floor((off + vw) / segPx));
      for (let i = first; i <= last; i++) request(layer, i);
      // Background lookahead only once every visible tile of every layer is in.
      const idle = layers.every((l) => l.pending.size === 0);
      const ahead = Math.floor((off + vw + segPx * LOOKAHEAD) / segPx);
      if (idle && ahead > last) request(layer, ahead);
      const keepMax = Math.max(last, ahead);
      for (const index of Array.from(layer.tiles.keys())) {
        if (index < first || index > keepMax) dropTile(layer, index);
      }
    };

    // -- motion state --
    const ptr = { tx: 0, ty: 0, x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      if (reduced || vw < 1024 || !finePointer.matches) return;
      ptr.tx = (e.clientX / vw - 0.5) * 2;
      ptr.ty = (e.clientY / vh - 0.5) * 2;
    };

    let from = travel.station;
    let to = stationRef.current;
    let glideStart = 0;
    let lastTarget = to;
    let last = performance.now();

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

      const world = travel.drift + travel.station * STATION_SPAN * vw;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const off = world * layer.speed;
        const x = -off - ptr.x * PTR_X[i];
        const y = -ptr.y * PTR_Y[i];
        layer.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        manage(layer, off);
      }
    };
    let raf = requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });

    // -- birds --
    let birdTimer = 0;
    const spawnBird = () => {
      if (!alive) return;
      if (!reduced && !document.hidden) {
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
    // Theme switch: rebuild tiles in the other palette (tiles are cached, so this is quick).
    const themeObserver = new MutationObserver(() => {
      if (isDark() === dark) return;
      dark = isDark();
      for (const layer of layers) {
        Array.from(layer.tiles.keys()).forEach((i) => dropTile(layer, i));
        layer.pending.clear();
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

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(birdTimer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisible);
      motionMq.removeEventListener('change', onMotion);
      themeObserver.disconnect();
      birds.replaceChildren();
      for (const layer of layers) {
        Array.from(layer.tiles.keys()).forEach((i) => dropTile(layer, i));
      }
    };
  }, []);

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
      data-ready={ready}
      className={cn('ink-landscape', `ink-landscape--${variant}`, className)}
    >
      {!ready && <div className="ink-landscape__placeholder" />}
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
