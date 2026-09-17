import { backendClient, clusterBase } from './client';
import { CappRequest, CappResponse, CappListResponse, CappSizesResponse, SyncToGitResponse, DeleteCappResponse } from '@/types/capp';

/** Fetch the configured t-shirt size definitions (no auth required). */
export function fetchSizes(): Promise<CappSizesResponse> {
  return backendClient<CappSizesResponse>('/api/v1/sizes');
}

/** List all Capps across all namespaces in the selected cluster. */
export function listCapps(): Promise<CappListResponse> {
  return backendClient<CappListResponse>(`${clusterBase()}/capps`);
}

/** List Capps in a specific namespace. */
export function listCappsInNamespace(namespace: string): Promise<CappListResponse> {
  return backendClient<CappListResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps`
  );
}

export function getCapp(namespace: string, name: string): Promise<CappResponse> {
  return backendClient<CappResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`
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
