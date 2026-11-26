/**
 * In-memory store for the mock capp-backend.
 *
 * Conventions (HTTP layer maps these to status codes):
 *  - Unknown cluster / namespace / resource:
 *      get*      -> returns `undefined`            (404)
 *      list*     -> returns `undefined` when the cluster (or the namespace, if given)
 *                   does not exist, otherwise an array (possibly empty)   (404)
 *      update*, delete*, patch* -> return `undefined`                    (404)
 *  - Duplicates on create (and on create-through-migrate): throws `ConflictError`  (409)
 *  - Creating a resource in a namespace that does not exist: throws `NotFoundError` (404)
 *  - Desired state (see desired.ts): throws `ApiError`, which carries its own status. Writes
 *    leave their warnings in `desired.takeWarnings()`.
 *  - Cluster health is NOT enforced here; check `getCluster(c)?.healthy` in the HTTP layer (503).
 *  - Returned objects are the live store objects; treat them as read-only (JSON-serialise them).
 *
 * All DTO shapes come from the frontend types, so drift fails to compile.
 */
import { createHash } from 'node:crypto';
import { ANNOTATION_ROLLOUT } from '../src/types/capp';
import { cappConditions } from './conditions';
import { ApiError, canonical, DesiredState, desiredStateMode, namespaceRef, trackedMetadata, type Kind, type OnDrift, type Ref, type Tracked } from './desired';
import {
  initialRollout,
  normalizeStrategy,
  removeStrategy,
  requestRolloutAction,
  rolloutActionError,
  tickRollout,
  updateRollout,
} from './rollouts';
import type {
  BareCappResponse,
  CappRequest,
  CappResponse,
  CappRevisionResponse,
  CappSizesResponse,
  ClusterMeta,
  MigrateRequest,
  MigrateResponse,
  RolloutActionRequest,
} from '../src/types/capp';
import type { BoundCappsResponse, BoundResourceKind } from '../src/types/bound';
import type {
  ConfigMapRequest,
  ConfigMapResponse,
  ConfigMapUpdateRequest,
} from '../src/types/configmap';
import type { Drift, DriftActionRequest, DriftActionResponse, DriftAdoptResponse, DriftMissing } from '../src/types/drift';
import type { SecretRequest, SecretResponse, SecretUpdateRequest } from '../src/types/secret';
import type {
  CreateNamespaceRequest,
  NamespaceItem,
  NamespaceListResponse,
  PatchNamespaceRequest,
  UpdateNamespaceRequest,
} from '../src/api/namespaces';


export const SIZES: CappSizesResponse = {
  small: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '250m', memory: '256Mi' } },
  medium: { requests: { cpu: '250m', memory: '512Mi' }, limits: { cpu: '500m', memory: '1Gi' } },
  large: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '1', memory: '2Gi' } },
};

/** Operator default (CappConfig spec.revisionHistoryLimit). */
export const REVISION_HISTORY_LIMIT = 10;

/** Ignored by the operator when deciding whether a Capp changed. */
const ANNOTATION_LAST_UPDATED_BY = 'rcs.dana.io/last-updated-by';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export type MigrateResult =
  | { ok: true; data: MigrateResponse }
  | {
      ok: false;
      /** 400: bad_request; 404: source_not_found | target_cluster_not_found | target_namespace_not_found; 409: conflict */
      error:
        | 'bad_request'
        | 'source_not_found'
        | 'target_cluster_not_found'
        | 'target_namespace_not_found'
        | 'conflict';
      message: string;
    };

export type RollbackResult =
  | { ok: true; data: CappResponse }
  | { ok: false; error: 'revision_not_found' | 'capp_not_found'; message: string };

interface ClusterData {
  meta: ClusterMeta;
  namespaces: Map<string, NamespaceItem>;
  // capps / configmaps / secrets keyed `namespace/name`
  capps: Map<string, CappResponse>;
  configMaps: Map<string, ConfigMapResponse>;
  secrets: Map<string, SecretResponse>;
  // capp revisions keyed `namespace/cappName`, oldest first
  revisions: Map<string, CappRevisionResponse[]>;
}

const key = (ns: string, name: string) => `${ns}/${name}`;

function inNamespace<T>(map: Map<string, T>, ns?: string): T[] {
  const prefix = ns === undefined ? undefined : `${ns}/`;
  return [...map.entries()].filter(([k]) => prefix === undefined || k.startsWith(prefix)).map(([, v]) => v);
}

function dropNamespace<T>(map: Map<string, T>, ns: string): void {
  for (const k of [...map.keys()]) if (k.startsWith(`${ns}/`)) map.delete(k);
}

