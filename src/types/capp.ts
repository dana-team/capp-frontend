import type { K8sResource } from './kubernetes';

// ── Backend DTO types (capp-backend REST API) ─────────────────────────────────
// These mirror the Go types in capp-backend/internal/resources/capps/types.go

export type ScaleMetric = 'concurrency' | 'cpu' | 'memory' | 'rps';
export type CappState = 'enabled' | 'disabled';

export interface EnvVar {
  name: string;
  value: string;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

export interface RouteSpec {
  hostname?: string;
  tlsEnabled?: boolean;
  routeTimeoutSeconds?: number | null;
}

export interface LogSpec {
  type: 'elastic' | 'elastic-datastream';
  host: string;
  index?: string;
  user: string;
  passwordSecret: string;
}

export interface NFSVolume {
  name: string;
  server: string;
  path: string;
  capacity: string; // e.g. "10Gi"
}

export interface ScaleSpec {
  metric?: ScaleMetric | '';
  minReplicas?: number;
  scaleDelaySeconds?: number;
}

// ── Request body for create / update ──────────────────────────────────────

export interface CappRequest {
  name: string;
  namespace?: string;
  scaleSpec?: ScaleSpec;
  state?: CappState;
  image: string;
  containerName?: string;
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
  routeSpec?: RouteSpec;
  logSpec?: LogSpec;
  nfsVolumes?: NFSVolume[];
}

// ── Response types ─────────────────────────────────────────────────────────

export interface ConditionResponse {
  source: string;
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ApplicationLinksResponse {
  site?: string;
  consoleLink?: string;
}

export interface StateStatusResponse {
  state?: string;
  lastChange?: string;
}

export interface CappStatusResponse {
  conditions: ConditionResponse[];
  applicationLinks: ApplicationLinksResponse;
  stateStatus: StateStatusResponse;
}

export interface CappResponse {
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
  env?: EnvVar[];
  volumeMounts?: VolumeMount[];
  routeSpec?: RouteSpec;
  logSpec?: LogSpec;
  nfsVolumes?: NFSVolume[];
  status: CappStatusResponse;
}

export interface CappListResponse {
  items: CappResponse[];
  total: number;
}

// ── Cluster ────────────────────────────────────────────────────────────────

export interface ClusterMeta {
  name: string;
  displayName: string;
  healthy: boolean;
}

// ── Legacy K8s types (for YAML preview only) ──────────────────────────────
// cappBuilder.ts uses these to render the K8s YAML in the CappForm editor.
// They are never sent to capp-backend over the network.

export interface LegacyCappSpec {
  scaleSpec?: ScaleSpec;
  state?: CappState;
  configurationSpec: {
    template: {
      spec: {
        containers: Array<{
          name?: string;
          image: string;
          env?: EnvVar[];
          volumeMounts?: VolumeMount[];
        }>;
      };
    };
  };
  routeSpec?: {
    hostname?: string;
    tlsEnabled?: boolean;
    routeTimeoutSeconds?: number;
  };
  logSpec?: LogSpec;
  volumesSpec?: {
    nfsVolumes?: Array<{
      name: string;
      server: string;
      path: string;
      capacity: { storage: string };
    }>;
  };
}

export type LegacyCapp = K8sResource<LegacyCappSpec, unknown>;

// FlatCondition is an alias kept for anything that imported it
export type FlatCondition = ConditionResponse;

// Legacy Capp type alias — only used by cappBuilder for YAML preview
export type Capp = LegacyCapp;
