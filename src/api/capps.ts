import { backendClient, clusterBase } from './client';
import { CappRequest, CappResponse, CappListResponse } from '@/types/capp';


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

export function deleteCapp(namespace: string, name: string): Promise<void> {
  return backendClient<void>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
}