function nonEmpty(...vals: Array<string | undefined>): string[] {
  return vals.filter((v): v is string => !!v);
}

/** Names of secrets / configmaps a capp refers to (env refs, volumes, log secret, image pull secrets). */
export function referencedObjects(capp: CappResponse): { secrets: string[]; configMaps: string[] } {
  const secrets = new Set<string>();
  const configMaps = new Set<string>();
  for (const e of capp.env ?? []) {
    if (e.valueFrom?.secretKeyRef) secrets.add(e.valueFrom.secretKeyRef.name);
    if (e.valueFrom?.configMapKeyRef) configMaps.add(e.valueFrom.configMapKeyRef.name);
  }
  for (const v of capp.secretVolumes ?? []) secrets.add(v.secretName);
  for (const v of capp.configMapVolumes ?? []) configMaps.add(v.configMapName);
  for (const n of capp.imagePullSecrets ?? []) secrets.add(n);
  nonEmpty(capp.logSpec?.passwordSecret).forEach((s) => secrets.add(s));
  return { secrets: [...secrets], configMaps: [...configMaps] };
}

/** knative kmeta.ChildName: `parent+suffix`, hashing the parent when longer than 63 chars. */
function childName(parent: string, suffix: string): string {
  if (parent.length + suffix.length <= 63) return parent + suffix;
  const hash = createHash('md5').update(parent).digest('hex');
  return parent.slice(0, 63 - hash.length - suffix.length) + hash + suffix;
}

/** Operator names revisions `<capp>-<5-digit number>`. */
export const revisionName = (capp: string, n: number) => childName(capp, `-${String(n).padStart(5, '0')}`);

/** Capp spec, labels and annotations: what the operator compares and records. */
function cappTemplate(capp: BareCappResponse & Partial<CappResponse & CappRevisionResponse>) {
  const { name: _n, namespace: _ns, createdAt: _c, uid: _u, resourceVersion: _rv, status: _s, warnings: _w, drift: _d, revisionNumber: _r, ...tmpl } = capp;
  return tmpl;
}

function sameTemplate(a: BareCappResponse, b: BareCappResponse): boolean {
  const strip = (c: BareCappResponse) => {
    const t = cappTemplate(c);
    const annotations = { ...t.annotations };
    delete annotations[ANNOTATION_LAST_UPDATED_BY];
    return { ...t, labels: t.labels ?? {}, annotations };
  };
  return canonical(strip(a)) === canonical(strip(b));
}

/** Snapshots `capp` as revision `n`; `meta` identifies the revision object. */
export function toRevision(
  capp: BareCappResponse,
  n: number,
  meta: { createdAt: string; uid: string; resourceVersion: string },
): CappRevisionResponse {
  return {
    ...structuredClone(cappTemplate(capp)),
    name: revisionName(capp.name, n),
    namespace: capp.namespace,
    ...meta,
    revisionNumber: n,
  };
}

/** Lays the desired labels or annotations over the live ones; keys the record does not name stay. */
function overlay(live: Record<string, string> | undefined, desired: Record<string, string>): Record<string, string> | undefined {
  const merged = { ...live, ...desired };
  return Object.keys(merged).length ? merged : undefined;
}

export class MockStore {
  readonly desired = new DesiredState(desiredStateMode);
  private clusters = new Map<string, ClusterData>();
  private rv = 1000;

  private nextRV(): string {
    return String(++this.rv);
  }

  private meta() {
    return {
      createdAt: new Date().toISOString(),
      uid: crypto.randomUUID(),
      resourceVersion: this.nextRV(),
    };
  }

  private cluster(name: string): ClusterData | undefined {
    return this.clusters.get(name);
  }

  private requireNs(c: ClusterData, ns: string): void {
    if (!c.namespaces.has(ns)) throw new NotFoundError(`namespace "${ns}" not found`);
  }

  // ── Seeding helpers (raw inserts, overwrite silently, no validation) ───────

