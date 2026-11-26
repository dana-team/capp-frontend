/**
 * Desired state for the mock backend: what capp-backend keeps in MongoDB, and how it compares
 * a record with the live object. Ported from internal/desiredstate and internal/resources/tracking.
 * Env: MOCK_DESIRED_STATE
 *  - on (default)
 *  - off         feature disabled: no drift in responses, 501 from the drift endpoints
 *  - down        MongoDB is unreachable: reads report `unavailable`, writes succeed with a
 *                warning and are not recorded, and requests about the desired state answer 503
 */
import { createHmac, randomBytes } from 'node:crypto';
import type { NamespaceItem } from '../src/api/namespaces';
import { ANNOTATION_ROLLOUT } from '../src/types/capp';
import { RESTARTED_AT_ANNOTATION, RESTART_REASON_ANNOTATION, ROLLOUT_ON_BOUND_CHANGE_ANNOTATION } from '../src/types/capp';
import type { BareCappResponse, Warning } from '../src/types/capp';
import type { ConfigMapResponse } from '../src/types/configmap';
import type { Drift, DriftActionRequest, DriftField, DriftMissing } from '../src/types/drift';
import type { SecretResponse } from '../src/types/secret';

const MODES = ['on', 'off', 'down'] as const;
export type DesiredStateMode = (typeof MODES)[number];

const envMode = process.env.MOCK_DESIRED_STATE;
export const desiredStateMode: DesiredStateMode = MODES.find((m) => m === envMode) ?? 'on';
if (envMode && envMode !== desiredStateMode) {
  console.warn(`[mock] unknown MOCK_DESIRED_STATE "${envMode}", using ${desiredStateMode}`);
}

/** A failed request, in the backend's error format. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const driftDetected = (message: string, drift: Drift) => new ApiError(409, 'DRIFT_DETECTED', message, { drift });
const storeUnavailable = () =>
  new ApiError(503, 'DESIRED_STATE_FAILED', 'the desired state store is unavailable; nothing was changed, retry the request');

/** The onDrift query parameters of an update: the decision, and the drift it is about when given. */
export interface OnDrift {
  action?: string;
  liveVersion?: string;
  generation?: number;
}

// ── Projection ───────────────────────────────────────────────────────────────

/** The objects that have a desired state, by kind. */
export interface Tracked {
  Capp: BareCappResponse;
  ConfigMap: ConfigMapResponse;
  Secret: SecretResponse;
  Namespace: NamespaceItem;
}
export type Kind = keyof Tracked;

export interface Ref<K extends Kind = Kind> {
  cluster: string;
  kind: K;
  /** For a Namespace, its own name. */
  namespace: string;
  name: string;
}

type Tree = Record<string, unknown>;

interface State {
  tree: Tree;
  /** Secret values: compared, but never reported. */
  secret: Record<string, string>;
}

/** Written by the operator or by the backend as a side effect, so not desired state. */
const DROPPED_ANNOTATIONS = new Set([
  'rcs.dana.io/last-updated-by',
  'rcs.dana.io/skip-dns-check',
  ANNOTATION_ROLLOUT,
  'capp.dana.io/bound-resource-versions',
  RESTARTED_AT_ANNOTATION,
  RESTART_REASON_ANNOTATION,
  ROLLOUT_ON_BOUND_CHANGE_ANNOTATION,
]);
const KUBECTL_PREFIX = 'kubectl.kubernetes.io/';
/** Left on Capps by the removed Git sync. */
const LABEL_BACKUP_TO_GIT = 'rcs.dana.io/backup-to-git';

type Metadata = { labels?: Record<string, string>; annotations?: Record<string, string> };

/** The labels and annotations that are desired state. */
export function trackedMetadata(o: Metadata): Required<Metadata> {
  const { [LABEL_BACKUP_TO_GIT]: _leftover, ...labels } = o.labels ?? {};
  const annotations = Object.fromEntries(
    Object.entries(o.annotations ?? {}).filter(([k]) => !DROPPED_ANNOTATIONS.has(k) && !k.startsWith(KUBECTL_PREFIX)),
  );
  return { labels, annotations };
}

