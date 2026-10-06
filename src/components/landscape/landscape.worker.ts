import { begin, ensure, renderLayer } from '@/vendor/shanshui/shanshui.js';
import { GEN_HEIGHT, TILE_H, TILE_W } from './landscapeConfig';

export interface TileRequest {
  id: number;
  seed: string;
  layer: number;
  index: number;
}

export type TileResponse =
  | { id: number; blob: Blob }
  | { id: number; error: string };

let currentSeed: string | null = null;

// Runs the (CPU-heavy) generator off the main thread. The worker keeps the generator
// state between requests, so consecutive tiles of one seed join seamlessly. The vendor
// code overrides the worker's own global Math.random, which is safe here.
self.onmessage = (e: MessageEvent<TileRequest>) => {
  const { id, seed, layer, index } = e.data;
  try {
    if (currentSeed !== seed) {
      begin({ seed, height: GEN_HEIGHT });
      currentSeed = seed;
    }
    const xmin = index * TILE_W;
    const xmax = xmin + TILE_W;
    // Always extend from 0: keeps the PRNG sequence identical regardless of request order.
    ensure(0, xmax + 700);
    const markup = renderLayer(layer, xmin, xmax);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${xmin} 0 ${TILE_W} ${TILE_H}" ` +
      `width="${TILE_W}" height="${TILE_H}">${markup}</svg>`;
    const msg: TileResponse = { id, blob: new Blob([svg], { type: 'image/svg+xml' }) };
    (self as unknown as Worker).postMessage(msg);
  } catch (err) {
    const msg: TileResponse = { id, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(msg);
  }
};
