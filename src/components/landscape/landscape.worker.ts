import { begin, ensure, renderLayer } from '@/vendor/shanshui/shanshui.js';
import {
  GEN_HEIGHT,
  PREVIEW_MAX_B64,
  TILE_H,
  TILE_W,
  type Theme,
} from './landscapeConfig';

/**
 * Tile worker. Generates a tile's SVG markup and rasterizes it onto an OffscreenCanvas, so the
 * main thread only ever receives (and decodes off-thread) a finished WebP/PNG. The dark variant
 * is the light raster with its ink inverted (identical to the previous baked invert+hue-rotate
 * feColorMatrix, which maps the gray ink to `1 - v`). Without OffscreenCanvas 2D support the
 * worker falls back to returning an SVG blob (night filter baked in for the dark variant).
 */

export interface TileRequest {
  op: 'tile';
  id: number;
  seed: string;
  layer: number;
  index: number;
  theme: Theme;
  /** Raster height in device pixels (width follows the tile aspect). */
  pxH: number;
}

export interface PreviewLayer {
  seed: string;
  layer: number;
  index: number;
  /** Only sent when this worker did not render the tile itself (cache hit): needs a decode. */
  blob?: Blob;
  /** css px, relative to the viewport */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PreviewRequest {
  op: 'preview';
  id: number;
  theme: Theme;
  vw: number;
  vh: number;
  bg: readonly number[];
  alpha: number;
  layers: PreviewLayer[];
}

export type WorkerRequest = TileRequest | PreviewRequest;

export type WorkerResponse =
  | { id: number; kind: 'raster' | 'svg'; blob: Blob }
  | { id: number; kind: 'preview'; blob: Blob }
  | { id: number; error: string };

const post = (msg: WorkerResponse) => (self as unknown as Worker).postMessage(msg);

let currentSeed: string | null = null;

// ---- capability detection ----------------------------------------------------------------

type Canvas = OffscreenCanvas;
type Ctx = OffscreenCanvasRenderingContext2D;

const canRaster = (() => {
  try {
    return typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d');
  } catch {
    return false;
  }
})();

let rasterType: string | null = null;
const pickType = async (): Promise<string> => {
  if (rasterType) return rasterType;
  try {
    const c = new OffscreenCanvas(2, 2);
    c.getContext('2d');
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.85 });
    rasterType = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
  } catch {
    rasterType = 'image/png';
  }
  return rasterType;
};

// ---- SVG markup -> canvas ------------------------------------------------------------------

