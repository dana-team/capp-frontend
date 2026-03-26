import { useQuery } from '@tanstack/react-query';
import { listNamespaces } from '@/api/namespaces';
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';

export function useNamespaces() {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: ['namespaces', getBackendUrl(), cluster],
    queryFn: listNamespaces,
    select: (data) => data.items,
    staleTime: 60_000,
    enabled: Boolean(cluster),
  });
}
