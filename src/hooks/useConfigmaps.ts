import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listConfigMaps,
  listConfigMapsInNamespace,
  getConfigMap,
  deleteConfigMap,
  createConfigMap,
  updateConfigMap,
} from "@/api/configmaps";
import { ConfigMapRequest, ConfigMapUpdateRequest } from "@/types/configmap";
import { useAuthStore } from "@/store/auth";
import { getBackendUrl } from "@/lib/config";
import { NO_AUTO_REFETCH, refreshQueries } from "@/lib/query";
import { useNamespaceContext } from "@/context/NamespaceContext";

export function useConfigmaps(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: ["configmaps", getBackendUrl(), cluster, namespace ?? "all"],
    queryFn: () =>
      namespace ? listConfigMapsInNamespace(cluster, namespace) : listConfigMaps(cluster),
    select: (data) => data.items,
    enabled: Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

export function useConfigMap(
  namespace: string,
  name: string,
  options?: typeof NO_AUTO_REFETCH,
) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["configmap", getBackendUrl(), cluster, namespace, name],
    queryFn: () => getConfigMap(cluster, namespace, name),
    enabled: Boolean(cluster && namespace && name),
    ...options,
  });
}

export function useCreateConfigmap() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({
      namespace,
      req,
    }: {
      namespace: string;
      req: ConfigMapRequest;
    }) => createConfigMap(namespace, req),
    onSuccess: () =>
      refreshQueries(queryClient, ["configmaps", getBackendUrl(), cluster]),
  });
}

export function useUpdateConfigmap() {
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
      req: ConfigMapUpdateRequest;
    }) => updateConfigMap(namespace, name, req),
    onSuccess: (_data, variables) =>
      refreshQueries(
        queryClient,
        ["configmaps", getBackendUrl(), cluster],
        ["configmap", getBackendUrl(), cluster, variables.namespace, variables.name],
        // An update rolls out opted-in Capps, so their pages are stale too.
        ["capps", getBackendUrl(), cluster],
        ["capp", getBackendUrl(), cluster],
      ),
  });
}

export function useDeleteConfigmap() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteConfigMap(namespace, name),
    onSuccess: async (_data, variables) => {
      await refreshQueries(queryClient, ["configmaps", getBackendUrl(), cluster]);
      // Gone now: refetching these would only return a 404.
      queryClient.removeQueries({
        queryKey: ["configmap", getBackendUrl(), cluster, variables.namespace, variables.name],
      });
    },
  });
}
