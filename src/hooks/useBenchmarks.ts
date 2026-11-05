import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBenchmarkDashboards,
  getBenchmarkStatus,
  isBenchmarkUnavailable,
  queryBenchmarkRange,
  triggerBenchmark,
} from '@/api/benchmarks'
import { getBackendUrl } from '@/lib/config'
import { useAuthStore } from '@/store/auth'
import type { BenchmarkType } from '@/types/benchmark'
import { rangeWindow, type BenchmarkRange } from '@/utils/benchmarkSeries'

export function benchmarkStatusKey(cluster: string, namespace: string, name: string) {
  return ['benchmark-status', getBackendUrl(), cluster, namespace, name] as const
}

export function useBenchmarkStatus(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster)
  return useQuery({
    queryKey: benchmarkStatusKey(cluster, namespace, name),
    queryFn: () => getBenchmarkStatus(namespace, name),
    enabled: Boolean(cluster && namespace && name),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 5_000 : 15_000),
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => !isBenchmarkUnavailable(error) && failureCount < 1,
  })
}

export function useTriggerBenchmark(namespace: string, name: string) {
  const queryClient = useQueryClient()
  const cluster = useAuthStore((s) => s.cluster)

  return useMutation({
    mutationFn: (type: BenchmarkType) => triggerBenchmark(namespace, name, type),
    onSuccess: (result) => {
      queryClient.setQueryData(benchmarkStatusKey(cluster, namespace, name), {
        jobName: result.jobName,
        status: 'running' as const,
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
