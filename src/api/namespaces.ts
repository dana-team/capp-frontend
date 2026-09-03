import { backendClient } from './client';
import { useAuthStore } from '@/store/auth';

export interface UsedQuotaInfo {
    cpu?: string;
    memory?: string;
    pods?: number | null;
}

export interface QuotaInfo extends UsedQuotaInfo {
    used?: UsedQuotaInfo;
}

export interface NamespaceItem {
    name: string;
    status: string;
    quota?: QuotaInfo;
    users?: string[];
    canEdit: boolean;
}

export interface NamespaceListResponse {
    items: NamespaceItem[];
    canCreate: boolean;
}

export interface NamespaceQuota {
    cpu?: string;
    memory?: string;
    pods?: number;
}

export interface CreateNamespaceRequest {
    name: string;
    users?: string[];
    quota?: NamespaceQuota;
}

export interface UpdateNamespaceRequest {
    users?: string[];
    quota?: NamespaceQuota;
}

export interface PatchNamespaceRequest {
    users?: string[];
}

export function listNamespaces(): Promise<NamespaceListResponse> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceListResponse>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces`
    );
}

export function createNamespace(req: CreateNamespaceRequest): Promise<NamespaceItem> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceItem>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces`,
        {
            method: 'POST',
            body: JSON.stringify(req),
        }
    );
}

export function updateNamespace(name: string, req: UpdateNamespaceRequest): Promise<NamespaceItem> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceItem>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(name)}`,
        {
            method: 'PUT',
            body: JSON.stringify(req),
        }
    );
}

export function patchNamespace(name: string, req: PatchNamespaceRequest): Promise<NamespaceItem> {
    const { cluster } = useAuthStore.getState();
    return backendClient<NamespaceItem>(
        `/api/v1/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(name)}`,
        {
            method: 'PATCH',
            body: JSON.stringify(req),
        }
    );
}
