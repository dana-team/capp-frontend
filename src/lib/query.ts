import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { isAccessDenied } from '@/api/client';

export const DEFAULT_REFETCH_MS = 8_000;
/** A Capp mid-rollout changes quickly, so its page polls faster. */
export const ROLLOUT_REFETCH_MS = 5_000;

export function createReadQueryPolicy(
  isUnavailable: (error: unknown) => boolean = isAccessDenied,
  interval = DEFAULT_REFETCH_MS,
) {
  const canRefetch = (query: { state: { error: Error | null } }) => !isUnavailable(query.state.error);
  return {
    retry: (failureCount: number, error: Error) => !isUnavailable(error) && failureCount < 1,
    refetchInterval: (query: { state: { error: Error | null } }) => canRefetch(query) ? interval : false,
    refetchOnWindowFocus: canRefetch,
    refetchOnReconnect: canRefetch,
  };
}

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
