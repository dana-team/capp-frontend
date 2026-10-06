import type { CappResponse } from '@/types/capp';
import type { Tone } from '@/components/layout/StatTile';

/** Display-only health of a Capp, derived from its state and status conditions. */
export type CappHealth = 'ready' | 'progressing' | 'failed' | 'disabled';

export function cappHealth(c: CappResponse): CappHealth {
  if ((c.state ?? 'enabled') === 'disabled') return 'disabled';
  const conds = c.status?.conditions ?? [];
  const ready = conds.find((x) => x.type === 'Ready');
  if (ready) {
    return ready.status === 'True' ? 'ready' : ready.status === 'False' ? 'failed' : 'progressing';
  }
  if (conds.some((x) => x.status === 'False')) return 'failed';
  if (conds.length === 0 || conds.some((x) => x.status === 'Unknown')) return 'progressing';
  return 'ready';
}

export const HEALTH_TONE: Record<CappHealth, Tone> = {
  ready: 'success',
  progressing: 'warning',
  failed: 'danger',
  disabled: 'neutral',
};

export const HEALTH_LABEL: Record<CappHealth, string> = {
  ready: 'Ready',
  progressing: 'Progressing',
  failed: 'Failed',
  disabled: 'Disabled',
};

export const HEALTH_TEXT: Record<CappHealth, string> = {
  ready: 'text-success',
  progressing: 'text-warning',
  failed: 'text-danger',
  disabled: 'text-text-muted',
};
