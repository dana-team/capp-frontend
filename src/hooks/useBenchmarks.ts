import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBenchmarkDashboards,
  getBenchmarkRun,
  getBenchmarkStatus,
  isBenchmarkUnavailable,
  listBenchmarkRuns,
  queryBenchmarkRange,
  triggerBenchmark,
} from '@/api/benchmarks'
import { getBackendUrl } from '@/lib/config'
import { useAuthStore } from '@/store/auth'
import type { BenchmarkTarget } from '@/types/benchmark'
import { rangeWindow, type BenchmarkRange } from '@/utils/benchmarkSeries'

export function benchmarkStatusKey(cluster: string, namespace: string, name: string) {
  return ['benchmark-status', getBackendUrl(), cluster, namespace, name] as const
}

export function benchmarkRunsKey(cluster: string, namespace: string, name: string) {
  return ['benchmark-runs', getBackendUrl(), cluster, namespace, name] as const
}

export function benchmarkRunKey(cluster: string, namespace: string, name: string, runId: string) {
  return ['benchmark-run', getBackendUrl(), cluster, namespace, name, runId] as const
}

export function useBenchmarkStatus(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster)
  const queryClient = useQueryClient()
  const statusQuery = useQuery({
    queryKey: benchmarkStatusKey(cluster, namespace, name),
    queryFn: () => getBenchmarkStatus(namespace, name),
    enabled: Boolean(cluster && namespace && name),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 5_000 : 15_000),
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => !isBenchmarkUnavailable(error) && failureCount < 1,
  })

  const status = statusQuery.data?.status
  const lastStatus = useRef(status)
  useEffect(() => {
    const previous = lastStatus.current
    lastStatus.current = status
    if (previous === 'running' && (status === 'completed' || status === 'failed')) {
      void queryClient.invalidateQueries({ queryKey: benchmarkRunsKey(cluster, namespace, name) })
      void queryClient.invalidateQueries({ queryKey: ['benchmark-run', getBackendUrl(), cluster, namespace, name] })
    }
  }, [status, queryClient, cluster, namespace, name])

  return statusQuery
}

/**
 * The summary is written about 5 seconds before the status flips to finished, and
 * VictoriaMetrics hides data younger than its latency offset (30 seconds by default).
 * A finished run can therefore be missing from the list for a while.
 */
const RUN_LIST_RETRY_INTERVAL_MS = 10_000
const RUN_LIST_RETRY_WINDOW_MS = 120_000

/**
 * awaitedRunId is the run ID of a finished run. Until the list contains that run, the
 * list is re-read every 10 seconds, for 2 minutes from when this page first saw the run finish.
 */
export function useBenchmarkRuns(namespace: string, name: string, awaitedRunId?: string) {
  const cluster = useAuthStore((s) => s.cluster)
  const [awaited, setAwaited] = useState<{ runId: string; deadline: number } | null>(null)

  useEffect(() => {
    if (!awaitedRunId) return
    setAwaited((current) =>
      current?.runId === awaitedRunId
        ? current
        : { runId: awaitedRunId, deadline: Date.now() + RUN_LIST_RETRY_WINDOW_MS },
    )
  }, [awaitedRunId])

  return useQuery({
    queryKey: benchmarkRunsKey(cluster, namespace, name),
    queryFn: () => listBenchmarkRuns(namespace, name),
    enabled: Boolean(cluster && namespace && name),
    retry: (failureCount, error) => !isBenchmarkUnavailable(error) && failureCount < 1,
    refetchInterval: (query) => {
      if (!awaited || awaited.runId !== awaitedRunId) return false
      if (query.state.data?.items.some((run) => run.runId === awaited.runId)) return false
      // Clamp the last wait to the deadline so no fetch happens after the window.
      const remaining = awaited.deadline - Date.now()
      return remaining > 0 ? Math.min(RUN_LIST_RETRY_INTERVAL_MS, remaining) : false
    },
  })
}

/** A null run ID leaves the query disabled. */
export function useBenchmarkRun(namespace: string, name: string, runId: string | null) {
  const cluster = useAuthStore((s) => s.cluster)
  const id = runId ?? ''
  return useQuery({
    queryKey: benchmarkRunKey(cluster, namespace, name, id),
    queryFn: () => getBenchmarkRun(namespace, name, id),
    enabled: Boolean(cluster && namespace && name && runId),
    retry: (failureCount, error) => !isBenchmarkUnavailable(error) && failureCount < 1,
  })
}

export function useTriggerBenchmark(namespace: string, name: string) {
  const queryClient = useQueryClient()
  const cluster = useAuthStore((s) => s.cluster)

  return useMutation({
    mutationFn: (target: BenchmarkTarget) => triggerBenchmark(namespace, name, target),
    onSuccess: (result) => {
      queryClient.setQueryData(benchmarkStatusKey(cluster, namespace, name), {
        jobName: result.jobName,
        status: 'running' as const,
        runId: result.runId,
      })
      void queryClient.invalidateQueries({ queryKey: benchmarkStatusKey(cluster, namespace, name) })
      void queryClient.invalidateQueries({
        queryKey: ['benchmark-range', getBackendUrl(), cluster, namespace, name],
      })
    },
  })
}

export function useBenchmarkDashboards(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster)
  return useQuery({
    queryKey: ['benchmark-dashboards', getBackendUrl(), cluster, namespace, name],
    queryFn: () => getBenchmarkDashboards(namespace, name),
    enabled: Boolean(cluster && namespace && name),
    staleTime: 60_000,
    retry: (failureCount, error) => !isBenchmarkUnavailable(error) && failureCount < 1,
  })
}

export function benchmarkRangeQuery(
  cluster: string,
  namespace: string,
  name: string,
  query: string,
  range: BenchmarkRange,
) {
  return {
    queryKey: ['benchmark-range', getBackendUrl(), cluster, namespace, name, range.id, query] as const,
    queryFn: () => {
      const { start, end } = rangeWindow(range)
      return queryBenchmarkRange(namespace, name, query, start, end, range.step)
    },
    enabled: Boolean(cluster && namespace && name && query),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  }
}
