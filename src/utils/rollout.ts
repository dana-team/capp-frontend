import {
  ANNOTATION_ROLLOUT,
  CappResponse,
  RolloutAction,
  RolloutPhase,
  RolloutStage,
  RolloutStatusResponse,
} from '@/types/capp';

/** Go duration syntax, which is what the backend parses. */
export const DURATION_RE = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;

const UNIT_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, 'µs': 1e-3, ms: 1, s: 1_000, m: 60_000, h: 3_600_000 };

export function durationMs(duration: string): number {
  let total = 0;
  for (const [, value, unit] of duration.matchAll(/(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g)) {
    total += Number(value) * UNIT_MS[unit];
  }
  return total;
}

/** The backend echoes Go's long form: "5m0s" reads and compares as "5m". */
export function shortDuration(duration: string | undefined): string {
  return (duration ?? '').replace(/(\D)0s$/, '$1').replace(/h0m$/, 'h');
}

/** e.g. 372000 → "6m 12s". */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** The action waiting for the operator to consume it, if any. */
export function pendingRolloutAction(capp: CappResponse): { action: string; revision: string } | undefined {
  const value = capp.annotations?.[ANNOTATION_ROLLOUT];
  if (!value) return undefined;
  const separator = value.indexOf(':');
  return separator < 0
    ? { action: value, revision: '' }
    : { action: value.slice(0, separator), revision: value.slice(separator + 1) };
}

const PROMOTE_ABORT_PHASES: RolloutPhase[] = ['Progressing', 'Holding', 'Promoting', 'Failed'];
const RETRY_PHASES: RolloutPhase[] = ['Failed', 'RolledBack', 'Aborted'];

/** Same rules as the backend's validateRolloutAction, so a button only shows when it can apply. */
export function allowedRolloutActions(capp: CappResponse): RolloutAction[] {
  const status = capp.status?.rollout;
  if (!capp.routeSpec?.rolloutStrategy || !status?.candidateRevision || !status.phase) return [];
  if (pendingRolloutAction(capp)) return [];

  const actions: RolloutAction[] = [];
  if (PROMOTE_ABORT_PHASES.includes(status.phase)) actions.push('promote', 'abort');
  if (RETRY_PHASES.includes(status.phase) || (status.phase === 'Holding' && status.heldPercent != null)) {
    actions.push('retry');
  }
  return actions;
}

export function rolloutIsActive(capp: CappResponse): boolean {
  const phase = capp.status?.rollout?.phase;
  return Boolean(pendingRolloutAction(capp)) || (phase !== undefined && PROMOTE_ABORT_PHASES.includes(phase));
}

export function shouldShowRollout(status: RolloutStatusResponse | undefined): status is RolloutStatusResponse {
  return Boolean(status && (status.pinnedRevision || (status.phase && status.phase !== 'Stable')));
}

/** The candidate's current share of traffic. */
export function candidatePercent(status: RolloutStatusResponse, stages: RolloutStage[]): number {
  if (status.heldPercent != null) return status.heldPercent;
  const served = status.traffic?.find((t) => t.revisionName === status.candidateRevision);
  return served?.percent ?? stages[status.stageIndex]?.percent ?? 0;
}