  reset(): void {
    this.clusters.clear();
    this.desired.reset();
    this.rv = 1000;
  }
  addCluster(meta: ClusterMeta): void {
    this.clusters.set(meta.name, {
      meta,
      namespaces: new Map(),
      capps: new Map(),
      configMaps: new Map(),
      secrets: new Map(),
      revisions: new Map(),
    });
  }
  /** Allocates the next resourceVersion string (for seed generators). */
  allocResourceVersion(): string {
    return this.nextRV();
  }
  putNamespace(cluster: string, item: NamespaceItem): void {
    this.cluster(cluster)?.namespaces.set(item.name, item);
  }
  putCapp(cluster: string, capp: CappResponse): void {
    this.cluster(cluster)?.capps.set(key(capp.namespace, capp.name), capp);
  }
  putConfigMap(cluster: string, cm: ConfigMapResponse): void {
    this.cluster(cluster)?.configMaps.set(key(cm.namespace, cm.name), cm);
  }
  putSecret(cluster: string, s: SecretResponse): void {
    this.cluster(cluster)?.secrets.set(key(s.namespace, s.name), s);
  }
  /** Replaces a capp's revision history (any order; stored oldest first). */
  putRevisions(cluster: string, ns: string, cappName: string, revs: CappRevisionResponse[]): void {
    this.cluster(cluster)?.revisions.set(key(ns, cappName), [...revs].sort((a, b) => a.revisionNumber - b.revisionNumber));
  }

  // ── Clusters & sizes ───────────────────────────────────────────────────────

  listClusters(): ClusterMeta[] {
    return [...this.clusters.values()].map((c) => c.meta);
  }
  getCluster(name: string): ClusterMeta | undefined {
    return this.cluster(name)?.meta;
  }
  getSizes(): CappSizesResponse {
    return SIZES;
  }

  // ── Namespaces ─────────────────────────────────────────────────────────────

