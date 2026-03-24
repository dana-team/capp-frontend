import { backendClient } from './client';
import { useAuthStore } from '@/store/auth';

export interface NamespaceItem {
  name: string;
  status: string;
}

interface NamespaceListResponse {
  items: NamespaceItem[];
}

export function listNamespaces(): Promise<NamespaceListResponse> {
  const { cluster } = useAuthStore.getState();
  return backendClient<NamespaceListResponse>(
    `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces`
  );
}
