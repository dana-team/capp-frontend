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
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';

export function useNamespaces() {
    const cluster = useAuthStore((s) => s.cluster);
    return useQuery({
        queryKey: ["namespaces", getBackendUrl(), cluster],
        queryFn: listNamespaces,
        enabled: Boolean(cluster),
        refetchInterval: 8000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        staleTime: 3000,
    });
}

function useNamespaceInvalidator() {
    const queryClient = useQueryClient();
    const cluster = useAuthStore((s) => s.cluster);
    const backendUrl = getBackendUrl();
    return () => queryClient.invalidateQueries({ queryKey: ['namespaces', backendUrl, cluster] });
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
