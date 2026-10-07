/** Shared by the worker, the cache and the renderer. */

/** Bump when the generator split / tile geometry / raster format changes (invalidates IndexedDB entries). */
export const CACHE_VERSION = 'v4';
/** Generator height passed to the vendor code (before its internal zoom). */
export const GEN_HEIGHT = 800;
export const ZOOM = 1.142;
/** viewBox height of every tile. */
export const TILE_H = GEN_HEIGHT / ZOOM;
/** viewBox width (generator units) covered by one tile. */
export const TILE_W = 2000;
export const LAYER_COUNT = 3;
/** Vertical overscan (css px each side) so pointer parallax never reveals an edge. */
export const OVERSCAN = 12;
/** Raster tiles never exceed this many pixels (keeps worker memory and encode time sane). */
export const MAX_TILE_PIXELS = 3_200_000;
/** Paper colours (theme.css `--background`) used for the blurred preview composite. */
export const PAPER_RGB = { light: [238, 241, 239], dark: [15, 20, 19] } as const;
/** Paper surface (theme.css `--surface`) and mist colours, used to pre-build the inactive theme. */
export const SURFACE_RGB = { light: [255, 255, 255], dark: [23, 29, 28] } as const;
export const MIST_RGB = { light: [255, 255, 255], dark: [150, 170, 190] } as const;
/** Opacity the dark tiles are shown at (kept in sync with InkLandscape.css). */
export const DARK_TILE_ALPHA = 0.9;
/** The localStorage copy of the preview must stay below this many base64 characters. */
export const PREVIEW_MAX_B64 = 60_000;

export type Theme = 'light' | 'dark';
