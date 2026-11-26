import { backendClient, clusterBase } from './client';
import type { DriftActionRequest, DriftActionResponse } from '@/types/drift';

/** The kinds whose drift can be resolved one object at a time, by their path segment. */
export type DriftKind = 'capps' | 'configmaps' | 'secrets';
export type DriftAction = 'revert' | 'accept';

/**
 * Revert makes the cluster match the backup; accept makes the backup match the cluster.
 * Both act only on the drift the caller saw, and answer 409 if it changed since.
 */
export function resolveDrift(
  kind: DriftKind,
  action: DriftAction,
  namespace: string,
  name: string,
  seen: DriftActionRequest,
): Promise<DriftActionResponse> {
  return backendClient<DriftActionResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/${kind}/${encodeURIComponent(name)}/drift/${action}`,
    { method: 'POST', body: JSON.stringify(seen) },
  );
}
