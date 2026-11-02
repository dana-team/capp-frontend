import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Turns off the automatic refetching set in the QueryClient defaults. For one-off
 * lookups, and for pages holding unsaved input: their form is replaced by an error
 * if a background refetch fails, which would lose what the user typed.
 */
export const NO_AUTO_REFETCH = {
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/**
 * After a write: refetch the matching queries, including cached ones no page is
 * showing, and resolve once done. Returned from a mutation's onSuccess, this makes
 * the page opened next show the change straight away. A failed refetch does not
 * reject, so it never reports a successful write as failed.
 */
export function refreshQueries(queryClient: QueryClient, ...queryKeys: QueryKey[]) {
  return Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'all' })),
  );
}
