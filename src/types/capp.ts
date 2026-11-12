import type { K8sResource } from './kubernetes';

// ── Backend DTO types (capp-backend REST API) ─────────────────────────────────
// These mirror the OpenAPI spec in capp-backend/api/openapi.yaml

export type ScaleMetric = 'concurrency' | 'cpu' | 'memory' | 'rps';
export type CappState = 'enabled' | 'disabled';
export type CappSize = 'small' | 'medium' | 'large';

export interface ResourceQuantities {
  cpu?: string;
  memory?: string;
}

export interface ResourceSpec {
  requests?: ResourceQuantities;
  limits?: ResourceQuantities;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    secretKeyRef?: { name: string; key: string };
    configMapKeyRef?: { name: string; key: string };
  };
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

export interface RouteSpec {
  hostname?: string;
  tlsEnabled?: boolean;
  routeTimeoutSeconds?: number | null;
  /** Omitting it on update keeps the current strategy; removal has its own endpoint. */
  rolloutStrategy?: RolloutStrategy;
}

// ── Staged rollouts ────────────────────────────────────────────────────────

export interface RolloutStage {
  /** The candidate revision's share of traffic. 0 is valid (blue-green). */
  percent: number;
  /** Minimum time to hold the stage, e.g. "5m". Unset on the last stage. */
  duration?: string;
}

export interface RolloutStrategy {
  stages: RolloutStage[];
  autoRollback?: boolean;
  progressDeadline?: string;
}

export type RolloutPhase =
  | 'Stable'
  | 'Progressing'
  | 'Holding'
  | 'Promoting'
  | 'Failed'
  | 'RolledBack'
  | 'Aborted';

export interface RevisionTraffic {
  revisionName: string;
  percent: number;
  tag: string;
}

export interface RolloutStatusResponse {
  stableRevision?: string;
  candidateRevision?: string;
  /** Set when the strategy was removed before the candidate was promoted. */
  pinnedRevision?: string;
  phase?: RolloutPhase;
  stageIndex: number;
  /** The candidate's share while a strategy change holds the rollout. */
  heldPercent?: number;
  stageStartTime?: string;
  candidateSince?: string;
  candidateReadyOnce?: boolean;
  traffic?: RevisionTraffic[];
  message?: string;
}

export type RolloutAction = 'promote' | 'abort' | 'retry';

export interface RolloutActionRequest {
  action: RolloutAction;
  /** Must be the current candidate, which binds the action to one rollout. */
  revision: string;
}

export interface LogSpec {
  type: 'elastic' | 'elastic-datastream';
  /** Hostname of the logs destination, without scheme, port or path. */
  host: string;
  /** Index name when type is 'elastic', data stream name when 'elastic-datastream'. */
  target: string;
  user: string;
  passwordSecret: string;
  passwordKey: string;
}

export interface NFSVolume {
  name: string;
  server: string;
  path: string;
  capacity: string; // e.g. "10Gi"
}

export interface SecretVolume {
  name: string;
  secretName: string;
  mountPath: string;
}

export interface ConfigMapVolume {
  name: string;
  configMapName: string;
  mountPath: string;
}

export interface ScaleSpec {
  metric?: ScaleMetric | '';
  minReplicas?: number;
  maxReplicas?: number;
  scaleDelaySeconds?: number;
}

// ── Event sources ──────────────────────────────────────────────────────────

export interface PingSourceConfig {
  schedule: string;
  data?: string;
}

export interface KafkaSourceConfig {
  bootstrapServers: string[];
  topics: string[];
  consumerGroup?: string;
  consumers?: number;
  secretRef: string;
}

export interface SourceConfig {
  name: string;
  uri?: string;
  pingSourceConfiguration?: PingSourceConfig;
  kafkaSourceConfiguration?: KafkaSourceConfig;
}

export interface EventSourcesSpec {
  sources?: SourceConfig[];
}

