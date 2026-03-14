import { useQuery } from '@tanstack/react-query';
import { listNamespaces } from '@/api/namespaces';

export function useNamespaces() {
  return useQuery({
    queryKey: ['namespaces'],
    queryFn: listNamespaces,
    select: (data) => data.items,
    staleTime: 60_000,
  });
}
