/** Shared by the worker, the cache and the renderer. */

/** Bump when the generator split / tile geometry changes (invalidates IndexedDB entries). */
export const CACHE_VERSION = 'v3';
/** Generator height passed to the vendor code (before its internal zoom). */
export const GEN_HEIGHT = 800;
export const ZOOM = 1.142;
/** viewBox height of every tile. */
export const TILE_H = GEN_HEIGHT / ZOOM;
/** viewBox width (generator units) covered by one tile. */
export const TILE_W = 2000;
export const LAYER_COUNT = 3;
