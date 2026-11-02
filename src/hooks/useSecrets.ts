import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSecrets,
  listSecretsInNamespace,
  getSecret,
  deleteSecret,
  createSecret,
  updateSecret,
} from "@/api/secrets";
import { SecretRequest, SecretUpdateRequest } from "@/types/secret";
import { useAuthStore } from "@/store/auth";
import { getBackendUrl } from "@/lib/config";
import { NO_AUTO_REFETCH, refreshQueries } from "@/lib/query";
import { useNamespaceContext } from "@/context/NamespaceContext";

export function useSecrets(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: ["secrets", getBackendUrl(), cluster, namespace ?? "all"],
    queryFn: () =>
      namespace ? listSecretsInNamespace(cluster, namespace) : listSecrets(cluster),
    select: (data) => data.items,
    enabled: Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

export function useSecret(
  namespace: string,
  name: string,
  options?: typeof NO_AUTO_REFETCH,
) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["secret", getBackendUrl(), cluster, namespace, name],
    queryFn: () => getSecret(cluster, namespace, name),
    enabled: Boolean(cluster && namespace && name),
    ...options,
  });
}

export function useCreateSecret() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({
      namespace,
      req,
    }: {
      namespace: string;
      req: SecretRequest;
    }) => createSecret(namespace, req),
    onSuccess: () =>
      refreshQueries(queryClient, ["secrets", getBackendUrl(), cluster]),
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
    onSuccess: (_data, variables) =>
      refreshQueries(
        queryClient,
        ["secrets", getBackendUrl(), cluster],
        ["secret", getBackendUrl(), cluster, variables.namespace, variables.name],
      ),
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteSecret(namespace, name),
    onSuccess: async (_data, variables) => {
      await refreshQueries(queryClient, ["secrets", getBackendUrl(), cluster]);
      // Gone now: refetching these would only return a 404.
      queryClient.removeQueries({
        queryKey: ["secret", getBackendUrl(), cluster, variables.namespace, variables.name],
      });
    },
  });
}
