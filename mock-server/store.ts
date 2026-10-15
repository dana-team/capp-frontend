/**
 * In-memory store for the mock capp-backend.
 *
 * Conventions (HTTP layer maps these to status codes):
 *  - Unknown cluster / namespace / resource:
 *      get*      -> returns `undefined`            (404)
 *      list*     -> returns `undefined` when the cluster (or the namespace, if given)
 *                   does not exist, otherwise an array (possibly empty)   (404)
 *      update*, delete*, patch*, setBackupLabel -> return `undefined`    (404)
 *  - Duplicates on create (and on create-through-migrate): throws `ConflictError`  (409)
 *  - Creating a resource in a namespace that does not exist: throws `NotFoundError` (404)
 *  - Cluster health is NOT enforced here; check `getCluster(c)?.healthy` in the HTTP layer (503).
 *  - Returned objects are the live store objects; treat them as read-only (JSON-serialise them).
 *
 * All DTO shapes come from the frontend types, so drift fails to compile.
 */
import { createHash, randomBytes } from 'node:crypto';
import { LABEL_BACKUP_TO_GIT } from '../src/types/capp';
import { cappConditions } from './conditions';
import type {
  BareCappResponse,
  CappRequest,
  CappResponse,
  CappRevisionResponse,
  CappSizesResponse,
  ClusterMeta,
  MigrateRequest,
  MigrateResponse,
  SyncToGitResponse,
} from '../src/types/capp';
import type {
  ConfigMapRequest,
  ConfigMapResponse,
  ConfigMapUpdateRequest,
} from '../src/types/configmap';
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

/** Names of secrets / configmaps a capp refers to (env refs, volumes, log + kafka secrets, image pull secrets). */
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
  for (const s of capp.eventSourcesSpec?.sources ?? []) {
    nonEmpty(s.kafkaSourceConfiguration?.secretRef).forEach((n) => secrets.add(n));
  }
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
  const { name: _n, namespace: _ns, createdAt: _c, uid: _u, resourceVersion: _rv, status: _s, warnings: _w, revisionNumber: _r, ...tmpl } = capp;
  return tmpl;
}