const isObject = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An absent value equals an empty one: the API server and the Go types do not agree on which they use. */
function isEmpty(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || (isObject(v) && Object.keys(v).length === 0);
}

/** Go's omitempty for strings, booleans, lists and maps. Keeps 0, because those numbers are pointers in Go. */
function omitEmpty(o: object): Tree {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => !isEmpty(v) && v !== '' && v !== false));
}

/** The Capp spec as Kubernetes holds it, because drift paths point into it. */
function cappSpec(c: BareCappResponse): Tree {
  const secretVolumes = c.secretVolumes ?? [];
  const configMapVolumes = c.configMapVolumes ?? [];
  return {
    ...omitEmpty({ state: c.state }),
    scaleSpec: omitEmpty(c.scaleSpec),
    configurationSpec: {
      template: {
        spec: omitEmpty({
          containers: [
            {
              ...omitEmpty({
                name: c.containerName,
                image: c.image,
                ports: c.containerPort === undefined ? undefined : [{ containerPort: c.containerPort }],
                env: c.env?.map(omitEmpty),
                volumeMounts: [...(c.volumeMounts ?? []), ...secretVolumes, ...configMapVolumes].map((v) => ({
                  name: v.name,
                  mountPath: v.mountPath,
                })),
              }),
              resources: omitEmpty(c.resources ?? {}),
            },
          ],
          imagePullSecrets: c.imagePullSecrets?.map((name) => ({ name })),
          volumes: [
            ...secretVolumes.map((v) => ({ name: v.name, secret: { secretName: v.secretName } })),
            ...configMapVolumes.map((v) => ({ name: v.name, configMap: { name: v.configMapName } })),
          ],
        }),
      },
    },
    routeSpec: omitEmpty(c.routeSpec ?? {}),
    logSpec: omitEmpty(c.logSpec ?? {}),
    volumesSpec: omitEmpty({
      nfsVolumes: c.nfsVolumes?.map(({ capacity, ...v }) => ({ ...v, capacity: { storage: capacity } })),
    }),
  };
}

const projections: { [K in Kind]: (o: Tracked[K]) => State } = {
  Capp: (c) => ({
    tree: {
      metadata: trackedMetadata(c),
      reloadOnBoundResourceChange: Boolean(c.reloadOnBoundResourceChange),
      spec: cappSpec(c),
    },
    secret: {},
  }),
  ConfigMap: (m) => ({ tree: { metadata: trackedMetadata(m), ...omitEmpty({ data: m.data }) }, secret: {} }),
  Secret: (s) => ({ tree: { metadata: trackedMetadata(s), type: s.type }, secret: s.data }),
  Namespace: (ns) => ({
    tree: omitEmpty({
      quota: omitEmpty({ cpu: ns.quota?.cpu, memory: ns.quota?.memory, pods: ns.quota?.pods || undefined }),
      users: [...new Set(ns.users)].sort(),
    }),
    secret: {},
  }),
};

function stateOf<K extends Kind>(kind: K, o: Tracked[K]): State {
  return projections[kind](o);
}

/** JSON with sorted keys, for order-insensitive deep equality. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

const versionKey = randomBytes(32);

/** Opaque token that changes whenever the state does. */
const versionOf = (s: State) => createHmac('sha256', versionKey).update(canonical(s)).digest('base64url').slice(0, 32);

// ── Comparison ───────────────────────────────────────────────────────────────

const escape = (k: string) => k.replaceAll('~', '~0').replaceAll('/', '~1');
const unionKeys = (a: object = {}, b: object = {}) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();

const QUANTITY_UNITS: Record<string, number> = {
  n: 1e-9, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18,
  Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50, Ei: 2 ** 60,
};

