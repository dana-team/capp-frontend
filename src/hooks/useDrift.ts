import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { listCapps, listCappsInNamespace } from '@/api/capps';
import { listConfigMaps, listConfigMapsInNamespace } from '@/api/configmaps';
import { resolveDrift, resolveNamespaceDrift, type DriftAction, type DriftKind } from '@/api/drift';
import { listSecrets, listSecretsInNamespace } from '@/api/secrets';
import { useNamespaceContext } from '@/context/NamespaceContext';
import { boundCappsPrefix } from '@/hooks/useBoundCapps';
import { getBackendUrl } from '@/lib/config';
import { refreshQueries } from '@/lib/query';
import { useAuthStore } from '@/store/auth';
import type { Drift, DriftActionRequest, DriftMissing } from '@/types/drift';

const QUERY: Record<DriftKind, { one: string; list: string }> = {
  capps: { one: 'capp', list: 'capps' },
  configmaps: { one: 'configmap', list: 'configmaps' },
  secrets: { one: 'secret', list: 'secrets' },
};

/** The list endpoints, as useCapps, useConfigmaps and useSecrets call them. */
const LISTS: Record<DriftKind, {
  all: (cluster: string) => Promise<{ missing?: DriftMissing[] }>;
  inNamespace: (cluster: string, namespace: string) => Promise<{ missing?: DriftMissing[] }>;
}> = {
  capps: { all: listCapps, inNamespace: listCappsInNamespace },
  configmaps: { all: listConfigMaps, inNamespace: listConfigMapsInNamespace },
  secrets: { all: listSecrets, inNamespace: listSecretsInNamespace },
};

/** What a revert or accept sends back: the drift exactly as it was shown. */
const seenOf = (drift: Drift): DriftActionRequest => ({
  generation: drift.generation ?? 0,
  ...(drift.liveVersion ? { liveVersion: drift.liveVersion } : {}),
});

/**
 * The objects of a kind that were deleted from the cluster but still have a backup. It reads the
 * same query as the kind's list hook, so the list is fetched once.
 */
export function useMissing(kind: DriftKind, namespace?: string) {
  const cluster = useAuthStore((s) => s.cluster);
  const { allNamespacesEnabled } = useNamespaceContext();
  return useQuery({
    queryKey: [QUERY[kind].list, getBackendUrl(), cluster, namespace ?? 'all'],
    queryFn: () => (namespace ? LISTS[kind].inNamespace(cluster, namespace) : LISTS[kind].all(cluster)),
    select: (data) => data.missing ?? [],
    enabled: Boolean(cluster) && (Boolean(namespace) || allNamespacesEnabled),
  });
}

/** Reverts or accepts the drift of one object, then refetches what it may have changed. */
export function useResolveDrift(kind: DriftKind) {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ action, namespace, name, drift }: { action: DriftAction; namespace: string; name: string; drift: Drift }) =>
      resolveDrift(kind, action, namespace, name, seenOf(drift)),
    // Also after a 409, which means the drift changed: show the current one.
    onSettled: (_data, _error, { namespace, name }) => {
      const backendUrl = getBackendUrl();
      const keys: QueryKey[] = [
        [QUERY[kind].one, backendUrl, cluster, namespace, name],
        [QUERY[kind].list, backendUrl, cluster],
        // A reverted Capp gets a new revision; a reverted ConfigMap or Secret restarts the Capps that opted in.
        kind === 'capps' ? ['capp-revisions', backendUrl, cluster, namespace, name] : ['capp', backendUrl, cluster],
        kind === 'capps' ? boundCappsPrefix(cluster) : ['capps', backendUrl, cluster],
      ];
      return refreshQueries(queryClient, ...keys);
    },
  });
}

/** useResolveDrift for a namespace. A restored namespace brings back none of its objects; they show as missing. */
export function useResolveNamespaceDrift() {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ action, namespace, drift }: { action: DriftAction; namespace: string; drift: Drift }) =>
      resolveNamespaceDrift(action, namespace, seenOf(drift)),
    onSettled: () => {
      const backendUrl = getBackendUrl();
      return refreshQueries(
        queryClient,
        ['namespaces', backendUrl, cluster],
        ['namespacesForCluster', backendUrl, cluster],
        ...Object.values(QUERY).map(({ list }) => [list, backendUrl, cluster]),
      );
    },
  });
}