export interface EventSourceStatusResponse {
  name: string;
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface EventingStatusResponse {
  eventSources?: EventSourceStatusResponse[];
}

// ── Request body for create / update ──────────────────────────────────────

export interface CappRequest {
  name: string;
  namespace?: string;
  scaleSpec?: ScaleSpec;
  state?: CappState;
  image: string;
  containerName?: string;
  size?: CappSize;
  customResources?: ResourceSpec;
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
  routeSpec?: RouteSpec;
  logSpec?: LogSpec;
  nfsVolumes?: NFSVolume[];
  secretVolumes?: SecretVolume[];
  configMapVolumes?: ConfigMapVolume[];
  /** Names of kubernetes.io/dockerconfigjson Secrets used to pull the image. */
  imagePullSecrets?: string[];
  eventSourcesSpec?: EventSourcesSpec;
  /** Roll out when a Secret or ConfigMap the Capp uses is updated. Omitting it on update turns it off. */
  reloadOnBoundResourceChange?: boolean;
}

/** Capp annotation the backend stores reloadOnBoundResourceChange in. */
export const ROLLOUT_ON_BOUND_CHANGE_ANNOTATION = 'rcs.dana.io/rollout-on-bound-resource-change';
/** Informational annotations the backend writes when it rolls a Capp out for a bound resource. */
export const RESTARTED_AT_ANNOTATION = 'capp.dana.io/restarted-at';
/** "<Kind>/<name>" of the Secret or ConfigMap behind the last such rollout. */
export const RESTART_REASON_ANNOTATION = 'capp.dana.io/restart-reason';

// ── Response types ─────────────────────────────────────────────────────────

export interface ConditionResponse {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface StateStatusResponse {
  state?: string;
  lastChange?: string;
}

export interface CappStatusResponse {
  conditions: ConditionResponse[];
  eventingStatus?: EventingStatusResponse;
  stateStatus: StateStatusResponse;
  /** Absent when the operator reports no rollout. */
  rollout?: RolloutStatusResponse;
}

/** Capp metadata and spec, without status. Shared by CappResponse and CappRevisionResponse. */
export interface BareCappResponse {
  name: string;
  namespace: string;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  scaleSpec: ScaleSpec;
  state?: CappState;
  image: string;
  containerName?: string;
  size?: CappSize;
  resources?: ResourceSpec;
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
  routeSpec?: RouteSpec;
  logSpec?: LogSpec;
  nfsVolumes?: NFSVolume[];
  secretVolumes?: SecretVolume[];
  configMapVolumes?: ConfigMapVolume[];
  imagePullSecrets?: string[];
  eventSourcesSpec?: EventSourcesSpec;
  reloadOnBoundResourceChange?: boolean;
}

export interface CappResponse extends BareCappResponse {
  status: CappStatusResponse;
  /** Side effects that failed while the cluster write itself succeeded. */
  warnings?: Warning[];
}

/** A non-fatal problem attached to an otherwise successful response. */
export interface Warning {
  code: string;
  message: string;
}

/** DELETE /capps/:name answers 204 with no body, or 200 with warnings. */
export interface DeleteCappResponse {
  warnings?: Warning[];
}

/** Router state used to carry warnings across a redirect. */
export interface WarningNavState {
  warnings?: Warning[];
}

export interface CappListResponse {
  items: CappResponse[];
  total: number;
}

/**
 * A historical snapshot of a Capp, recorded by the operator as a CappRevision on
 * every spec, label or annotation change. `name`, `namespace`, `createdAt`, `uid`
 * and `resourceVersion` identify the revision object; the rest is the Capp as recorded.
 */
export interface CappRevisionResponse extends BareCappResponse {
  revisionNumber: number;
}

/** GET .../capps/:name/revisions — newest first. */
export interface CappRevisionListResponse {
  items: CappRevisionResponse[];
  total: number;
}

// ── Size definitions (GET /api/v1/sizes) ──────────────────────────────────

export interface ResourceSize {
  requests: ResourceQuantities;
  limits: ResourceQuantities;
}

export interface CappSizesResponse {
  small: ResourceSize;
  medium: ResourceSize;
  large: ResourceSize;
}

// ── Sync to Git ────────────────────────────────────────────────────────────

export interface SyncToGitResponse {
  enabled: boolean;
  commitSha?: string;
  path: string;
}

export const LABEL_BACKUP_TO_GIT = 'rcs.dana.io/backup-to-git';

/** Free-text message shown as a banner on the Capp page. */
export const ANNOTATION_MESSAGE = 'rcs.dana.io/message';

/** Holds `<action>:<revision>` until the operator consumes the rollout action. */
export const ANNOTATION_ROLLOUT = 'rcs.dana.io/rollout';

export function hasBackupLabel(labels?: Record<string, string>): boolean {
  return labels != null && labels[LABEL_BACKUP_TO_GIT] === 'true';
}

// ── Migration ──────────────────────────────────────────────────────────────

export interface MigrateRequest {
  targetCluster: string;
  targetNamespace: string;
  deleteSource: boolean;
  targetHostname?: string;
}

export interface MigrateResponse {
  name: string;
  sourceCluster: string;
  sourceNamespace: string;
  targetCluster: string;
  targetNamespace: string;
  sourceDeleted: boolean;
  copiedSecrets?: string[];
  copiedConfigMaps?: string[];
}

// ── Cluster ────────────────────────────────────────────────────────────────

export interface ClusterMeta {
  name: string;
  displayName: string;
  healthy: boolean;
  isOpenShift?: boolean;
  gitOpsPath?: string;
  allowedNamespaces?: string[];
}

// ── Legacy K8s types (for YAML preview only) ──────────────────────────────
// cappBuilder.ts uses these to render the K8s YAML in the CappForm editor.
// They are never sent to capp-backend over the network.

export interface LegacyCappSpec {
  scaleSpec?: ScaleSpec;
  state?: CappState;
  size?: CappSize;
  configurationSpec: {
    template: {
      spec: {
        containers: Array<{
          name?: string;
          image: string;
          env?: EnvVar[];
          volumeMounts?: VolumeMount[];
          resources?: ResourceSpec;
        }>;
        imagePullSecrets?: Array<{ name: string }>;
      };
    };
  };
  routeSpec?: {
    hostname?: string;
    tlsEnabled?: boolean;
    routeTimeoutSeconds?: number;
    rolloutStrategy?: RolloutStrategy;
  };
  logSpec?: LogSpec;
  volumesSpec?: {
    nfsVolumes?: Array<{
      name: string;
      server: string;
      path: string;
      capacity: { storage: string };
    }>;
    secretVolumes?: Array<{ name: string; secretName: string; mountPath: string }>;
    configMapVolumes?: Array<{ name: string; configMapName: string; mountPath: string }>;
  };
}

export type LegacyCapp = K8sResource<LegacyCappSpec, unknown>;

// FlatCondition is an alias kept for anything that imported it
export type FlatCondition = ConditionResponse;

// Legacy Capp type alias — only used by cappBuilder for YAML preview
export type Capp = LegacyCapp;
