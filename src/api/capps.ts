import { backendClient, clusterBase } from './client';
import { CappRequest, CappResponse, CappListResponse, CappRevisionListResponse, CappSizesResponse, SyncToGitResponse, DeleteCappResponse, MigrateRequest, MigrateResponse, RolloutActionRequest } from '@/types/capp';

/** Fetch the configured t-shirt size definitions (no auth required). */
export function fetchSizes(): Promise<CappSizesResponse> {
  return backendClient<CappSizesResponse>('/api/v1/sizes');
}

/** List all Capps across all namespaces in the selected cluster. */
export function listCapps(cluster: string): Promise<CappListResponse> {
  return backendClient<CappListResponse>(`${clusterBase(cluster)}/capps`);
}

/** List Capps in a specific namespace. */
export function listCappsInNamespace(cluster: string, namespace: string): Promise<CappListResponse> {
  return backendClient<CappListResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/capps`
  );
}

export function getCapp(cluster: string, namespace: string, name: string): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`
  );
}

export function createCapp(namespace: string, req: CappRequest): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps`,
    { method: 'POST', body: JSON.stringify(req) }
  );
}

export function updateCapp(
  namespace: string,
  name: string,
  req: CappRequest
): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`,
    { method: 'PUT', body: JSON.stringify(req) }
  );
}

/** Resolves to undefined on a clean delete (204), or the warnings body (200). */
export function deleteCapp(
  namespace: string,
  name: string
): Promise<DeleteCappResponse | undefined> {
  return backendClient<DeleteCappResponse | undefined>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
}

export function syncCappToGit(namespace: string, name: string): Promise<SyncToGitResponse> {
  return backendClient<SyncToGitResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/sync`,
    { method: 'POST' }
  );
}

export function disableCappGitSync(namespace: string, name: string): Promise<SyncToGitResponse> {
  return backendClient<SyncToGitResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/sync`,
    { method: 'DELETE' }
  );
}

export function migrateCapp(
  namespace: string,
  name: string,
  req: MigrateRequest
): Promise<MigrateResponse> {
  return backendClient<MigrateResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/migrate`,
    { method: 'POST', body: JSON.stringify(req) }
  );
}

/** Answers 202: the operator applies the action asynchronously and may still refuse it. */
export function rolloutAction(
  namespace: string,
  name: string,
  req: RolloutActionRequest
): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/rollout`,
    { method: 'POST', body: JSON.stringify(req) }
  );
}

/** Moves live traffic: the operator promotes a Ready candidate, otherwise pins to stable. */
export function removeRolloutStrategy(namespace: string, name: string): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/rollout/strategy`,
    { method: 'DELETE' }
  );
}

/** Revisions of a Capp, newest first. */
export function listCappRevisions(cluster: string, namespace: string, name: string): Promise<CappRevisionListResponse> {
  return backendClient<CappRevisionListResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/revisions`
  );
}

/** Restores the Capp's spec, labels and annotations from a revision; returns the updated Capp. */
export function rollbackCapp(namespace: string, name: string, revision: number): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/revisions/${revision}/rollback`,
    { method: 'POST' }
  );
}
