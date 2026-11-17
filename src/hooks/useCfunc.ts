import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFunction,
  createPool,
  deleteFunction,
  deletePool,
  getFunction,
  getFunctionLogs,
  getPool,
  listFlavors,
  listFunctions,
  listPoolSizes,
  listPools,
  testFunction,
  updateFunction,
  updatePool,
} from '@/api/cfunc';
import { BackendApiError } from '@/api/client';
import type { FunctionRequest, FunctionTestRequest, PoolRequest } from '@/types/cfunc';
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';
import { NO_AUTO_REFETCH, refreshQueries } from '@/lib/query';
import { useNamespaceContext } from '@/context/NamespaceContext';

const HTTP_NOT_FOUND = 404;

/** The backend does not register a route of a feature that is off, so 404 means off. */
async function routeExists(probe: () => Promise<unknown>): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch (e) {
    if (e instanceof BackendApiError && e.status === HTTP_NOT_FOUND) return false;
    // Any other answer (403, 501, 503) comes from a registered route.
    if (e instanceof BackendApiError) return true;
    throw e;
  }
}

const PROBE_OPTIONS = { ...NO_AUTO_REFETCH, staleTime: Infinity } as const;

/**
 * Which cfunc tabs the backend serves. Pools and functions are separate
 * switches in the backend, and functions can be off while pools are on.
 */
export function useCfuncFeatures(): { pools: boolean; functions: boolean } {
  const cluster = useAuthStore((s) => s.cluster);
  const pools = useQuery({
    queryKey: ['cfunc-feature', getBackendUrl(), 'pools'],
    queryFn: () => routeExists(listFlavors),
    ...PROBE_OPTIONS,
  });
  const functions = useQuery({
    queryKey: ['cfunc-feature', getBackendUrl(), 'functions', cluster],
    queryFn: () => routeExists(() => listFunctions(cluster)),
    enabled: Boolean(cluster) && pools.data === true,
    ...PROBE_OPTIONS,
  });
  return { pools: pools.data === true, functions: pools.data === true && functions.data === true };
}

export function useFlavors() {
  return useQuery({
    queryKey: ['cfunc-flavors', getBackendUrl()],
    queryFn: listFlavors,
    select: (data) => data.items,
    ...PROBE_OPTIONS,
  });
}

export function usePoolSizes() {
  return useQuery({
    queryKey: ['cfunc-sizes', getBackendUrl()],
    queryFn: listPoolSizes,
    select: (data) => data.items,
    ...PROBE_OPTIONS,
  });
}

// ── Pools ────────────────────────────────────────────────────────────────────

export function usePools(namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: ['cfunc-pools', getBackendUrl(), cluster, namespace ?? 'all'],
    queryFn: () => listPools(cluster, namespace),
    select: (data) => data.items,
    enabled: Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

export function usePool(namespace: string, name: string, options?: typeof NO_AUTO_REFETCH) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['cfunc-pool', getBackendUrl(), cluster, namespace, name],
    queryFn: () => getPool(cluster, namespace, name),
    enabled: Boolean(cluster && namespace && name),
    ...options,
  });
}

export function useCreatePool() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  return useMutation({
    mutationFn: ({ namespace, req }: { namespace: string; req: PoolRequest }) => createPool(namespace, req),
    onSuccess: () => refreshQueries(queryClient, ['cfunc-pools', getBackendUrl(), cluster]),
  });
}

export function useUpdatePool() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  return useMutation({
    mutationFn: ({ namespace, name, req }: { namespace: string; name: string; req: PoolRequest }) =>
      updatePool(namespace, name, req),
    onSuccess: (_data, v) =>
      refreshQueries(
        queryClient,
        ['cfunc-pools', getBackendUrl(), cluster],
        ['cfunc-pool', getBackendUrl(), cluster, v.namespace, v.name],
      ),
  });
}

export function useDeletePool() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) => deletePool(namespace, name),
    onSuccess: async (_data, v) => {
      await refreshQueries(queryClient, ['cfunc-pools', getBackendUrl(), cluster]);
      queryClient.removeQueries({ queryKey: ['cfunc-pool', getBackendUrl(), cluster, v.namespace, v.name] });
    },
  });
}

// ── Functions ────────────────────────────────────────────────────────────────

export function useFunctions(namespace?: string, enabled = true) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: ['cfunc-functions', getBackendUrl(), cluster, namespace ?? 'all'],
    queryFn: () => listFunctions(cluster, namespace),
    select: (data) => data.items,
    enabled: enabled && Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

export function useFunction(namespace: string, name: string, options?: typeof NO_AUTO_REFETCH) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['cfunc-function', getBackendUrl(), cluster, namespace, name],
    queryFn: () => getFunction(cluster, namespace, name),
    enabled: Boolean(cluster && namespace && name),
    ...options,
  });
}

function useRefreshFunction() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  return (namespace: string, name: string) =>
    refreshQueries(
      queryClient,
      ['cfunc-functions', getBackendUrl(), cluster],
      ['cfunc-function', getBackendUrl(), cluster, namespace, name],
    );
}

export function useCreateFunction() {
  const refresh = useRefreshFunction();
  return useMutation({
    mutationFn: ({ namespace, req }: { namespace: string; req: FunctionRequest }) => createFunction(namespace, req),
    // A create can fail after the function is saved, so the lists are stale either way.
    onSettled: (_data, _error, v) => refresh(v.namespace, v.req.name),
  });
}

export function useUpdateFunction() {
  const refresh = useRefreshFunction();
  return useMutation({
    mutationFn: ({ namespace, name, req }: { namespace: string; name: string; req: FunctionRequest }) =>
      updateFunction(namespace, name, req),
    onSettled: (_data, _error, v) => refresh(v.namespace, v.name),
  });
}

export function useDeleteFunction() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) => deleteFunction(namespace, name),
    onSuccess: async (_data, v) => {
      await refreshQueries(queryClient, ['cfunc-functions', getBackendUrl(), cluster]);
      queryClient.removeQueries({ queryKey: ['cfunc-function', getBackendUrl(), cluster, v.namespace, v.name] });
    },
  });
}

export function useTestFunction() {
  return useMutation({
    mutationFn: ({ namespace, name, req }: { namespace: string; name: string; req: FunctionTestRequest }) =>
      testFunction(namespace, name, req),
  });
}

export function useFunctionLogs(namespace: string, name: string, lines: number, enabled: boolean) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['cfunc-function-logs', getBackendUrl(), cluster, namespace, name, lines],
    queryFn: () => getFunctionLogs(cluster, namespace, name, lines),
    enabled: enabled && Boolean(cluster && namespace && name),
    retry: false,
  });
}