  listNamespaces(cluster: string): NamespaceListResponse | undefined {
    const c = this.cluster(cluster);
    return c && { items: [...c.namespaces.values()], canCreate: true };
  }
  getNamespace(cluster: string, name: string): NamespaceItem | undefined {
    return this.cluster(cluster)?.namespaces.get(name);
  }
  /** Throws ConflictError if it exists; returns undefined if the cluster is unknown. */
  createNamespace(cluster: string, req: CreateNamespaceRequest): NamespaceItem | undefined {
    const c = this.cluster(cluster);
    if (!c) return undefined;
    if (c.namespaces.has(req.name)) throw new ConflictError(`namespace "${req.name}" already exists`);
    const item: NamespaceItem = {
      name: req.name,
      status: 'Active',
      canEdit: true,
      ...(req.users ? { users: req.users } : {}),
      ...(req.quota ? { quota: { ...req.quota, used: { cpu: '0', memory: '0', pods: 0 } } } : {}),
    };
    c.namespaces.set(req.name, item);
    this.desired.save(namespaceRef(cluster, req.name), item);
    return item;
  }
  /** PUT: replaces users and quota (keeps `used`). */
  updateNamespace(cluster: string, name: string, req: UpdateNamespaceRequest, onDrift?: OnDrift): NamespaceItem | undefined {
    const c = this.cluster(cluster);
    const live = c?.namespaces.get(name);
    if (!c || !live) return undefined;
    const ref = namespaceRef(cluster, name);
    const cur = this.updateBase(ref, live, onDrift);
    const next: NamespaceItem = { ...cur, users: req.users, quota: req.quota ? { ...req.quota, used: cur.quota?.used } : undefined };
    c.namespaces.set(name, next);
    this.desired.save(ref, next);
    return next;
  }
  /** PATCH: only users. */
  patchNamespace(cluster: string, name: string, req: PatchNamespaceRequest, onDrift?: OnDrift): NamespaceItem | undefined {
    const c = this.cluster(cluster);
    const live = c?.namespaces.get(name);
    if (!c || !live) return undefined;
    const ref = namespaceRef(cluster, name);
    const cur = this.updateBase(ref, live, onDrift);
    const next: NamespaceItem = { ...cur, ...(req.users !== undefined ? { users: req.users } : {}) };
    c.namespaces.set(name, next);
    this.desired.save(ref, next);
    return next;
  }
  /** Cascades to the namespace's capps, configmaps and secrets. Returns true if deleted. */
  deleteNamespace(cluster: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.namespaces.has(name)) return undefined;
    c.namespaces.delete(name);
    this.desired.forgetNamespace(cluster, name);
    dropNamespace(c.capps, name);
    dropNamespace(c.configMaps, name);
    dropNamespace(c.secrets, name);
    dropNamespace(c.revisions, name);
    return true;
  }

  // ── Capps ──────────────────────────────────────────────────────────────────

  /** All capps in the cluster, or only those in `ns`. */
  listCapps(cluster: string, ns?: string): CappResponse[] | undefined {
    const c = this.cluster(cluster);
    if (!c || (ns !== undefined && !c.namespaces.has(ns))) return undefined;
    const capps = inNamespace(c.capps, ns);
    capps.forEach((capp) => this.tick(capp));
    return capps;
  }
  getCapp(cluster: string, ns: string, name: string): CappResponse | undefined {
    const capp = this.cluster(cluster)?.capps.get(key(ns, name));
    if (capp) this.tick(capp);
    return capp;
  }

  /** Plays out rollout progress due by now; the operator would have done it in the background. */
  private tick(capp: CappResponse): void {
    if (tickRollout(capp, Date.now())) capp.resourceVersion = this.nextRV();
  }

  /** Throws ConflictError when status shows the action cannot apply. `undefined` if not found. */
  rolloutAction(cluster: string, ns: string, name: string, req: RolloutActionRequest): CappResponse | undefined {
    const capp = this.getCapp(cluster, ns, name);
    if (!capp) return undefined;
    const problem = rolloutActionError(capp, req.action, req.revision);
    if (problem) throw new ConflictError(problem);
    requestRolloutAction(capp, req.action, req.revision);
    capp.resourceVersion = this.nextRV();
    return capp;
  }

  /** `undefined` if not found. A capp with no strategy is returned unchanged. */
  removeRolloutStrategy(cluster: string, ns: string, name: string, onDrift?: OnDrift): CappResponse | undefined {
    const c = this.cluster(cluster);
    const live = this.getCapp(cluster, ns, name);
    if (!c || !live) return undefined;
    if (!live.routeSpec?.rolloutStrategy) return live;
    const ref: Ref<'Capp'> = { cluster, kind: 'Capp', namespace: ns, name };
    const capp = this.updateBase(ref, live, onDrift);
    removeStrategy(capp);
    capp.resourceVersion = this.nextRV();
    c.capps.set(key(ns, name), capp);
    this.recordRevision(c, capp);
    this.desired.save(ref, capp);
    return capp;
  }

  private buildCapp(ns: string, req: CappRequest, prev?: CappResponse): CappResponse {
    const now = new Date().toISOString();
    const { customResources, name, namespace: _ns, ...rest } = req;
    const resources = customResources ?? (req.size ? SIZES[req.size] : undefined);
    const state = req.state ?? 'enabled';
    // Like the backend, an omitted port keeps the current one.
    const containerPort = req.containerPort ?? prev?.containerPort;
    const capp: CappResponse = {
      ...rest,
      ...(containerPort !== undefined ? { containerPort } : {}),
      name,
      namespace: ns,
      scaleSpec: req.scaleSpec ?? {},
      state,
      ...(resources ? { resources } : {}),
      createdAt: prev?.createdAt ?? now,
      uid: prev?.uid ?? crypto.randomUUID(),
      resourceVersion: this.nextRV(),
      ...(prev?.labels ? { labels: prev.labels } : {}),
      ...(prev?.annotations ? { annotations: prev.annotations } : {}),
      status: {
        conditions: [],
        stateStatus: { state, lastChange: now },
      },
    };
    // Omitting the strategy keeps it: only DELETE .../rollout/strategy removes one.
    const strategy = req.routeSpec?.rolloutStrategy ?? prev?.routeSpec?.rolloutStrategy;
    if (strategy) capp.routeSpec = { ...req.routeSpec, rolloutStrategy: normalizeStrategy(strategy) };
    capp.status.conditions = cappConditions(capp, now);
    return capp;
  }

  /** Throws NotFoundError (no namespace) / ConflictError (duplicate). `undefined` if cluster unknown. */
  createCapp(cluster: string, ns: string, req: CappRequest): CappResponse | undefined {
    const c = this.cluster(cluster);
    if (!c) return undefined;
    this.requireNs(c, ns);
    if (c.capps.has(key(ns, req.name))) throw new ConflictError(`capp "${req.name}" already exists`);
    const capp = this.buildCapp(ns, req);
    initialRollout(capp);
    c.capps.set(key(ns, req.name), capp);
    this.recordRevision(c, capp);
    this.desired.save({ cluster, kind: 'Capp', namespace: ns, name: req.name }, capp);
    return capp;
  }
  /** Full replace of the spec; keeps uid, createdAt, labels, annotations. `undefined` if not found. */
  updateCapp(cluster: string, ns: string, name: string, req: CappRequest, onDrift?: OnDrift): CappResponse | undefined {
    const c = this.cluster(cluster);
    const live = c?.capps.get(key(ns, name));
    if (!c || !live) return undefined;
    const ref: Ref<'Capp'> = { cluster, kind: 'Capp', namespace: ns, name };
    const capp = this.buildCapp(ns, { ...req, name }, this.updateBase(ref, live, onDrift));
    updateRollout(live, capp, Date.now());
    c.capps.set(key(ns, name), capp);
    this.recordRevision(c, capp);
    this.desired.save(ref, capp);
    return capp;
  }
  /** Revisions are owned by the capp, so they go with it. */
  deleteCapp(cluster: string, ns: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.capps.has(key(ns, name))) return undefined;
    c.capps.delete(key(ns, name));
    c.revisions.delete(key(ns, name));
    this.desired.forget({ cluster, kind: 'Capp', namespace: ns, name });
    return true;
  }

  /**
   * Copies a capp (and the secrets/configmaps it references, if missing on the target)
   * to another cluster/namespace, optionally deleting the source.
   */
  migrateCapp(cluster: string, ns: string, name: string, req: MigrateRequest): MigrateResult {
    const src = this.cluster(cluster);
    const capp = src?.capps.get(key(ns, name));
    if (!src || !capp) return { ok: false, error: 'source_not_found', message: `capp "${name}" not found` };
    const dst = this.cluster(req.targetCluster);
    if (!dst) return { ok: false, error: 'target_cluster_not_found', message: `cluster "${req.targetCluster}" not found` };
    if (!dst.namespaces.has(req.targetNamespace)) {
      return { ok: false, error: 'target_namespace_not_found', message: `namespace "${req.targetNamespace}" not found` };
    }
    if (dst.capps.has(key(req.targetNamespace, name))) {
      return { ok: false, error: 'conflict', message: `capp "${name}" already exists in target` };
    }

    const sourceHostname = capp.routeSpec?.hostname;
    if (req.targetHostname && !sourceHostname) {
      return { ok: false, error: 'bad_request', message: 'targetHostname cannot be set when the source Capp has no hostname' };
    }
    if (sourceHostname && !req.deleteSource) {
      if (!req.targetHostname) {
        return { ok: false, error: 'bad_request', message: 'targetHostname is required when copying a Capp with a custom hostname' };
      }
      if (req.targetHostname === sourceHostname) {
        return { ok: false, error: 'bad_request', message: 'targetHostname must differ from the source hostname' };
      }
    }

    const targetRef = <K extends Kind>(kind: K, objectName: string): Ref<K> => ({
      cluster: req.targetCluster,
      kind,
      namespace: req.targetNamespace,
      name: objectName,
    });
    const refs = referencedObjects(capp);
    const copiedSecrets: string[] = [];
    const copiedConfigMaps: string[] = [];
    for (const sn of refs.secrets) {
      const s = src.secrets.get(key(ns, sn));
      if (!s || dst.secrets.has(key(req.targetNamespace, sn))) continue;
      const copied = { ...structuredClone(s), namespace: req.targetNamespace, ...this.meta() };
      dst.secrets.set(key(req.targetNamespace, sn), copied);
      this.desired.save(targetRef('Secret', sn), copied);
      copiedSecrets.push(sn);
    }
    for (const cn of refs.configMaps) {
      const m = src.configMaps.get(key(ns, cn));
      if (!m || dst.configMaps.has(key(req.targetNamespace, cn))) continue;
      const copied = { ...structuredClone(m), namespace: req.targetNamespace, ...this.meta() };
      dst.configMaps.set(key(req.targetNamespace, cn), copied);
      this.desired.save(targetRef('ConfigMap', cn), copied);
      copiedConfigMaps.push(cn);
    }

    const copy: CappResponse = {
      ...structuredClone(capp),
      namespace: req.targetNamespace,
      ...this.meta(),
    };
    if (req.targetHostname && copy.routeSpec) {
      copy.routeSpec = { ...copy.routeSpec, hostname: req.targetHostname };
    }
    dst.capps.set(key(req.targetNamespace, name), copy);
    this.recordRevision(dst, copy);
    this.desired.save(targetRef('Capp', name), copy);

    let sourceDeleted = false;
    if (req.deleteSource) sourceDeleted = !!this.deleteCapp(cluster, ns, name);

    return {
      ok: true,
      data: {
        name,
        sourceCluster: cluster,
        sourceNamespace: ns,
        targetCluster: req.targetCluster,
        targetNamespace: req.targetNamespace,
        sourceDeleted,
        ...(copiedSecrets.length ? { copiedSecrets } : {}),
        ...(copiedConfigMaps.length ? { copiedConfigMaps } : {}),
      },
    };
  }

  // ── Capp revisions ─────────────────────────────────────────────────────────

  /**
   * Mirrors the operator: records a new revision when the capp's spec, labels or
   * annotations differ from the latest one, keeping at most REVISION_HISTORY_LIMIT.
   */
  private recordRevision(c: ClusterData, capp: CappResponse): void {
    const k = key(capp.namespace, capp.name);
    const revs = c.revisions.get(k) ?? [];
    const latest = revs.at(-1);
    if (latest && sameTemplate(latest, capp)) return;
    revs.push(toRevision(capp, (latest?.revisionNumber ?? 0) + 1, this.meta()));
    c.revisions.set(k, revs.slice(-REVISION_HISTORY_LIMIT));
  }

  /**
   * Newest first. Like the backend (a label-selector list), an unknown capp or
   * namespace yields an empty list; only an unknown cluster is `undefined`.
   */
  listRevisions(cluster: string, ns: string, cappName: string): CappRevisionResponse[] | undefined {
    const c = this.cluster(cluster);
    return c && [...(c.revisions.get(key(ns, cappName)) ?? [])].reverse();
  }
  getRevision(cluster: string, ns: string, cappName: string, n: number): CappRevisionResponse | undefined {
    return this.cluster(cluster)?.revisions.get(key(ns, cappName))?.find((r) => r.revisionNumber === n);
  }
  /**
   * Replaces the capp's spec, labels and annotations with revision `n`'s, whether or not it has
   * drifted. The result is recorded as a new revision (unless unchanged).
   */
  rollbackCapp(cluster: string, ns: string, cappName: string, n: number): RollbackResult {
    const c = this.cluster(cluster);
    const rev = this.getRevision(cluster, ns, cappName, n);
    if (!c || !rev) {
      return { ok: false, error: 'revision_not_found', message: `CappRevision "${cappName} revision ${n}" not found` };
    }
    const live = c.capps.get(key(ns, cappName));
    if (!live) return { ok: false, error: 'capp_not_found', message: `Capp "${cappName}" not found` };

    const tmpl = structuredClone(cappTemplate(rev));
    // A past rollout action must not be replayed.
    if (tmpl.annotations) delete tmpl.annotations[ANNOTATION_ROLLOUT];

    const now = new Date().toISOString();
    const next: CappResponse = {
      ...tmpl,
      name: live.name,
      namespace: live.namespace,
      createdAt: live.createdAt,
      uid: live.uid,
      resourceVersion: this.nextRV(),
      status:
        tmpl.state === live.state
          ? live.status
          : { ...live.status, stateStatus: { state: tmpl.state ?? 'enabled', lastChange: now } },
    };
    c.capps.set(key(ns, cappName), next);
    this.recordRevision(c, next);
    this.desired.save({ cluster, kind: 'Capp', namespace: ns, name: cappName }, next);
    return { ok: true, data: next };
  }

  // ── ConfigMaps ─────────────────────────────────────────────────────────────

  listConfigMaps(cluster: string, ns?: string): ConfigMapResponse[] | undefined {
    const c = this.cluster(cluster);
    if (!c || (ns !== undefined && !c.namespaces.has(ns))) return undefined;
    return inNamespace(c.configMaps, ns);
  }
  /** Names only (ConfigMapNameListResponse = { items: names, total }); `undefined` if ns/cluster unknown. */
  listConfigMapNames(cluster: string, ns: string): string[] | undefined {
    return this.listConfigMaps(cluster, ns)?.map((m) => m.name);
  }
  getConfigMap(cluster: string, ns: string, name: string): ConfigMapResponse | undefined {
    return this.cluster(cluster)?.configMaps.get(key(ns, name));
  }
  createConfigMap(cluster: string, ns: string, req: ConfigMapRequest): ConfigMapResponse | undefined {
    const c = this.cluster(cluster);
    if (!c) return undefined;
    this.requireNs(c, ns);
    if (c.configMaps.has(key(ns, req.name))) throw new ConflictError(`configmap "${req.name}" already exists`);
    const cm: ConfigMapResponse = { name: req.name, namespace: ns, data: req.data ?? {}, ...this.meta() };
    c.configMaps.set(key(ns, req.name), cm);
    this.desired.save({ cluster, kind: 'ConfigMap', namespace: ns, name: req.name }, cm);
    return cm;
  }
  updateConfigMap(cluster: string, ns: string, name: string, req: ConfigMapUpdateRequest, onDrift?: OnDrift): ConfigMapResponse | undefined {
    const c = this.cluster(cluster);
    const live = c?.configMaps.get(key(ns, name));
    if (!c || !live) return undefined;
    const ref: Ref<'ConfigMap'> = { cluster, kind: 'ConfigMap', namespace: ns, name };
    const next = { ...this.updateBase(ref, live, onDrift), data: req.data ?? {}, resourceVersion: this.nextRV() };
    c.configMaps.set(key(ns, name), next);
    this.desired.save(ref, next);
    return next;
  }
  deleteConfigMap(cluster: string, ns: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.configMaps.has(key(ns, name))) return undefined;
    c.configMaps.delete(key(ns, name));
    this.desired.forget({ cluster, kind: 'ConfigMap', namespace: ns, name });
    return true;
  }

  // ── Secrets ────────────────────────────────────────────────────────────────

  listSecrets(cluster: string, ns?: string): SecretResponse[] | undefined {
    const c = this.cluster(cluster);
    if (!c || (ns !== undefined && !c.namespaces.has(ns))) return undefined;
    return inNamespace(c.secrets, ns);
  }
  listSecretNames(cluster: string, ns: string): string[] | undefined {
    return this.listSecrets(cluster, ns)?.map((s) => s.name);
  }
  getSecret(cluster: string, ns: string, name: string): SecretResponse | undefined {
    return this.cluster(cluster)?.secrets.get(key(ns, name));
  }
  createSecret(cluster: string, ns: string, req: SecretRequest): SecretResponse | undefined {
    const c = this.cluster(cluster);
    if (!c) return undefined;
    this.requireNs(c, ns);
    if (c.secrets.has(key(ns, req.name))) throw new ConflictError(`secret "${req.name}" already exists`);
    const s: SecretResponse = {
      name: req.name,
      namespace: ns,
      type: req.type ?? 'Opaque',
      data: req.data ?? {},
      ...this.meta(),
    };
    c.secrets.set(key(ns, req.name), s);
    this.desired.save({ cluster, kind: 'Secret', namespace: ns, name: req.name }, s);
    return s;
  }
  updateSecret(cluster: string, ns: string, name: string, req: SecretUpdateRequest, onDrift?: OnDrift): SecretResponse | undefined {
    const c = this.cluster(cluster);
    const live = c?.secrets.get(key(ns, name));
    if (!c || !live) return undefined;
    const ref: Ref<'Secret'> = { cluster, kind: 'Secret', namespace: ns, name };
    const next = { ...this.updateBase(ref, live, onDrift), data: req.data ?? {}, resourceVersion: this.nextRV() };
    c.secrets.set(key(ns, name), next);
    this.desired.save(ref, next);
    return next;
  }
  deleteSecret(cluster: string, ns: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.secrets.has(key(ns, name))) return undefined;
    c.secrets.delete(key(ns, name));
    this.desired.forget({ cluster, kind: 'Secret', namespace: ns, name });
    return true;
  }

  // ── Bound capps ────────────────────────────────────────────────────────────

  /** Capps that refer to a secret or configmap. A secret used only for logs never rolls one out. */
  boundCapps(cluster: string, kind: BoundResourceKind, ns: string, name: string): BoundCappsResponse {
    const refers = (capp: CappResponse) => {
      const refs = referencedObjects(capp);
      return (kind === 'secret' ? refs.secrets : refs.configMaps).includes(name);
    };
    const bound = (this.listCapps(cluster, ns) ?? []).filter(refers);
    const names = (capps: CappResponse[]) => capps.map((c) => c.name).sort();
    return {
      boundCapps: names(bound),
      toReload: names(bound.filter((c) => c.reloadOnBoundResourceChange && refers({ ...c, logSpec: undefined }))),
    };
  }

  // ── Drift ──────────────────────────────────────────────────────────────────

  /** A copy of a live object with its drift, as reads return it. */
  withDrift<K extends Kind>(ref: Ref<K>, live: Tracked[K]): Tracked[K] & { drift?: Drift } {
    const drift = this.desired.inspect(ref, live);
    return drift ? { ...live, drift } : live;
  }
  /** Recorded objects of a kind that no longer exist. */
  missing(cluster: string, kind: Kind, ns?: string): DriftMissing[] {
    return this.desired.missing(cluster, kind, ns, (namespace, name) => !!this.live({ cluster, kind, namespace, name }));
  }
  /** Makes the cluster match the desired state, recreating a missing object. */
  revertDrift<K extends Kind>(ref: Ref<K>, seen: DriftActionRequest): DriftActionResponse {
    const live = this.live(ref);
    const drift = this.desired.confirm(ref, live, seen);
    const desired = this.desired.desired(ref);
    if (!desired) throw new ApiError(404, 'NOT_FOUND', `desired state of ${ref.kind} "${ref.name}" not found`);
    if (drift.state === 'inSync') return { drift };
    const c = this.cluster(ref.cluster)!;
    if (ref.kind !== 'Namespace') this.requireNs(c, ref.namespace);
    const object = this.reverted(ref, live, desired);
    this.putLive(c, ref, object);
    return { drift: this.desired.inspect(ref, object) };
  }
  /** Makes the desired state match the cluster; archives the record of a missing object. */
  acceptDrift<K extends Kind>(ref: Ref<K>, seen: DriftActionRequest): DriftActionResponse {
    const live = this.live(ref);
    this.desired.confirm(ref, live, seen);
    const drift = this.desired.accept(ref, live);
    return drift ? { drift } : {};
  }
  /** Records the namespace's capps, configmaps and secrets that have no desired state yet. */
  adoptDrift(cluster: string, ns: string): DriftAdoptResponse {
    this.desired.require();
    const c = this.cluster(cluster)!;
    const adopted: DriftAdoptResponse['adopted'] = [];
    const adopt = <K extends Kind>(kind: K, objects: Array<Tracked[K] & { name: string }>) => {
      for (const o of objects) {
        if (this.desired.adopt({ cluster, kind, namespace: ns, name: o.name }, o)) adopted.push({ kind, name: o.name });
      }
    };
    adopt('Capp', inNamespace(c.capps, ns));
    adopt('ConfigMap', inNamespace(c.configMaps, ns));
    adopt('Secret', inNamespace(c.secrets, ns));
    return { adopted, total: adopted.length };
  }

  private live<K extends Kind>(ref: Ref<K>): Tracked[K] | undefined;
  private live({ cluster, kind, namespace, name }: Ref): Tracked[Kind] | undefined {
    switch (kind) {
      case 'Capp': return this.getCapp(cluster, namespace, name);
      case 'ConfigMap': return this.getConfigMap(cluster, namespace, name);
      case 'Secret': return this.getSecret(cluster, namespace, name);
      case 'Namespace': return this.getNamespace(cluster, name);
    }
  }
  private putLive<K extends Kind>(c: ClusterData, ref: Ref<K>, object: Tracked[K]): void;
  private putLive(c: ClusterData, { kind, namespace, name }: Ref, object: Tracked[Kind]): void {
    switch (kind) {
      case 'Capp':
        c.capps.set(key(namespace, name), object as CappResponse);
        return this.recordRevision(c, object as CappResponse);
      case 'ConfigMap': return void c.configMaps.set(key(namespace, name), object as ConfigMapResponse);
      case 'Secret': return void c.secrets.set(key(namespace, name), object as SecretResponse);
      case 'Namespace': return void c.namespaces.set(name, object as NamespaceItem);
    }
  }

  /** The object an update starts from: the live one, or a copy reverted to its desired state. */
  private updateBase<K extends Kind, T extends Tracked[K]>(ref: Ref<K>, live: T, onDrift?: OnDrift): T {
    if (this.desired.startFrom(ref, live, onDrift) === 'live') return live;
    return this.reverted(ref, live, this.desired.desired(ref)!) as T;
  }

  /** `live` with the recorded fields set to `desired`, or a new object when `live` is gone. */
  private reverted<K extends Kind>(ref: Ref<K>, live: Tracked[K] | undefined, desired: Tracked[K]): Tracked[K];
  private reverted({ kind }: Ref, live: Tracked[Kind] | undefined, desired: Tracked[Kind]): Tracked[Kind] {
    if (kind === 'Namespace') {
      const cur = live as NamespaceItem | undefined;
      const { name, users, quota } = desired as NamespaceItem;
      const used = cur?.quota?.used ?? { cpu: '0', memory: '0', pods: 0 };
      return { name, status: 'Active', canEdit: true, ...cur, users, quota: quota && { ...quota, used } };
    }
    const cur = live as CappResponse | ConfigMapResponse | SecretResponse | undefined;
    const want = trackedMetadata(desired as CappResponse);
    const meta = {
      ...this.meta(),
      ...(cur ? { createdAt: cur.createdAt, uid: cur.uid } : {}),
      labels: overlay(cur?.labels, want.labels),
      annotations: overlay(cur?.annotations, want.annotations),
    };
    if (kind !== 'Capp') return { ...(desired as ConfigMapResponse | SecretResponse), ...meta };

    const { name, namespace } = desired as CappResponse;
    const tmpl = cappTemplate(desired as CappResponse);
    const state = tmpl.state ?? 'enabled';
    const next: CappResponse = {
      ...tmpl,
      name,
      namespace,
      ...meta,
      status: { conditions: [], stateStatus: { state, lastChange: new Date().toISOString() } },
    };
    next.status.conditions = cappConditions(next, next.status.stateStatus.lastChange!);
    if (cur) updateRollout(cur as CappResponse, next, Date.now());
    else initialRollout(next);
    return next;
  }
}

/** Process-wide singleton used by the HTTP server. */
export const store = new MockStore();
