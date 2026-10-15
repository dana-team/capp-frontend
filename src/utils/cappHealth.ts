import type { CappResponse } from '@/types/capp';
import type { Tone } from '@/components/layout/StatTile';

/** Display-only health of a Capp, derived from its state and status conditions. */
export type CappHealth = 'ready' | 'unknown' | 'failed' | 'disabled';

export function cappHealth(c: CappResponse): CappHealth {
  if ((c.state ?? 'enabled') === 'disabled') return 'disabled';
  const conds = c.status?.conditions ?? [];
  const ready = conds.find((x) => x.type === 'Ready');
  if (ready) {
    return ready.status === 'True' ? 'ready' : ready.status === 'False' ? 'failed' : 'unknown';
  }
  if (conds.some((x) => x.status === 'False')) return 'failed';
  if (conds.length === 0 || conds.some((x) => x.status === 'Unknown')) return 'unknown';
  return 'ready';
}

/** Badge variant for a condition status. Unknown uses warning, matching HEALTH_TONE. */
export function statusVariant(status: string): 'success' | 'danger' | 'warning' | 'default' {
  if (status === 'True') return 'success';
  if (status === 'False') return 'danger';
  if (status === 'Unknown') return 'warning';
  return 'default';
}

export const HEALTH_TONE: Record<CappHealth, Tone> = {
  ready: 'success',
  unknown: 'warning',
  failed: 'danger',
  disabled: 'neutral',
};

export const HEALTH_LABEL: Record<CappHealth, string> = {
  ready: 'Ready',
  unknown: 'Unknown',
  failed: 'Failed',
  disabled: 'Disabled',
};

export const HEALTH_TEXT: Record<CappHealth, string> = {
  ready: 'text-success',
  unknown: 'text-warning',
  failed: 'text-danger',
  disabled: 'text-text-muted',
};
