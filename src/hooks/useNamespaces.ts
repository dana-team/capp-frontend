import { useQuery } from '@tanstack/react-query';
import { listNamespaces } from '@/api/namespaces';
import { useAuthStore } from '@/store/auth';

export function useNamespaces() {
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  return useQuery({
    queryKey: ['namespaces', backendUrl, cluster],
    queryFn: listNamespaces,
    select: (data) => data.items,
    staleTime: 60_000,
    enabled: Boolean(cluster),
  });
}
