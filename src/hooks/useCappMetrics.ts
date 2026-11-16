import { useQuery } from '@tanstack/react-query'
import { isMetricsUnavailable, listCappMetrics, queryCappMetricRange } from '@/api/metrics'
import { getBackendUrl } from '@/lib/config'
import { useAuthStore } from '@/store/auth'
import { rangeWindow, type MetricRange } from '@/utils/metricSeries'

export function useCappMetrics(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster)
  return useQuery({
    queryKey: ['capp-metrics', getBackendUrl(), cluster, namespace, name],
    queryFn: () => listCappMetrics(namespace, name),
    enabled: Boolean(cluster && namespace && name),
    staleTime: 60_000,
    retry: (failureCount, error) => !isMetricsUnavailable(error) && failureCount < 1,
  })
}

export function useCappMetricRange(namespace: string, name: string, metric: string, range: MetricRange) {
  const cluster = useAuthStore((s) => s.cluster)
  return useQuery({
    queryKey: ['capp-metric-range', getBackendUrl(), cluster, namespace, name, metric, range.id],
    queryFn: () => {
      const { start, end } = rangeWindow(range)
      return queryCappMetricRange(namespace, name, metric, start, end, range.step)
    },
    enabled: Boolean(cluster && namespace && name && metric),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  })
}
