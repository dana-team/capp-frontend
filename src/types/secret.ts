import type { Warning } from './capp';
import type { Drift, DriftMissing } from './drift';

export interface SecretRequest {
  name: string;
  namespace: string;
  type?: string;
  data: Record<string, string>;
}

export interface SecretResponse {
  name: string;
  namespace: string;
  type?: string;
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

export interface SecretListResponse {
  items: SecretResponse[];
  total: number;
  /** Recorded Secrets that no longer exist; not counted in total. */
  missing?: DriftMissing[];
}

export interface SecretUpdateRequest {
  data: Record<string, string>;
}
