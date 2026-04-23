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

export function useConfigmaps(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["configmaps", getBackendUrl(), cluster, namespace ?? "all"],
    queryFn: () =>
      namespace ? listConfigMapsInNamespace(namespace) : listConfigMaps(),
    select: (data) => data.items,
    enabled: Boolean(cluster),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 3000,
  });
}

export function useConfigMap(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["configmap", getBackendUrl(), cluster, namespace, name],
    queryFn: () => getConfigMap(namespace, name),
    enabled: Boolean(cluster && namespace && name),
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["configmaps", getBackendUrl(), cluster],
      });
      queryClient.invalidateQueries({
        queryKey: ["configmaps", getBackendUrl(), cluster, variables.namespace],
      });
    },
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["configmaps", getBackendUrl(), cluster],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "configmap",
          getBackendUrl(),
          cluster,
          variables.namespace,
          variables.name,
        ],
      });
    },
  });
}

export function useDeleteConfigmap() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteConfigMap(namespace, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["configmaps", getBackendUrl(), cluster],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "configmap",
          getBackendUrl(),
          cluster,
          variables.namespace,
          variables.name,
        ],
      });
    },
  });
}
