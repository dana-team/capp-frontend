import type { EnvVar, ResourceSpec } from './capp';

export interface CfuncCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface CfuncStatus {
  observedGeneration?: number;
  conditions: CfuncCondition[];
}

export interface NameListResponse {
  items: string[];
  total: number;
}

// ── Pools ────────────────────────────────────────────────────────────────────

export interface PoolAdvanced {
  buildImage?: string;
  buildCommand?: string;
  resources?: ResourceSpec;
}

export interface PoolRequest {
  name: string;
  flavor: string;
  size?: string;
  poolSize?: number;
  env?: EnvVar[];
  advanced?: PoolAdvanced;
}

export interface PoolResponse {
  name: string;
  namespace: string;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  /** Empty when the pool's image matches no configured flavor. */
  flavor: string;
  /** Empty when the pool's resources match no configured size. */
  size: string;
  poolSize: number;
  resources?: ResourceSpec;
  image: string;
  builder?: { image: string; command?: string };
  env?: EnvVar[];
  advanced?: PoolAdvanced;
  version: number;
  terminationGracePeriodSeconds: number;
  status: CfuncStatus;
}

export interface PoolListResponse {
  items: PoolResponse[];
  total: number;
}

// ── Functions ────────────────────────────────────────────────────────────────

export type TriggerType = 'http' | 'cron';

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

export interface FunctionSource {
  url: string;
  ref?: string;
  path?: string;
  build?: boolean;
  /** Response only. */
  commit?: string;
}

export interface FunctionTrigger {
  name: string;
  type: TriggerType;
  path?: string;
  methods?: string[];
  schedule?: string;
  /** Response only: the path the router serves. */
  fullPath?: string;
  /** Response only: absent when the backend has no router URL for the cluster. */
  url?: string;
  /** Response only: the reason of the trigger's Ready condition. */
  status?: string;
  /** Response only. */
  message?: string;
}

export interface FunctionAdvanced {
  concurrency?: number;
  requestsPerPod?: number;
  idleTimeoutSeconds?: number;
  onceOnly?: boolean;
  retainPods?: number;
  specializationTimeoutSeconds?: number;
  buildCommand?: string;
}

export interface FunctionSecretVolume {
  secretName: string;
  name?: string;
  mountPath?: string;
}

export interface FunctionConfigMapVolume {
  configMapName: string;
  name?: string;
  mountPath?: string;
}

export interface FunctionRequest {
  name: string;
  pool: string;
  source: FunctionSource;
  entrypoint?: string;
  timeoutSeconds?: number;
  secretVolumes?: FunctionSecretVolume[];
  configMapVolumes?: FunctionConfigMapVolume[];
  triggers?: FunctionTrigger[];
  advanced?: FunctionAdvanced;
}

/** "" until Fission has seen the package; "none" when the code needs no build. */
export type BuildStatus = '' | 'pending' | 'running' | 'succeeded' | 'failed' | 'none';

export interface FunctionResponse {
  name: string;
  namespace: string;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  pool: string;
  source: FunctionSource;
  entrypoint?: string;
  timeoutSeconds: number;
  secretVolumes?: FunctionSecretVolume[];
  configMapVolumes?: FunctionConfigMapVolume[];
  triggers: FunctionTrigger[];
  advanced?: FunctionAdvanced;
  build: { status: BuildStatus; log?: string };
  status: CfuncStatus;
}

export interface FunctionListResponse {
  items: FunctionResponse[];
  total: number;
}

export interface FunctionTestRequest {
  trigger?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FunctionTestResponse {
  url: string;
  method: string;
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  truncated?: boolean;
  durationMs: number;
}

export interface FunctionLogsResponse {
  pods: { pod: string; lines: string[] }[];
}
