import { BackendApiError, backendClient, clusterBase, isAccessDenied } from '@/api/client'
import type { MetricListResponse, MetricQueryResponse } from '@/types/metrics'

function metricsPath(namespace: string, name: string): string {
  return `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/metrics`
}

/** Metrics are unavailable when access is denied or observability is disabled. */
export function isMetricsUnavailable(error: unknown): boolean {
  return isAccessDenied(error) || (error instanceof BackendApiError && error.status === 501)
}

export function listCappMetrics(namespace: string, name: string): Promise<MetricListResponse> {
  return backendClient<MetricListResponse>(metricsPath(namespace, name))
}

/** Range query for one configured metric. start and end are Unix seconds; step is seconds. */
export function queryCappMetricRange(
  namespace: string,
  name: string,
  metric: string,
  start: number,
  end: number,
  step: number,
): Promise<MetricQueryResponse> {
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
    step: String(step),
  })
  return backendClient<MetricQueryResponse>(
    `${metricsPath(namespace, name)}/${encodeURIComponent(metric)}?${params.toString()}`,
  )
}
