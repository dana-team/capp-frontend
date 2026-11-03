import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBenchmarkStatus,
  isBenchmarkUnavailable,
  triggerBenchmark,
} from '@/api/benchmarks'
import { getBackendUrl } from '@/lib/config'
import { useAuthStore } from '@/store/auth'
import type { BenchmarkType } from '@/types/benchmark'

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
    },
  })
}
