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

export const BENCHMARK_RESULTS = ['passed', 'failed'] as const

export type BenchmarkResult = (typeof BENCHMARK_RESULTS)[number]

/** Stat keys in the order the results panel shows them. The backend may omit any of them. */
export const BENCHMARK_STATS = [
  'p50_seconds',
  'p95_seconds',
  'p99_seconds',
  'error_ratio',
  'requests_per_second',
  'max_pods',
  'scale_out_seconds',
  'time_to_max_pods_seconds',
  'cold_start_seconds',
] as const

export type BenchmarkStatKey = (typeof BENCHMARK_STATS)[number]

export type BenchmarkStats = Partial<Record<BenchmarkStatKey, number>>

/** One finished benchmark run, from GET .../benchmark/runs. */
export interface BenchmarkRun {
  runId: string
  type: BenchmarkType
  path: string
  revision: string
  /** True when the run's pods did not all share one revision. */
  mixed: boolean
  result: BenchmarkResult
  reason?: string
  /** Unix seconds. */
  startedAt: number
  /** Unix seconds. */
  endedAt: number
  stats: BenchmarkStats
}

export interface BenchmarkRunsResponse {
  items: BenchmarkRun[]
}

/** Points are [unix seconds, value]. */
export interface BenchmarkChart {
  title: string
  unit: string
  points: [number, number][]
}

/** From GET .../benchmark/runs/{runId}. `previous` is absent when no earlier run is comparable. */
export interface BenchmarkRunDetail extends BenchmarkRun {
  previous?: BenchmarkRun
  chart: BenchmarkChart
}
