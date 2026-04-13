import { backendClient, clusterBase } from './client';
import { SecretListResponse, SecretRequest, SecretResponse, SecretUpdateRequest } from '@/types/secret';

/** List all Secrets across all namespaces in the selected cluster. */
export function listSecrets(): Promise<SecretListResponse> {
  return backendClient<SecretListResponse>(`${clusterBase()}/secrets`);
}

export function listSecretsInNamespace(namespace: string): Promise<SecretListResponse> {
  return backendClient<SecretListResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/secrets`
  );
}

export function getSecret(namespace: string, name: string): Promise<SecretResponse> {
  return backendClient<SecretResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`
  );
}

export function deleteSecret(namespace: string, name: string): Promise<void> {
  return backendClient<void>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
}

export function createSecret(namespace: string, req: SecretRequest): Promise<SecretResponse> {
  return backendClient<SecretResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/secrets`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }
  );
}

export function updateSecret(namespace: string, name: string, req: SecretUpdateRequest): Promise<SecretResponse> {
  return backendClient<SecretResponse>(
    `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }
  );
}
