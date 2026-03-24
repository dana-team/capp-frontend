import { backendClient, BackendApiError } from './client';
import { ClusterMeta } from '@/types/capp';

interface ClusterListResponse {
  items: ClusterMeta[];
}

/** List clusters using the credentials already in the auth store. */
export function listClusters(): Promise<ClusterListResponse> {
  return backendClient<ClusterListResponse>('/api/v1/clusters');
}

/**
 * Fetch the cluster list directly using explicit credentials.
 * Used during login before the store is populated.
 */
export async function fetchClusters(
  backendUrl: string,
  token: string
): Promise<ClusterMeta[]> {
  const base = import.meta.env.DEV ? '' : backendUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(import.meta.env.DEV ? { 'X-Backend-Url': backendUrl.replace(/\/$/, '') } : {}),
  };

  const res = await fetch(`${base}/api/v1/clusters`, { headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json() as { error?: { message?: string; code?: string } };
      if (body.error?.message) message = body.error.message;
    } catch { /* ignore */ }
    throw new BackendApiError(message, res.status);
  }

  const data = await res.json() as ClusterListResponse;
  return data.items;
}
