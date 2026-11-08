/**
 * Staged rollouts for the mock backend: what the operator does to status.rollout,
 * driven by the clock on each read, plus the backend's and webhook's checks.
 */
import { ANNOTATION_ROLLOUT } from '../src/types/capp';
import type {
  CappResponse,
  RevisionTraffic,
  RolloutAction,
  RolloutStage,
  RolloutStatusResponse,
  RolloutStrategy,
} from '../src/types/capp';

/** How long the "operator" takes to consume an action annotation. */
const ACTION_DELAY_MS = 3_000;
/** How long a promotion takes to reach 100%. */
const PROMOTE_MS = 4_000;

const UNIT_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 };
const GO_DURATION = /^(\d+(\.\d+)?(ms|s|m|h))+$/;

function parseDuration(value: string): number | undefined {
  if (!GO_DURATION.test(value)) return undefined;
  let total = 0;
  for (const [, n, unit] of value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) total += Number(n) * UNIT_MS[unit];
  return total;
}

/** Same text as Go's Duration.String(), which is what the backend echoes. */
function goDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${m}m${s}s`;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

const timestamp = (now: number) => new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The operator webhook's rules. Returns the denial message, if any. */
export function strategyError(strategy: RolloutStrategy): string | undefined {
  const { stages } = strategy;
  if (!Array.isArray(stages) || stages.length === 0) return 'rolloutStrategy: at least one stage is required';
  for (let i = 0; i < stages.length; i++) {
    const { percent, duration } = stages[i];
    if (typeof percent !== 'number' || percent < 0 || percent > 100) return `rolloutStrategy: stage ${i}: percent must be between 0 and 100`;
    if (i > 0 && percent <= stages[i - 1].percent) return `rolloutStrategy: stage ${i}: percent must be greater than the previous stage`;
    if (i === stages.length - 1) {
      if (duration) return 'rolloutStrategy: the last stage must not set a duration';
    } else if (!duration) {
      return `rolloutStrategy: stage ${i}: duration is required on every stage except the last`;
    } else if (!parseDuration(duration)) {
      return `rolloutStrategy: stage ${i}: invalid duration "${duration}"`;
    }
  }
  if (strategy.progressDeadline && !parseDuration(strategy.progressDeadline)) {
    return `rolloutStrategy: invalid progressDeadline "${strategy.progressDeadline}"`;
  }
  return undefined;
}

/** The strategy as the backend stores and echoes it. */
export function normalizeStrategy(strategy: RolloutStrategy): RolloutStrategy {
  return {
    stages: strategy.stages.map((s): RolloutStage => ({
      percent: s.percent,
      ...(s.duration ? { duration: goDuration(parseDuration(s.duration)!) } : {}),
    })),
    ...(strategy.autoRollback ? { autoRollback: true } : {}),
    progressDeadline: goDuration(parseDuration(strategy.progressDeadline || '10m')!),
  };
}

function splitTraffic(status: RolloutStatusResponse, percent: number): RevisionTraffic[] {
  return [
    { revisionName: status.stableRevision ?? '', percent: 100 - percent, tag: 'stable' },
    ...(status.candidateRevision ? [{ revisionName: status.candidateRevision, percent, tag: 'candidate' }] : []),
  ];
}

const allStable = (status: RolloutStatusResponse): RevisionTraffic[] => [
  { revisionName: status.stableRevision ?? '', percent: 100, tag: 'stable' },
];

function enterStage(status: RolloutStatusResponse, stages: RolloutStage[], index: number, now: number): void {
  const { percent } = stages[index];
  status.stageIndex = index;
  status.stageStartTime = timestamp(now);
  status.traffic = splitTraffic(status, percent);
  if (index < stages.length - 1) {
    status.phase = 'Progressing';
    status.message = `Holding ${percent}% for the stage duration`;
  } else if (percent === 100) {
    status.phase = 'Promoting';
    status.message = 'Waiting for the candidate to serve all traffic';
  } else {
    status.phase = 'Holding';
    status.message = 'Waiting for promote or abort';
  }
}

/** The candidate becomes stable and the rollout ends. */
function finishPromotion(status: RolloutStatusResponse): void {
  status.stableRevision = status.candidateRevision;
  delete status.candidateRevision;
  delete status.heldPercent;
  delete status.stageStartTime;
  delete status.candidateSince;
  delete status.message;
  status.phase = 'Stable';
  status.stageIndex = 0;
  status.traffic = allStable(status);
}

function applyAction(capp: CappResponse, status: RolloutStatusResponse, action: string, now: number): void {
  if (action === 'promote') {
    // The real operator refuses this with only a Warning event, so nothing changes.
    if (!status.candidateReadyOnce) return;
    delete status.heldPercent;
    status.phase = 'Promoting';
    status.stageStartTime = timestamp(now);
    status.traffic = splitTraffic(status, 100);
    status.message = 'Waiting for the candidate to serve all traffic';
  } else if (action === 'abort') {
    delete status.heldPercent;
    status.phase = 'Aborted';
    status.traffic = allStable(status);
    status.message = 'Aborted by user';
  } else if (action === 'retry') {
    delete status.heldPercent;
    enterStage(status, capp.routeSpec?.rolloutStrategy?.stages ?? [{ percent: 100 }], 0, now);
  }
}

const pendingSince = new Map<string, number>();

/** Plays out everything due by `now`. Returns true when the capp changed. */
export function tickRollout(capp: CappResponse, now: number): boolean {
  const status = capp.status.rollout;
  if (!status) return false;
  let changed = false;

  const pending = capp.annotations?.[ANNOTATION_ROLLOUT];
  if (pending) {
    const id = capp.uid ?? capp.name;
    const since = pendingSince.get(id);
    if (since === undefined) {
      pendingSince.set(id, now);
    } else if (now - since >= ACTION_DELAY_MS) {
      pendingSince.delete(id);
      const { [ANNOTATION_ROLLOUT]: _consumed, ...rest } = capp.annotations ?? {};
      if (Object.keys(rest).length) capp.annotations = rest;
      else delete capp.annotations;
      applyAction(capp, status, pending.split(':')[0], now);
      changed = true;
    }
  }

  const stages = capp.routeSpec?.rolloutStrategy?.stages;
  const started = status.stageStartTime ? Date.parse(status.stageStartTime) : undefined;
  if (stages && started !== undefined) {
    if (status.phase === 'Progressing') {
      const duration = parseDuration(stages[status.stageIndex]?.duration ?? '');
      if (duration !== undefined && now - started >= duration && status.stageIndex + 1 < stages.length) {
        enterStage(status, stages, status.stageIndex + 1, now);
        changed = true;
      }
    } else if (status.phase === 'Promoting' && now - started >= PROMOTE_MS) {
      finishPromotion(status);
      changed = true;
    }
  }
  return changed;
}

/** Same rules as the backend's validateRolloutAction. Returns the 409 message, if any. */
export function rolloutActionError(capp: CappResponse, action: RolloutAction, revision: string): string | undefined {
  if (!capp.routeSpec?.rolloutStrategy) return `Capp "${capp.name}" has no rollout strategy`;
  const status = capp.status.rollout;
  if (!status?.candidateRevision) return `Capp "${capp.name}" has no candidate revision`;
  const pending = capp.annotations?.[ANNOTATION_ROLLOUT];
  if (pending) return `rollout action "${pending}" is still pending`;
  if (revision !== status.candidateRevision) return `revision "${revision}" is not the current candidate "${status.candidateRevision}"`;

  const { phase } = status;
  const allowed =
    action === 'retry'
      ? phase === 'Failed' || phase === 'RolledBack' || phase === 'Aborted' || (phase === 'Holding' && status.heldPercent != null)
      : phase === 'Progressing' || phase === 'Holding' || phase === 'Promoting' || phase === 'Failed';
  return allowed ? undefined : `cannot ${action} a rollout in phase "${phase}"`;
}

export function requestRolloutAction(capp: CappResponse, action: RolloutAction, revision: string): void {
  capp.annotations = { ...capp.annotations, [ANNOTATION_ROLLOUT]: `${action}:${revision}` };
}

/** Promotes a Ready candidate, otherwise pins traffic to stable. */
export function removeStrategy(capp: CappResponse): void {
  if (capp.routeSpec) delete capp.routeSpec.rolloutStrategy;
  const { [ANNOTATION_ROLLOUT]: _dropped, ...rest } = capp.annotations ?? {};
  if (capp.annotations) capp.annotations = rest;
  const status = capp.status.rollout;
  if (!status?.candidateRevision) return;
  if (status.candidateReadyOnce) {
    finishPromotion(status);
    return;
  }
  status.pinnedRevision = status.stableRevision;
  delete status.candidateRevision;
  delete status.heldPercent;
  delete status.stageStartTime;
  delete status.candidateSince;
  status.phase = 'Stable';
  status.stageIndex = 0;
  status.traffic = allStable(status);
  status.message = 'Strategy removed; traffic pinned to the stable revision';
}

function nextRevision(capp: CappResponse, status: RolloutStatusResponse): string {
  const latest = status.candidateRevision ?? status.stableRevision ?? `${capp.name}-00001`;
  return latest.replace(/\d{5}$/, (n) => String(Number(n) + 1).padStart(5, '0'));
}

/** What creates a new Knative revision. */
const revisionFields = (c: CappResponse) =>
  JSON.stringify([c.image, c.containerName, c.env, c.resources, c.volumeMounts, c.nfsVolumes, c.secretVolumes, c.configMapVolumes]);

/** Status for a brand new capp with a strategy: its first revision is stable right away. */
export function initialRollout(capp: CappResponse): void {
  if (!capp.routeSpec?.rolloutStrategy) return;
  const status: RolloutStatusResponse = { phase: 'Stable', stageIndex: 0, stableRevision: `${capp.name}-00001` };
  status.traffic = allStable(status);
  capp.status.rollout = status;
}

/** Carries the rollout across an update, starting or holding it as the operator would. */
export function updateRollout(prev: CappResponse, next: CappResponse, now: number): void {
  const strategy = next.routeSpec?.rolloutStrategy;
  if (prev.status.rollout) next.status.rollout = structuredClone(prev.status.rollout);
  if (!strategy) return;
  if (!next.status.rollout) initialRollout(next);
  const status = next.status.rollout!;

  if (revisionFields(prev) !== revisionFields(next)) {
    status.candidateRevision = nextRevision(next, status);
    status.candidateSince = timestamp(now);
    status.candidateReadyOnce = true;
    delete status.heldPercent;
    delete status.pinnedRevision;
    enterStage(status, strategy.stages, 0, now);
    return;
  }

  const running = status.phase === 'Progressing' || status.phase === 'Holding';
  if (running && status.candidateRevision && JSON.stringify(prev.routeSpec?.rolloutStrategy) !== JSON.stringify(strategy)) {
    const held = status.traffic?.find((t) => t.revisionName === status.candidateRevision)?.percent ?? 0;
    status.heldPercent = held;
    status.phase = 'Holding';
    status.message = `Strategy changed; held at ${held}%`;
  }
}

export type RolloutScenario = 'progressing' | 'holding' | 'failed' | 'rolledBack' | 'stable';

const CANARY: RolloutStrategy = {
  stages: [{ percent: 10, duration: '1m' }, { percent: 50, duration: '3m' }, { percent: 100 }],
  autoRollback: true,
};

/** Puts a seeded capp into a rollout scenario. Short stages keep the demo moving. */
export function seedRollout(capp: CappResponse, scenario: RolloutScenario, now: number): void {
  const strategy = normalizeStrategy(
    scenario === 'holding' ? { stages: [{ percent: 50 }] }
    : scenario === 'failed' ? { ...CANARY, autoRollback: false }
    : CANARY,
  );
  capp.routeSpec = { ...capp.routeSpec, rolloutStrategy: strategy };

  const status: RolloutStatusResponse = { stableRevision: `${capp.name}-00001`, stageIndex: 0, phase: 'Stable' };
  capp.status.rollout = status;
  if (scenario === 'stable') {
    status.traffic = allStable(status);
    return;
  }

  status.candidateRevision = `${capp.name}-00002`;
  status.candidateSince = timestamp(now - 12 * 60_000);
  status.candidateReadyOnce = scenario !== 'failed';
  enterStage(status, strategy.stages, 0, now);

  if (scenario === 'failed') {
    status.phase = 'Failed';
    status.message = `Revision ${status.candidateRevision} did not become Ready within 10m0s`;
  } else if (scenario === 'rolledBack') {
    status.phase = 'RolledBack';
    status.traffic = allStable(status);
    status.message = `Revision ${status.candidateRevision} failed; traffic returned to ${status.stableRevision}`;
  }
}
