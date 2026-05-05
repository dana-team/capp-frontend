import { backendClient } from './client';
import { useAuthStore } from '@/store/auth';

export interface NamespaceItem {
    name: string;
    status: string;
}

export interface NamespaceListResponse {
    items: NamespaceItem[];
    canCreate: boolean;
}

export function listNamespaces(): Promise<NamespaceListResponse> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceListResponse>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces`
    );
}

export function createNamespace(name: string): Promise<NamespaceItem> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceItem>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces`,
        {
            method: 'POST',
            body: JSON.stringify({ name }),
        }
    );
}