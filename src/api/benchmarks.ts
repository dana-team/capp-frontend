import { BackendApiError, backendClient, clusterBase } from '@/api/client'
import type {
  BenchmarkRunDetail,
  BenchmarkRunsResponse,
  BenchmarkStatusResponse,
  BenchmarkTarget,
  BenchmarkTriggerResponse,
  DashboardsResponse,
  PrometheusRangeResponse,
} from '@/types/benchmark'

function cappPath(namespace: string, name: string): string {
  return `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}`
}

/** Benchmarks are omitted from the API when the backend has them disabled. */
export function isBenchmarkUnavailable(error: unknown): boolean {
  return error instanceof BackendApiError && error.status === 404
}

export function getBenchmarkStatus(namespace: string, name: string): Promise<BenchmarkStatusResponse> {
  return backendClient<BenchmarkStatusResponse>(`${cappPath(namespace, name)}/benchmark`)
}

export function listBenchmarkRuns(namespace: string, name: string): Promise<BenchmarkRunsResponse> {
  return backendClient<BenchmarkRunsResponse>(`${cappPath(namespace, name)}/benchmark/runs`)
}

export function getBenchmarkRun(namespace: string, name: string, runId: string): Promise<BenchmarkRunDetail> {
  return backendClient<BenchmarkRunDetail>(
    `${cappPath(namespace, name)}/benchmark/runs/${encodeURIComponent(runId)}`,
  )
}

export function triggerBenchmark(
  namespace: string,
  name: string,
  target: BenchmarkTarget,
): Promise<BenchmarkTriggerResponse> {
  return backendClient<BenchmarkTriggerResponse>(`${cappPath(namespace, name)}/benchmark`, {
    method: 'POST',
    body: JSON.stringify(target),
  })
}

export function getBenchmarkDashboards(namespace: string, name: string): Promise<DashboardsResponse> {
  return backendClient<DashboardsResponse>(`${cappPath(namespace, name)}/metrics/dashboards`)
}

export function queryBenchmarkRange(
  namespace: string,
  name: string,
  query: string,
  start: number,
  end: number,
  step: number,
): Promise<PrometheusRangeResponse> {
  const params = new URLSearchParams({
    query,
    start: String(start),
    end: String(end),
    step: String(step),
  })
  return backendClient<PrometheusRangeResponse>(
    `${cappPath(namespace, name)}/metrics/query_range?${params.toString()}`,
  )
}
