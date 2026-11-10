/** Matches POST /benchmark. The backend rejects any other value. */
export const BENCHMARK_TYPES = ['latency', 'throughput', 'scale'] as const

export type BenchmarkType = (typeof BENCHMARK_TYPES)[number]

/** Empty when no Job exists. Otherwise the Job outcome. */
export type BenchmarkJobStatus = '' | 'running' | 'completed' | 'failed'

export interface BenchmarkStatusResponse {
  jobName: string
  status: BenchmarkJobStatus
  runId?: string
  /** Why a running Job's pod has not started, or why a failed Job failed. */
  reason?: string
}

/** Body of POST /benchmark. Omit path and headers when the user leaves them empty. */
export interface BenchmarkTarget {
  type: BenchmarkType
  /** Must start with a single `/`. */
  path?: string
  headers?: Record<string, string>
}

export interface BenchmarkTriggerResponse {
  cappName: string
  jobName: string
  type: BenchmarkType
  runId: string
}

export interface DashboardQuery {
  legend: string
  query: string
}

export interface Dashboard {
  id: string
  title: string
  description: string
  unit: string
  queries: DashboardQuery[]
}

export interface DashboardsResponse {
  dashboards: Dashboard[]
}

/** Prometheus HTTP API matrix from GET .../metrics/query_range. */
export interface PrometheusRangeResponse {
  status?: string
  data?: {
    resultType?: string
    result?: PrometheusMatrixSeries[]
  }
  error?: string
  errorType?: string
}

export interface PrometheusMatrixSeries {
  metric?: Record<string, string>
  values?: [number, string][]
}
