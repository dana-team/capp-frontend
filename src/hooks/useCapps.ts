import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCapps,
  listCappsInNamespace,
  getCapp,
  createCapp,
  updateCapp,
  deleteCapp,
  syncCappToGit,
  disableCappGitSync,
  fetchSizes,
  migrateCapp,
  listCappRevisions,
  rollbackCapp,
} from "@/api/capps";
import { CappRequest, MigrateRequest, SyncToGitResponse } from "@/types/capp";
import { useAuthStore } from "@/store/auth";
import { getBackendUrl } from "@/lib/config";
import { NO_AUTO_REFETCH, refreshQueries } from "@/lib/query";
import { useNamespaceContext } from "@/context/NamespaceContext";

export function useCapps(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: ["capps", getBackendUrl(), cluster, namespace ?? "all"],
    queryFn: () => (namespace ? listCappsInNamespace(cluster, namespace) : listCapps(cluster)),
    select: (data) => data.items,
    enabled: Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

export function useCapp(
  namespace: string,
  name: string,
  options?: typeof NO_AUTO_REFETCH,
) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["capp", getBackendUrl(), cluster, namespace, name],
    queryFn: () => getCapp(cluster, namespace, name),
    enabled: Boolean(cluster && namespace && name),
    ...options,
  });
}

export function useCreateCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, req }: { namespace: string; req: CappRequest }) =>
      createCapp(namespace, req),
    onSuccess: () =>
      refreshQueries(queryClient, ["capps", getBackendUrl(), cluster]),
  });
}

export function useUpdateCapp() {
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
      req: CappRequest;
    }) => updateCapp(namespace, name, req),
    onSuccess: (_data, variables) =>
      refreshQueries(
        queryClient,
        ["capps", getBackendUrl(), cluster],
        ["capp", getBackendUrl(), cluster, variables.namespace, variables.name],
        ["capp-revisions", getBackendUrl(), cluster, variables.namespace, variables.name],
      ),
  });
}

function useGitSyncMutation(
  mutate: (namespace: string, name: string) => Promise<SyncToGitResponse>,
) {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      mutate(namespace, name),
    onSuccess: (_data, variables) =>
      refreshQueries(
        queryClient,
        ["capps", getBackendUrl(), cluster],
        ["capp", getBackendUrl(), cluster, variables.namespace, variables.name],
      ),
  });
}

export function useSyncCappToGit() {
  return useGitSyncMutation(syncCappToGit);
}

export function useDisableCappGitSync() {
  return useGitSyncMutation(disableCappGitSync);
}

export function useDeleteCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteCapp(namespace, name),
    onSuccess: async (_data, variables) => {
      await refreshQueries(queryClient, ["capps", getBackendUrl(), cluster]);
      // Gone now: refetching these would only return a 404.
      queryClient.removeQueries({
        queryKey: ["capp", getBackendUrl(), cluster, variables.namespace, variables.name],
      });
      queryClient.removeQueries({
        queryKey: ["capp-revisions", getBackendUrl(), cluster, variables.namespace, variables.name],
      });
    },
  });
}

export function useSizes() {
  return useQuery({
    queryKey: ["sizes", getBackendUrl()],
    queryFn: fetchSizes,
    staleTime: Infinity,
    ...NO_AUTO_REFETCH,
  });
}

export function useMigrateCapp() {
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
      req: MigrateRequest;
    }) => migrateCapp(namespace, name, req),
    onSuccess: (data, variables) => {
      const backendUrl = getBackendUrl();
      // Not awaited: the source Capp may be gone, and this would then wait out a
      // 404 and its retry.
      queryClient.invalidateQueries({
        queryKey: ["capp", backendUrl, cluster, variables.namespace, variables.name],
      });
      // Marked stale only: no need to wait for a cluster the user is not viewing.
      queryClient.invalidateQueries({
        queryKey: ["capps", backendUrl, data.targetCluster],
      });
      return refreshQueries(queryClient, ["capps", backendUrl, cluster]);
    },
  });
}

export function useCappRevisions(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ["capp-revisions", getBackendUrl(), cluster, namespace, name],
    queryFn: () => listCappRevisions(cluster, namespace, name),
    select: (data) => data.items,
    enabled: Boolean(cluster && namespace && name),
  });
}

export function useRollbackCapp() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({
      namespace,
      name,
      revision,
    }: {
      namespace: string;
      name: string;
      revision: number;
    }) => rollbackCapp(namespace, name, revision),
    onSuccess: (_data, variables) =>
      refreshQueries(
        queryClient,
        ["capps", getBackendUrl(), cluster],
        ["capp", getBackendUrl(), cluster, variables.namespace, variables.name],
        ["capp-revisions", getBackendUrl(), cluster, variables.namespace, variables.name],
      ),
  });
}
