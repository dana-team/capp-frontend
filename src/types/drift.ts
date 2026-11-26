// Drift DTOs of capp-backend (pkg/api/drift).

/**
 * `changed`: both exist and differ. `missing`: a desired state is recorded but the object is
 * gone. `unmanaged`: the object has no recorded desired state. `unavailable`: the desired
 * state could not be read or compared.
 */
export type DriftState = 'inSync' | 'changed' | 'missing' | 'unmanaged' | 'unavailable';

/** What an update does with an object that has drifted: start from the live object or from its desired state. */
export type OnDrift = 'accept' | 'revert';

/** One difference. An absent side means the field is unset there. Secrets never carry values. */
export interface DriftField {
  /** JSON pointer into the compared state, e.g. /spec/scaleSpec/maxReplicas. */
  path: string;
  desired?: unknown;
  live?: unknown;
}

/** Compares a live object with its recorded desired state. */
export interface Drift {
  state: DriftState;
  /** Sent back by a revert or accept, together with liveVersion, so it acts only on what was shown. */
  generation?: number;
  liveVersion?: string;
  /** The differences when state is `changed`. */
  fields?: DriftField[];
  updatedBy?: string;
  updatedAt?: string;
}

/** A recorded object that no longer exists in the cluster. */
export interface DriftMissing {
  namespace: string;
  name: string;
  drift: Drift;
}

/** Body of POST .../drift/revert and .../drift/accept. */
export interface DriftActionRequest {
  generation: number;
  /** Omit for a missing object. */
  liveVersion?: string;
}

/** `drift` is what is left, and is omitted when there is nothing to compare. */
export interface DriftActionResponse {
  drift?: Drift;
}

export interface DriftAdoptResponse {
  adopted: Array<{ kind: string; name: string }>;
  total: number;
}
