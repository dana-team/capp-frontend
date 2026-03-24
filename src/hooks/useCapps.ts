import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCapps, listCappsInNamespace, getCapp, createCapp, updateCapp, deleteCapp } from '@/api/capps';
import { CappRequest } from '@/types/capp';
import { useAuthStore } from '@/store/auth';

export function useCapps(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  return useQuery({
    queryKey: ['capps', backendUrl, cluster, namespace ?? 'all'],
    queryFn: () => (namespace ? listCappsInNamespace(namespace) : listCapps()),
    select: (data) => data.items,
    enabled: Boolean(cluster),
  });
}

export function useCapp(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  return useQuery({
    queryKey: ['capp', backendUrl, cluster, namespace, name],
    queryFn: () => getCapp(namespace, name),
    enabled: Boolean(cluster && namespace && name),
  });
}

export function useCreateCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);

  return useMutation({
    mutationFn: ({ namespace, req }: { namespace: string; req: CappRequest }) =>
      createCapp(namespace, req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, cluster] });
      queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, cluster, variables.namespace] });
    },
  });
}

export function useUpdateCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);

  return useMutation({
    mutationFn: ({
      namespace,
      name,
      req,
    }: {
      namespace: string;
      name: string;
      req: CappRequest;
    }) => updateCapp(namespace, name, req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, cluster] });
      queryClient.invalidateQueries({ queryKey: ['capp', backendUrl, cluster, variables.namespace, variables.name] });
    },
  });
}

export function useDeleteCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteCapp(namespace, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, cluster] });
      queryClient.invalidateQueries({ queryKey: ['capp', backendUrl, cluster, variables.namespace, variables.name] });
    },
  });
}
