import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    listNamespaces,
    createNamespace,
    updateNamespace,
    patchNamespace,
    CreateNamespaceRequest,
    UpdateNamespaceRequest,
    PatchNamespaceRequest,
} from '@/api/namespaces';
import { listCapps } from '@/api/capps';
import { BackendApiError } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';
import { NO_AUTO_REFETCH, refreshQueries } from '@/lib/query';

export function useNamespaces() {
    const cluster = useAuthStore((s) => s.cluster);
    return useQuery({
        queryKey: ["namespaces", getBackendUrl(), cluster],
        queryFn: () => listNamespaces(cluster),
        enabled: Boolean(cluster),
    });
}

/**
 * Whether the user may list resources across all namespaces. There is no
 * permission endpoint, so this tries the cluster-wide Capp list once per
 * cluster: a 403 means the user only has access to some namespaces. Other
 * errors surface as a query error, and callers fall back to allowing it.
 */
export function useCanListAllNamespaces() {
    const cluster = useAuthStore((s) => s.cluster);
    const queryClient = useQueryClient();
    const backendUrl = getBackendUrl();
    return useQuery({
        queryKey: ["canListAllNamespaces", backendUrl, cluster],
        queryFn: async () => {
            try {
                const capps = await listCapps(cluster);
                // Hand the result to the Capp list so it does not fetch it again.
                queryClient.setQueryData(["capps", backendUrl, cluster, "all"], capps);
                return true;
            } catch (e) {
                if (e instanceof BackendApiError && e.status === 403) return false;
                throw e;
            }
        },
        enabled: Boolean(cluster),
        staleTime: Infinity,
        retry: false,
        ...NO_AUTO_REFETCH,
    });
}

export function useNamespacesForCluster(cluster: string) {
    return useQuery({
        queryKey: ["namespacesForCluster", getBackendUrl(), cluster],
        queryFn: () => listNamespaces(cluster),
        select: (data) => data.items,
        enabled: Boolean(cluster),
    });
}

function useNamespaceInvalidator() {
    const queryClient = useQueryClient();
    const cluster = useAuthStore((s) => s.cluster);
    const backendUrl = getBackendUrl();
    return () =>
        refreshQueries(
            queryClient,
            ['namespaces', backendUrl, cluster],
            ['namespacesForCluster', backendUrl, cluster],
        );
}

export function useCreateNamespace() {
    const invalidate = useNamespaceInvalidator();
    return useMutation({
        mutationFn: (req: CreateNamespaceRequest) => createNamespace(req),
        onSuccess: invalidate,
    });
}

export function useUpdateNamespace() {
    const invalidate = useNamespaceInvalidator();
    return useMutation({
        mutationFn: ({ name, req }: { name: string; req: UpdateNamespaceRequest }) =>
            updateNamespace(name, req),
        onSuccess: invalidate,
    });
}

export function usePatchNamespace() {
    const invalidate = useNamespaceInvalidator();
    return useMutation({
        mutationFn: ({ name, req }: { name: string; req: PatchNamespaceRequest }) =>
            patchNamespace(name, req),
        onSuccess: invalidate,
    });
}
