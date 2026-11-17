import type { Tone } from '@/components/layout/StatTile';
import type {
  CfuncCondition,
  FunctionRequest,
  FunctionResponse,
  FunctionTrigger,
  PoolResponse,
} from '@/types/cfunc';

export interface Health {
  tone: Tone;
  label: string;
  /** Why the object is not ready, when the backend says so. */
  detail?: string;
}

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-muted',
};

function conditionsHealth(conditions: CfuncCondition[] | undefined): Health {
  const list = conditions ?? [];
  const failed = list.find((c) => c.status === 'False');
  if (failed) return { tone: 'danger', label: 'Not ready', detail: failed.message || failed.reason };
  if (list.some((c) => c.status === 'Unknown')) return { tone: 'warning', label: 'Unknown' };
  return { tone: 'success', label: 'Ready' };
}

export function poolHealth(pool: PoolResponse): Health {
  return conditionsHealth(pool.status?.conditions);
}

const TRIGGER_OK = new Set(['RouteAdmitted', 'CronRegistered']);

/** A trigger has no status right after a write, which is not a failure. */
export function triggerTone(trigger: FunctionTrigger): Tone {
  if (!trigger.status) return 'neutral';
  return TRIGGER_OK.has(trigger.status) ? 'success' : 'danger';
}

export function functionHealth(fn: FunctionResponse): Health {
  const build = fn.build?.status ?? '';
  if (build === 'failed') {
    return { tone: 'danger', label: 'Build failed', detail: 'Down: calls fail until a build succeeds' };
  }
  if (build === 'pending' || build === 'running') return { tone: 'warning', label: 'Building' };
  if (build === '') return { tone: 'warning', label: 'Pending' };
  const badTrigger = (fn.triggers ?? []).find((t) => triggerTone(t) === 'danger');
  if (badTrigger) {
    return {
      tone: 'danger',
      label: 'Trigger not ready',
      detail: `${badTrigger.name}: ${badTrigger.message || badTrigger.status}`,
    };
  }
  return conditionsHealth(fn.status?.conditions);
}

export const isBuilding = (fn: FunctionResponse) =>
  fn.build?.status === '' || fn.build?.status === 'pending' || fn.build?.status === 'running';

/**
 * The body that replaces a function with itself. PUT is a full replace, so
 * everything the response carries goes back; the backend ignores the
 * response-only fields.
 */
export function toFunctionRequest(fn: FunctionResponse): FunctionRequest {
  return {
    name: fn.name,
    pool: fn.pool,
    source: { url: fn.source.url, ref: fn.source.ref, path: fn.source.path, build: fn.source.build },
    entrypoint: fn.entrypoint,
    timeoutSeconds: fn.timeoutSeconds,
    secretVolumes: fn.secretVolumes?.map((v) => ({ secretName: v.secretName })),
    configMapVolumes: fn.configMapVolumes?.map((v) => ({ configMapName: v.configMapName })),
    triggers: (fn.triggers ?? []).map(({ name, type, path, methods, schedule }) => ({
      name, type, path, methods, schedule,
    })),
    advanced: fn.advanced,
  };
}

const SAVED_BUT_INCOMPLETE = /^function \S+ (is|and its code are) saved, but /;

/** The backend saved the function but not all of it; the same body in a PUT finishes it. */
export const isPartialSave = (message: string | undefined) => SAVED_BUT_INCOMPLETE.test(message ?? '');