// The generator only emits <polyline points='..' style='fill:F;stroke:S;stroke-width:W'/> (plus
// debug-only text/circles that are never produced for tiles). <path d> is handled for safety.
const SHAPE_RE =
  /<(polyline|path)\s+(?:points|d)='([^']*)'\s+style='fill:([^;']*);stroke:([^;']*);stroke-width:([^']*)'/g;
const CLEAR_RE = /^(none|transparent|rgba\([^)]*,\s*0(\.0*)?\))$/;

const drawMarkup = (ctx: Ctx, markup: string) => {
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;
  SHAPE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SHAPE_RE.exec(markup))) {
    const [, tag, data, fill, stroke, widthStr] = m;
    const width = parseFloat(widthStr) || 0;
    const doFill = !CLEAR_RE.test(fill);
    const doStroke = width > 0 && !CLEAR_RE.test(stroke);
    if (!doFill && !doStroke) continue;
    if (tag === 'path') {
      const p = new Path2D(data);
      if (doFill) {
        ctx.fillStyle = fill;
        ctx.fill(p);
      }
      if (doStroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke(p);
      }
      continue;
    }
    const nums = data.trim().split(/[\s,]+/);
    if (nums.length < 4) continue;
    ctx.beginPath();
    ctx.moveTo(+nums[0], +nums[1]);
    for (let i = 2; i + 1 < nums.length; i += 2) ctx.lineTo(+nums[i], +nums[i + 1]);
    if (doFill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (doStroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
};

// Rendered light canvases, so the lazily requested second theme of a tile is cheap.
const LIGHT_CACHE_MAX = 6;
const lightCache = new Map<string, Canvas>();
const lightCanvas = (
  key: string,
  smallKey: string,
  markup: () => string,
  xmin: number,
  pxW: number,
  pxH: number,
): Canvas => {
  const hit = lightCache.get(key);
  if (hit) {
    lightCache.delete(key);
    lightCache.set(key, hit);
    return hit;
  }
  const canvas = new OffscreenCanvas(pxW, pxH);
  const ctx = canvas.getContext('2d') as Ctx;
  const sx = pxW / TILE_W;
  const sy = pxH / TILE_H;
  ctx.setTransform(sx, 0, 0, sy, -xmin * sx, 0);
  drawMarkup(ctx, markup());
  lightCache.set(key, canvas);
  rememberSmall(smallKey, canvas);
  if (lightCache.size > LIGHT_CACHE_MAX) lightCache.delete(lightCache.keys().next().value as string);
  return canvas;
};

// Small copies of every rendered tile for the preview composite. Decoding a blob in a worker
// is bounced through the main thread by some browsers, so the preview never decodes tiles.
const SMALL_H = 480;
const SMALL_MAX = 16;
const smalls = new Map<string, Canvas>();
const rememberSmall = (key: string, src: Canvas) => {
  const w = Math.round((SMALL_H * TILE_W) / TILE_H);
  const c = new OffscreenCanvas(w, SMALL_H);
  const ctx = c.getContext('2d') as Ctx;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, SMALL_H);
  smalls.set(key, c);
  if (smalls.size > SMALL_MAX) smalls.delete(smalls.keys().next().value as string);
};

let scratch: Canvas | null = null;
const invertInto = (src: Canvas, dst: Canvas): Canvas => {
  const w = src.width;
  const h = src.height;
  const img = (src.getContext('2d') as Ctx).getImageData(0, 0, w, h);
  const d = img.data;
  // Straight (unpremultiplied) RGB inverted, alpha kept: the ink turns pale, shape unchanged.
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  (dst.getContext('2d') as Ctx).putImageData(img, 0, 0);
  return dst;
};
const invertedCopy = (src: Canvas): Canvas => {
  if (!scratch || scratch.width !== src.width || scratch.height !== src.height) {
    scratch = new OffscreenCanvas(src.width, src.height);
  }
  return invertInto(src, scratch);
};

// ---- SVG fallback --------------------------------------------------------------------------

const NIGHT_FILTER =
  '<defs><filter id="n" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">' +
  '<feColorMatrix type="matrix" values="' +
  '0.574 -1.430 -0.144 0 1  -0.426 -0.430 -0.144 0 1  -0.426 -1.430 0.856 0 1  0 0 0 1 0"/>' +
  '</filter></defs>';

const svgBlob = (markup: string, xmin: number, theme: Theme): Blob => {
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${xmin} 0 ${TILE_W} ${TILE_H}" ` +
    `width="${TILE_W}" height="${TILE_H}">`;
  const body = theme === 'dark' ? `${NIGHT_FILTER}<g filter="url(#n)">${markup}</g>` : markup;
  return new Blob([head, body, '</svg>'], { type: 'image/svg+xml' });
};

// ---- handlers ------------------------------------------------------------------------------

const handleTile = async (req: TileRequest) => {
  const { id, seed, layer, index, theme, pxH } = req;
  if (currentSeed !== seed) {
    begin({ seed, height: GEN_HEIGHT });
    currentSeed = seed;
    lightCache.clear();
    smalls.clear();
  }
  const xmin = index * TILE_W;
  const xmax = xmin + TILE_W;
  // Always extend from 0: keeps the PRNG sequence identical regardless of request order.
  ensure(0, xmax + 700);
  const markup = () => renderLayer(layer, xmin, xmax);

  if (!canRaster || !pxH) {
    post({ id, kind: 'svg', blob: svgBlob(markup(), xmin, theme) });
    return;
  }
  const type = await pickType();
  const pxW = Math.round((pxH * TILE_W) / TILE_H);
  const key = `${seed}.${layer}.${index}.${pxH}`;
  const light = lightCanvas(key, `${seed}.${layer}.${index}`, markup, xmin, pxW, pxH);
  const source = theme === 'dark' ? invertedCopy(light) : light;
  const blob = await source.convertToBlob({ type, quality: 0.85 });
  post({ id, kind: 'raster', blob });
};

const handlePreview = async (req: PreviewRequest) => {
  const { id, theme, vw, vh, bg, alpha, layers } = req;
  if (!canRaster) throw new Error('no OffscreenCanvas');
  // Try progressively smaller / lower quality until the base64 copy fits localStorage.
  const attempts = [
    [480, 0.6],
    [420, 0.5],
    [360, 0.45],
    [300, 0.4],
  ];
  const sources: (CanvasImageSource & { close?: () => void })[] = [];
  for (const l of layers) {
    const small = smalls.get(`${l.seed}.${l.layer}.${l.index}`);
    if (small) {
      sources.push(theme === 'dark' ? invertInto(small, new OffscreenCanvas(small.width, small.height)) : small);
    } else if (l.blob) {
      sources.push(await createImageBitmap(l.blob)); // already themed
    } else {
      throw new Error('preview source missing');
    }
  }
  try {
    let best: Blob | null = null;
    const type = (await pickType()) === 'image/webp' ? 'image/webp' : 'image/jpeg';
    for (const [pw, quality] of attempts) {
      const s = pw / vw;
      const canvas = new OffscreenCanvas(pw, Math.max(1, Math.round(vh * s)));
      const ctx = canvas.getContext('2d') as Ctx;
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingQuality = 'high';
      layers.forEach((l, i) => ctx.drawImage(sources[i], l.x * s, l.y * s, l.w * s, l.h * s));
      best = await canvas.convertToBlob({ type, quality });
      if ((best.size * 4) / 3 + 40 <= PREVIEW_MAX_B64) break;
    }
    post({ id, kind: 'preview', blob: best as Blob });
  } finally {
    sources.forEach((b) => b.close?.());
  }
};

// Messages are handled strictly in order (the generator state is sequential).
let chain: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  chain = chain.then(async () => {
    try {
      if (req.op === 'preview') await handlePreview(req);
      else await handleTile(req);
    } catch (err) {
      post({ id: req.id, error: err instanceof Error ? err.message : String(err) });
    }
  });
};