function parseQuantity(v: string): number | undefined {
  const m = /^([+-]?\d+(?:\.\d+)?)([numkMGTPE]|[KMGTPE]i)?$/.exec(v);
  return m ? Number(m[1]) * QUANTITY_UNITS[m[2] ?? ''] : undefined;
}

const isQuantity = (path: string) =>
  /\/resources\/(requests|limits)\/|\/capacity\//.test(path) || path === '/quota/cpu' || path === '/quota/memory';

function equalLeaf(path: string, desired: unknown, live: unknown): boolean {
  if (canonical(desired) === canonical(live)) return true;
  if (typeof desired !== 'string' || typeof live !== 'string' || !isQuantity(path)) return false;
  const want = parseQuantity(desired);
  return want !== undefined && want === parseQuantity(live);
}

function compareValues(fields: DriftField[], path: string, desired: unknown, live: unknown): void {
  if (isEmpty(desired) && isEmpty(live)) return;
  if (isObject(desired) && isObject(live)) {
    for (const k of unionKeys(desired, live)) compareValues(fields, `${path}/${escape(k)}`, desired[k], live[k]);
    return;
  }
  if (Array.isArray(desired) && Array.isArray(live) && desired.length === live.length) {
    desired.forEach((d, i) => compareValues(fields, `${path}/${i}`, d, live[i]));
    return;
  }
  if (!equalLeaf(path, desired, live)) fields.push({ path, desired, live });
}

/** The fields in which `live` differs from `desired`, ordered by path. */
function compare(kind: Kind, desired: State, live: State): DriftField[] {
  const fields: DriftField[] = [];
  for (const k of unionKeys(desired.tree, live.tree)) {
    if (k !== 'metadata') {
      compareValues(fields, `/${escape(k)}`, desired.tree[k], live.tree[k]);
      continue;
    }
    // Only the keys the record names: controllers add their own, and those are not drift.
    const want = desired.tree.metadata as Required<Metadata>;
    const got = live.tree.metadata as Required<Metadata>;
    for (const group of ['annotations', 'labels'] as const) {
      for (const [name, value] of Object.entries(want[group])) {
        compareValues(fields, `/metadata/${group}/${escape(name)}`, value, got[group][name]);
      }
    }
  }
  for (const k of unionKeys(desired.secret, live.secret)) {
    if (desired.secret[k] !== live.secret[k]) fields.push({ path: `/data/${escape(k)}` });
  }
  const byPath = fields.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return kind === 'Secret' ? byPath.map(({ path }) => ({ path })) : byPath;
}

// ── Records ──────────────────────────────────────────────────────────────────

interface DesiredRecord {
  ref: Ref;
  /** The object as it was recorded. */
  object: Tracked[Kind];
  generation: number;
  /** Set when the caller accepted that the object is gone: kept, but out of drift detection. */
  archived: boolean;
  updatedBy?: string;
  updatedAt: string;
}

const idOf = (r: Ref) => `${r.cluster}/${r.kind}/${r.namespace}/${r.name}`;
export const namespaceRef = (cluster: string, name: string): Ref<'Namespace'> => ({ cluster, kind: 'Namespace', namespace: name, name });

const timestamp = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * The records of one mock backend. Like the backend, callers write to the cluster first:
 * `startFrom` for updates, the cluster write, then `save`. The store being down never stops a write.
 */
export class DesiredState {
  private records = new Map<string, DesiredRecord>();
  private pendingWarnings: Warning[] = [];
  private actor = '';

  constructor(private readonly mode: DesiredStateMode) {}

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  reset(): void {
    this.records.clear();
    this.startRequest('');
  }

  /** `actor` is recorded as updatedBy by the request's writes. */
  startRequest(actor: string): void {
    this.actor = actor;
    this.pendingWarnings = [];
  }