/** JSON with sorted keys, for order-insensitive deep equality. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
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

export class MockStore {
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
    return item;
  }
  /** PUT: replaces users and quota (keeps `used`). */
  updateNamespace(cluster: string, name: string, req: UpdateNamespaceRequest): NamespaceItem | undefined {
    const c = this.cluster(cluster);
    const cur = c?.namespaces.get(name);
    if (!c || !cur) return undefined;
    const next: NamespaceItem = { ...cur, users: req.users, quota: req.quota ? { ...req.quota, used: cur.quota?.used } : undefined };
    c.namespaces.set(name, next);
    return next;
  }
  /** PATCH: only users. */
  patchNamespace(cluster: string, name: string, req: PatchNamespaceRequest): NamespaceItem | undefined {
    const c = this.cluster(cluster);
    const cur = c?.namespaces.get(name);
    if (!c || !cur) return undefined;
    const next: NamespaceItem = { ...cur, ...(req.users !== undefined ? { users: req.users } : {}) };
    c.namespaces.set(name, next);
    return next;
  }
  /** Cascades to the namespace's capps, configmaps and secrets. Returns true if deleted. */
  deleteNamespace(cluster: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.namespaces.delete(name)) return undefined;
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
    return inNamespace(c.capps, ns);
  }
  getCapp(cluster: string, ns: string, name: string): CappResponse | undefined {
    return this.cluster(cluster)?.capps.get(key(ns, name));
  }

  private buildCapp(ns: string, req: CappRequest, prev?: CappResponse): CappResponse {
    const now = new Date().toISOString();
    const { customResources, name, namespace: _ns, ...rest } = req;
    const resources = customResources ?? (req.size ? SIZES[req.size] : undefined);
    const state = req.state ?? 'enabled';
    const capp: CappResponse = {
      ...rest,
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
    c.capps.set(key(ns, req.name), capp);
    this.recordRevision(c, capp);
    return capp;
  }
  /** Full replace of the spec; keeps uid, createdAt, labels, annotations. `undefined` if not found. */
  updateCapp(cluster: string, ns: string, name: string, req: CappRequest): CappResponse | undefined {
    const c = this.cluster(cluster);
    const prev = c?.capps.get(key(ns, name));
    if (!c || !prev) return undefined;
    const capp = this.buildCapp(ns, { ...req, name }, prev);
    c.capps.set(key(ns, name), capp);
    this.recordRevision(c, capp);
    return capp;
  }
  /** Revisions are owned by the capp, so they go with it. */
  deleteCapp(cluster: string, ns: string, name: string): boolean | undefined {
    const c = this.cluster(cluster);
    if (!c?.capps.delete(key(ns, name))) return undefined;
    c.revisions.delete(key(ns, name));
    return true;
  }
  /** Toggles the backup-to-git label. Returns the SyncToGitResponse (fake sha) or `undefined`. */
  setBackupLabel(cluster: string, ns: string, name: string, enabled: boolean): SyncToGitResponse | undefined {
    const c = this.cluster(cluster);
    const capp = c?.capps.get(key(ns, name));
    if (!c || !capp) return undefined;
    const labels = { ...capp.labels };
    if (enabled) labels[LABEL_BACKUP_TO_GIT] = 'true';
    else delete labels[LABEL_BACKUP_TO_GIT];
    capp.labels = labels;
    capp.resourceVersion = this.nextRV();
    this.recordRevision(c, capp);
    return {
      enabled,
      path: `${c.meta.gitOpsPath ?? c.meta.name}/${ns}/${name}.yaml`,
      ...(enabled ? { commitSha: randomBytes(20).toString('hex') } : {}),
    };
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

    const refs = referencedObjects(capp);
    const copiedSecrets: string[] = [];
    const copiedConfigMaps: string[] = [];
    for (const sn of refs.secrets) {
      const s = src.secrets.get(key(ns, sn));
      if (!s || dst.secrets.has(key(req.targetNamespace, sn))) continue;
      dst.secrets.set(key(req.targetNamespace, sn), {
        ...structuredClone(s),
        namespace: req.targetNamespace,
        ...this.meta(),
      });
      copiedSecrets.push(sn);
    }
    for (const cn of refs.configMaps) {
      const m = src.configMaps.get(key(ns, cn));
      if (!m || dst.configMaps.has(key(req.targetNamespace, cn))) continue;
      dst.configMaps.set(key(req.targetNamespace, cn), {
        ...structuredClone(m),
        namespace: req.targetNamespace,
        ...this.meta(),
      });
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
    // Migrated capps start un-synced on the target.
    if (copy.labels) delete copy.labels[LABEL_BACKUP_TO_GIT];
    dst.capps.set(key(req.targetNamespace, name), copy);
    this.recordRevision(dst, copy);

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
   * Replaces the capp's spec, labels and annotations with revision `n`'s, keeping the
   * live backup-to-git label. The result is recorded as a new revision (unless unchanged).
   */
  rollbackCapp(cluster: string, ns: string, cappName: string, n: number): RollbackResult {
    const c = this.cluster(cluster);
    const rev = this.getRevision(cluster, ns, cappName, n);
    if (!c || !rev) {
      return { ok: false, error: 'revision_not_found', message: `CappRevision "${cappName} revision ${n}" not found` };
    }
    const live = c.capps.get(key(ns, cappName));
    if (!live) return { ok: false, error: 'capp_not_found', message: `Capp "${cappName}" not found` };

    const { labels: revLabels, ...tmpl } = structuredClone(cappTemplate(rev));
    const labels = { ...revLabels };
    delete labels[LABEL_BACKUP_TO_GIT];
    const backup = live.labels?.[LABEL_BACKUP_TO_GIT];
    if (backup !== undefined) labels[LABEL_BACKUP_TO_GIT] = backup;

    const now = new Date().toISOString();
    const next: CappResponse = {
      ...tmpl,
      name: live.name,
      namespace: live.namespace,
      createdAt: live.createdAt,
      uid: live.uid,
      resourceVersion: this.nextRV(),
      ...(Object.keys(labels).length ? { labels } : {}),
      status:
        tmpl.state === live.state
          ? live.status
          : { ...live.status, stateStatus: { state: tmpl.state ?? 'enabled', lastChange: now } },
    };
    c.capps.set(key(ns, cappName), next);
    this.recordRevision(c, next);
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
    return cm;
  }
  updateConfigMap(cluster: string, ns: string, name: string, req: ConfigMapUpdateRequest): ConfigMapResponse | undefined {
    const c = this.cluster(cluster);
    const cur = c?.configMaps.get(key(ns, name));
    if (!c || !cur) return undefined;
    const next = { ...cur, data: req.data ?? {}, resourceVersion: this.nextRV() };
    c.configMaps.set(key(ns, name), next);
    return next;
  }
  deleteConfigMap(cluster: string, ns: string, name: string): boolean | undefined {
    return this.cluster(cluster)?.configMaps.delete(key(ns, name)) ? true : undefined;
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
    return s;
  }
  updateSecret(cluster: string, ns: string, name: string, req: SecretUpdateRequest): SecretResponse | undefined {
    const c = this.cluster(cluster);
    const cur = c?.secrets.get(key(ns, name));
    if (!c || !cur) return undefined;
    const next = { ...cur, data: req.data ?? {}, resourceVersion: this.nextRV() };
    c.secrets.set(key(ns, name), next);
    return next;
  }
  deleteSecret(cluster: string, ns: string, name: string): boolean | undefined {
    return this.cluster(cluster)?.secrets.delete(key(ns, name)) ? true : undefined;
  }
}

/** Process-wide singleton used by the HTTP server. */
export const store = new MockStore();
