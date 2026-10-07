export interface ShanshuiOptions {
  /** Short string/number (<= ~16 chars); identical seeds give identical output. */
  seed: string | number;
  xmin?: number;
  xmax?: number;
  height?: number;
}

export interface ShanshuiResult {
  /** Inner SVG markup (no <svg> wrapper). */
  markup: string;
  /** viewBox origin x. */
  x: number;
  width: number;
  height: number;
}

export function generate(opts: ShanshuiOptions): ShanshuiResult;

export function begin(opts: { seed: string | number; height?: number }): void;
export function ensure(xmin: number, xmax: number): void;
/** layer: 0 far, 1 mid, 2 near. */
export function renderLayer(layer: number, xmin: number, xmax: number): string;
export const ZOOM: number;