  /** Records `object` regardless of the mode, so that seeded data starts in sync. */
  seed<K extends Kind>(ref: Ref<K>, object: Tracked[K], updatedBy: string, updatedAt: number): void {
    this.put(ref, object, { updatedBy, updatedAt });
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /** Drift of one object, or undefined when there is nothing to compare. `live` is undefined when it does not exist. */
  inspect<K extends Kind>(ref: Ref<K>, live: Tracked[K] | undefined): Drift | undefined {
    if (!this.enabled) return undefined;
    return this.mode === 'down' ? { state: 'unavailable' } : this.evaluate(ref, live);
  }

  /** Recorded objects of a kind that no longer exist, in one namespace or in the whole cluster. */
  missing(cluster: string, kind: Kind, namespace: string | undefined, exists: (namespace: string, name: string) => boolean): DriftMissing[] {
    if (!this.enabled || this.mode === 'down') return [];
    return [...this.records.values()]
      .filter(({ ref, archived }) => !archived && ref.cluster === cluster && ref.kind === kind)
      .filter(({ ref }) => (namespace === undefined || ref.namespace === namespace) && !exists(ref.namespace, ref.name))
      .map(({ ref }) => ({ namespace: ref.namespace, name: ref.name, drift: this.evaluate(ref, undefined)! }))
      .sort((a, b) => (`${a.namespace}/${a.name}` < `${b.namespace}/${b.name}` ? -1 : 1));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Decides what an update of `live` starts from: 'live' or 'desired'.
   * Throws 409 when the object has drifted and the caller did not say what to do, or when it
   * named a drift (liveVersion, generation) that is no longer the current one.
   */
  startFrom<K extends Kind>(ref: Ref<K>, live: Tracked[K], onDrift: OnDrift = {}): 'live' | 'desired' {
    const { action, liveVersion, generation } = onDrift;
    if (!this.enabled) return 'live';
    if (action && action !== 'accept' && action !== 'revert') {
      throw new ApiError(400, 'BAD_REQUEST', 'onDrift must be "accept" or "revert"');
    }
    if (generation !== undefined && !(Number.isInteger(generation) && generation >= 0)) {
      throw new ApiError(400, 'BAD_REQUEST', 'generation must be a non-negative integer');
    }
    if (this.mode === 'down') {
      if (action === 'revert') throw storeUnavailable();
      return 'live';
    }
    const drift = this.evaluate(ref, live);
    if (drift?.state !== 'changed') return 'live';
    if (!action) {
      throw driftDetected(
        'the object differs from its desired state; repeat the request with onDrift=accept to keep the live changes, or onDrift=revert to discard them',
        drift,
      );
    }
    if ((liveVersion !== undefined && liveVersion !== drift.liveVersion) || (generation !== undefined && generation !== drift.generation)) {
      throw driftDetected('the object or its desired state changed since its drift was shown; review the drift again', drift);
    }
    return action === 'revert' ? 'desired' : 'live';
  }

  /** The recorded object. Undefined when there is no active record. */
  desired<K extends Kind>(ref: Ref<K>): Tracked[K] | undefined {
    const record = this.active(ref);
    return record && structuredClone(record.object as Tracked[K]);
  }

  /** Records the object the cluster returned. */
  save<K extends Kind>(ref: Ref<K>, live: Tracked[K]): void {
    if (!this.enabled) return;
    if (this.mode === 'down') return this.warn();
    this.put(ref, live);
  }

  /** Removes the record of a deleted object. */
  forget(ref: Ref): void {
    if (!this.enabled) return;
    if (this.mode === 'down') return this.warn();
    this.records.delete(idOf(ref));
  }

  /** Removes every record of a deleted namespace. */
  forgetNamespace(cluster: string, namespace: string): void {
    if (!this.enabled) return;
    if (this.mode === 'down') return this.warn();
    for (const [id, { ref }] of this.records) {
      if (ref.cluster === cluster && ref.namespace === namespace) this.records.delete(id);
    }
  }

  /** Warnings of the current request's writes so far. */
  takeWarnings(): Warning[] {
    return this.pendingWarnings.splice(0);
  }

  // ── Revert, accept, adopt ──────────────────────────────────────────────────

  /** For requests that are about the desired state: throws 501 when the feature is off, 503 when the store is down. */
  require(): void {
    if (!this.enabled) {
      throw new ApiError(501, 'NOT_SUPPORTED', 'operation "drift" is not supported in the current configuration');
    }
    if (this.mode === 'down') throw storeUnavailable();
  }

  /** Throws unless the object and its record still are what the caller of a revert or accept saw. */
  confirm<K extends Kind>(ref: Ref<K>, live: Tracked[K] | undefined, seen: DriftActionRequest): Drift {
    this.require();
    const drift = this.evaluate(ref, live);
    if (!drift) throw new ApiError(404, 'NOT_FOUND', `${ref.kind} "${ref.name}" not found`);
    if (seen.generation !== (drift.generation ?? 0) || (seen.liveVersion ?? '') !== (drift.liveVersion ?? '')) {
      throw driftDetected('the object or its desired state changed; review the drift again', drift);
    }
    return drift;
  }

  /** Records the live object, or archives the record of one that is gone. Returns the drift that is left. */
  accept<K extends Kind>(ref: Ref<K>, live: Tracked[K] | undefined): Drift | undefined {
    if (live) this.put(ref, live);
    else {
      const record = this.active(ref);
      if (record) this.records.set(idOf(ref), { ...record, ...this.stamp(), generation: record.generation + 1, archived: true });
    }
    return this.active(ref) && this.evaluate(ref, live);
  }

  /** Records the live object if it has no desired state yet. Returns whether it did. */
  adopt<K extends Kind>(ref: Ref<K>, live: Tracked[K]): boolean {
    if (this.active(ref)) return false;
    this.put(ref, live);
    return true;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private active(ref: Ref): DesiredRecord | undefined {
    const record = this.records.get(idOf(ref));
    return record?.archived ? undefined : record;
  }

  private evaluate<K extends Kind>(ref: Ref<K>, live: Tracked[K] | undefined): Drift | undefined {
    const record = this.records.get(idOf(ref));
    const active = this.active(ref);
    if (!live && !active) return undefined;
    const known = {
      ...(record ? { generation: record.generation } : {}),
      ...(active ? { updatedAt: active.updatedAt, ...(active.updatedBy ? { updatedBy: active.updatedBy } : {}) } : {}),
    };
    if (!live) return { state: 'missing', ...known };
    const state = stateOf(ref.kind, live);
    const compared = { ...known, liveVersion: versionOf(state) };
    if (!active) return { state: 'unmanaged', ...compared };
    const fields = compare(ref.kind, stateOf(ref.kind, active.object as Tracked[K]), state);
    return fields.length ? { state: 'changed', ...compared, fields } : { state: 'inSync', ...compared };
  }

  private stamp(): Pick<DesiredRecord, 'updatedBy' | 'updatedAt'> {
    return { updatedBy: this.actor, updatedAt: timestamp(Date.now()) };
  }

  private put<K extends Kind>(ref: Ref<K>, live: Tracked[K], by?: { updatedBy: string; updatedAt: number }): void {
    const record = this.records.get(idOf(ref));
    if (record && !record.archived && canonical(stateOf(ref.kind, record.object as Tracked[K])) === canonical(stateOf(ref.kind, live))) return;
    this.records.set(idOf(ref), {
      ref,
      object: structuredClone(live),
      generation: (record?.generation ?? 0) + 1,
      archived: false,
      ...(by ? { updatedBy: by.updatedBy, updatedAt: timestamp(by.updatedAt) } : this.stamp()),
    });
  }

  private warn(): void {
    this.pendingWarnings.push({
      code: 'DESIRED_STATE_FAILED',
      message: 'the change was made but not backed up, because its desired state could not be recorded; it will show as drift',
    });
  }
}
