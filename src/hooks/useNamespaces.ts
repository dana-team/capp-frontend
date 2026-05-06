import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNamespaces, createNamespace } from '@/api/namespaces';
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

export function useCreateNamespace() {
    const queryClient = useQueryClient();
    const cluster = useAuthStore((s) => s.cluster);
    const backendUrl = getBackendUrl();

    return useMutation({
        mutationFn: (name: string) => createNamespace(name),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['namespaces', backendUrl, cluster],
            });
        },
    });
}