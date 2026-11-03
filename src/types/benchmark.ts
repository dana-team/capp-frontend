/** Matches POST /benchmark. The backend rejects any other value. */
export const BENCHMARK_TYPES = ['latency', 'throughput', 'scale'] as const

export type BenchmarkType = (typeof BENCHMARK_TYPES)[number]

/** Empty when no Job exists. Otherwise the Job outcome. */
export type BenchmarkJobStatus = '' | 'running' | 'completed' | 'failed'

export interface BenchmarkStatusResponse {
  jobName: string
  status: BenchmarkJobStatus
}

export interface BenchmarkTriggerResponse {
  cappName: string
  jobName: string
  type: BenchmarkType
}
