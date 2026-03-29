import { useQuery } from '@tanstack/react-query';
import { listClusters } from '@/api/clusters';
import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';

export function useClusters() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['clusters', getBackendUrl()],
    queryFn: listClusters,
    select: (data) => data.items,
    staleTime: 30_000,
    enabled: isAuthenticated,
  });
}
