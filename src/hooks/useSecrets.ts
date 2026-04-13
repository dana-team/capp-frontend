import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSecrets, listSecretsInNamespace, getSecret, deleteSecret, createSecret, updateSecret } from '@/api/secrets';
import { SecretRequest, SecretUpdateRequest } from '@/types/secret';
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';

export function useSecrets(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['secrets', getBackendUrl(), cluster, namespace ?? 'all'],
    queryFn: () => (namespace ? listSecretsInNamespace(namespace) : listSecrets()),
    select: (data) => data.items,
    enabled: Boolean(cluster),
  });
}

export function useSecret(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['secret', getBackendUrl(), cluster, namespace, name],
    queryFn: () => getSecret(namespace, name),
    enabled: Boolean(cluster && namespace && name),
  });
}

export function useCreateSecret() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, req }: { namespace: string; req: SecretRequest }) =>
      createSecret(namespace, req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['secrets', getBackendUrl(), cluster] });
      queryClient.invalidateQueries({ queryKey: ['secrets', getBackendUrl(), cluster, variables.namespace] });
    },
  });
}

export function useUpdateSecret() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({
      namespace,
      name,
      req,
    }: {
      namespace: string;
      name: string;
      req: SecretUpdateRequest;
    }) => updateSecret(namespace, name, req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['secrets', getBackendUrl(), cluster] });
      queryClient.invalidateQueries({ queryKey: ['secret', getBackendUrl(), cluster, variables.namespace, variables.name] });
    },
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteSecret(namespace, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['secrets', getBackendUrl(), cluster] });
      queryClient.removeQueries({ queryKey: ['secret', getBackendUrl(), cluster, variables.namespace, variables.name] });
    },
  });
}
