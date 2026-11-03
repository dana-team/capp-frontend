import { BackendApiError, backendClient, clusterBase } from '@/api/client'
import type {
  BenchmarkStatusResponse,
  BenchmarkTriggerResponse,
  BenchmarkType,
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

export function triggerBenchmark(
  namespace: string,
  name: string,
  type: BenchmarkType,
): Promise<BenchmarkTriggerResponse> {
  return backendClient<BenchmarkTriggerResponse>(`${cappPath(namespace, name)}/benchmark`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  })
}
