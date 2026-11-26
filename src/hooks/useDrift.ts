import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { resolveDrift, type DriftAction, type DriftKind } from '@/api/drift';
import { boundCappsPrefix } from '@/hooks/useBoundCapps';
import { getBackendUrl } from '@/lib/config';
import { refreshQueries } from '@/lib/query';
import { useAuthStore } from '@/store/auth';
import type { Drift } from '@/types/drift';

const QUERY: Record<DriftKind, { one: string; list: string }> = {
  capps: { one: 'capp', list: 'capps' },
  configmaps: { one: 'configmap', list: 'configmaps' },
  secrets: { one: 'secret', list: 'secrets' },
};

/** Reverts or accepts the drift of one object, then refetches what it may have changed. */
export function useResolveDrift(kind: DriftKind) {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);

  return useMutation({
    mutationFn: ({ action, namespace, name, drift }: { action: DriftAction; namespace: string; name: string; drift: Drift }) =>
      resolveDrift(kind, action, namespace, name, {
        generation: drift.generation ?? 0,
        ...(drift.liveVersion ? { liveVersion: drift.liveVersion } : {}),
      }),
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
