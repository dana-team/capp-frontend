import { useQuery } from '@tanstack/react-query';
import { listClusters } from '@/api/clusters';
import { useAuthStore } from '@/store/auth';

export function useClusters() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const backendUrl = useAuthStore((s) => s.backendUrl);
  return useQuery({
    queryKey: ['clusters', backendUrl],
    queryFn: listClusters,
    select: (data) => data.items,
    staleTime: 30_000,
    enabled: isAuthenticated,
  });
}
