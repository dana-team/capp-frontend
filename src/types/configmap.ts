import type { Warning } from './capp';
import type { Drift, DriftMissing } from './drift';

export interface ConfigMapRequest {
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface ConfigMapResponse {
  name: string;
  namespace: string;
  data: Record<string, string>;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  warnings?: Warning[];
  /** Set on reads, unless desired state is disabled. */
  drift?: Drift;
}

export interface ConfigMapListResponse {
  items: ConfigMapResponse[];
  total: number;
  /** Recorded ConfigMaps that no longer exist; not counted in total. */
  missing?: DriftMissing[];
}

export interface ConfigMapUpdateRequest {
  data: Record<string, string>;
}