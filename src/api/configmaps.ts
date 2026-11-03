import { backendClient, clusterBase } from './client';
import { ConfigMapListResponse, ConfigMapRequest, ConfigMapResponse, ConfigMapUpdateRequest } from '@/types/configmap';


/** List all ConfigMaps across all namespaces in the selected cluster. */
export function listConfigMaps(cluster: string): Promise<ConfigMapListResponse> {
  return backendClient<ConfigMapListResponse>(`${clusterBase(cluster)}/configmaps`);
}


export function listConfigMapsInNamespace(cluster: string, namespace: string): Promise<ConfigMapListResponse> {
  return backendClient<ConfigMapListResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/configmaps`
  );
}


export function getConfigMap(cluster: string, namespace: string, name: string): Promise<ConfigMapResponse> {
  return backendClient<ConfigMapResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/configmaps/${encodeURIComponent(name)}`
  );
}

export function deleteConfigMap(namespace: string, name: string): Promise<void> {
  return backendClient<void>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/configmaps/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
}

export function createConfigMap(namespace: string, req: ConfigMapRequest): Promise<ConfigMapResponse> {
  return backendClient<ConfigMapResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/configmaps`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }
  );
}

export function updateConfigMap(namespace: string, name: string, req: ConfigMapUpdateRequest): Promise<ConfigMapResponse> {
  return backendClient<ConfigMapResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/configmaps/${encodeURIComponent(name)}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }
  );
}