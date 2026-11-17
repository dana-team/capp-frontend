import { backendClient, clusterBase } from './client';
import type {
  FunctionListResponse,
  FunctionLogsResponse,
  FunctionRequest,
  FunctionResponse,
  FunctionTestRequest,
  FunctionTestResponse,
  NameListResponse,
  PoolListResponse,
  PoolRequest,
  PoolResponse,
} from '@/types/cfunc';

const seg = encodeURIComponent;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function listFlavors(): Promise<NameListResponse> {
  return backendClient<NameListResponse>('/api/v1/cfunc/flavors');
}

export function listPoolSizes(): Promise<NameListResponse> {
  return backendClient<NameListResponse>('/api/v1/cfunc/sizes');
}

// ── Pools ────────────────────────────────────────────────────────────────────

const poolsPath = (cluster: string | undefined, namespace: string) =>
  `${clusterBase(cluster)}/namespaces/${seg(namespace)}/cfunc/pools`;

export function listPools(cluster: string, namespace?: string): Promise<PoolListResponse> {
  return backendClient<PoolListResponse>(
    namespace ? poolsPath(cluster, namespace) : `${clusterBase(cluster)}/cfunc/pools`,
  );
}

export function getPool(cluster: string, namespace: string, name: string): Promise<PoolResponse> {
  return backendClient<PoolResponse>(`${poolsPath(cluster, namespace)}/${seg(name)}`);
}

export function createPool(namespace: string, req: PoolRequest): Promise<PoolResponse> {
  return backendClient<PoolResponse>(poolsPath(undefined, namespace), json('POST', req));
}

export function updatePool(namespace: string, name: string, req: PoolRequest): Promise<PoolResponse> {
  return backendClient<PoolResponse>(`${poolsPath(undefined, namespace)}/${seg(name)}`, json('PUT', req));
}

export function deletePool(namespace: string, name: string): Promise<void> {
  return backendClient<void>(`${poolsPath(undefined, namespace)}/${seg(name)}`, { method: 'DELETE' });
}

// ── Functions ────────────────────────────────────────────────────────────────

const functionsPath = (cluster: string | undefined, namespace: string) =>
  `${clusterBase(cluster)}/namespaces/${seg(namespace)}/cfunc/functions`;

export function listFunctions(cluster: string, namespace?: string): Promise<FunctionListResponse> {
  return backendClient<FunctionListResponse>(
    namespace ? functionsPath(cluster, namespace) : `${clusterBase(cluster)}/cfunc/functions`,
  );
}

export function getFunction(cluster: string, namespace: string, name: string): Promise<FunctionResponse> {
  return backendClient<FunctionResponse>(`${functionsPath(cluster, namespace)}/${seg(name)}`);
}

export function createFunction(namespace: string, req: FunctionRequest): Promise<FunctionResponse> {
  return backendClient<FunctionResponse>(functionsPath(undefined, namespace), json('POST', req));
}

export function updateFunction(namespace: string, name: string, req: FunctionRequest): Promise<FunctionResponse> {
  return backendClient<FunctionResponse>(`${functionsPath(undefined, namespace)}/${seg(name)}`, json('PUT', req));
}

export function deleteFunction(namespace: string, name: string): Promise<void> {
  return backendClient<void>(`${functionsPath(undefined, namespace)}/${seg(name)}`, { method: 'DELETE' });
}

export function testFunction(namespace: string, name: string, req: FunctionTestRequest): Promise<FunctionTestResponse> {
  return backendClient<FunctionTestResponse>(
    `${functionsPath(undefined, namespace)}/${seg(name)}/test`,
    json('POST', req),
  );
}

export function getFunctionLogs(
  cluster: string,
  namespace: string,
  name: string,
  lines: number,
): Promise<FunctionLogsResponse> {
  return backendClient<FunctionLogsResponse>(
    `${functionsPath(cluster, namespace)}/${seg(name)}/logs?lines=${lines}`,
  );
}
