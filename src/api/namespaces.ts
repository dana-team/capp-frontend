import { backendClient } from './client';
import { useAuthStore } from '@/store/auth';
import type { Warning } from '@/types/capp';
import type { Drift, DriftMissing } from '@/types/drift';

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
    warnings?: Warning[];
    /** Set only when one namespace is read, unless desired state is disabled. */
    drift?: Drift;
}

export interface NamespaceListResponse {
    items: NamespaceItem[];
    canCreate: boolean;
    /** Recorded namespaces that no longer exist. Only for users who can create namespaces. */
    missing?: DriftMissing[];
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

export function listNamespaces(cluster: string): Promise<NamespaceListResponse> {
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
