import {
  BENCHMARK_STATS,
  type BenchmarkRun,
  type BenchmarkStatKey,
  type BenchmarkType,
} from '@/types/benchmark'

export interface StatRow {
  stat: BenchmarkStatKey
  label: string
  value: number
  display: string
}

interface StatDefinition {
  label: string
  higherIsBetter: boolean
  format: (value: number) => string
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits, minimumFractionDigits: 0 })
}

function formatMilliseconds(seconds: number): string {
  const ms = seconds * 1000
  return `${formatNumber(ms, ms < 10 ? 1 : 0)} ms`
}

function formatSeconds(seconds: number): string {
  return `${formatNumber(seconds, 1)} s`
}

const STAT_DEFINITIONS: Record<BenchmarkStatKey, StatDefinition> = {
  p50_seconds: { label: 'p50', higherIsBetter: false, format: formatMilliseconds },
  p95_seconds: { label: 'p95', higherIsBetter: false, format: formatMilliseconds },
  p99_seconds: { label: 'p99', higherIsBetter: false, format: formatMilliseconds },
  error_ratio: { label: 'Errors', higherIsBetter: false, format: (value) => `${formatNumber(value * 100, 2)}%` },
  requests_per_second: { label: 'Requests/s', higherIsBetter: true, format: (value) => `${formatNumber(value, 1)} req/s` },
  max_pods: { label: 'Most pods', higherIsBetter: true, format: (value) => formatNumber(Math.round(value), 0) },
  scale_out_seconds: { label: 'Scale-out began', higherIsBetter: false, format: formatSeconds },
  time_to_max_pods_seconds: { label: 'Time to most pods', higherIsBetter: false, format: formatSeconds },
  cold_start_seconds: { label: 'Cold start', higherIsBetter: false, format: formatSeconds },
}

const TYPE_LABELS: Record<BenchmarkType, string> = {
  latency: 'Latency',
  throughput: 'Throughput',
  scale: 'Scale',
}

/** The one number an earlier-runs row shows for each run type. */
const HEADLINE: Record<BenchmarkType, { stat: BenchmarkStatKey; prefix: string }> = {
  latency: { stat: 'p95_seconds', prefix: 'p95 ' },
  throughput: { stat: 'requests_per_second', prefix: '' },
  scale: { stat: 'time_to_max_pods_seconds', prefix: 'to most pods ' },
}

export function typeLabel(type: BenchmarkType): string {
  return TYPE_LABELS[type] ?? type
}

export function formatStat(stat: BenchmarkStatKey, value: number): string {
  return STAT_DEFINITIONS[stat].format(value)
}

/** Stats the run reports, in display order, formatted for display. */
export function statRows(run: BenchmarkRun): StatRow[] {
  return BENCHMARK_STATS.flatMap((stat) => {
    const value = run.stats[stat]
    if (value === undefined || !Number.isFinite(value)) return []
    const definition = STAT_DEFINITIONS[stat]
    return [{ stat, label: definition.label, value, display: definition.format(value) }]
  })
}

/** One-line headline for a run, such as "p95 120 ms". Empty when the run lacks that stat. */
export function headlineText(run: BenchmarkRun): string {
  const { stat, prefix } = HEADLINE[run.type]
  const value = run.stats[stat]
  if (value === undefined || !Number.isFinite(value)) return '—'
  return `${prefix}${formatStat(stat, value)}`
}

/**
 * Percent change from previous to current. Undefined when there is no previous value,
 * or when the previous value is zero and the current one is not.
 */
export function percentChange(current: number, previous: number | undefined): number | undefined {
  if (previous === undefined || !Number.isFinite(previous) || !Number.isFinite(current)) return undefined
  if (previous === 0) return current === 0 ? 0 : undefined
  return ((current - previous) / Math.abs(previous)) * 100
}

/** True when a change (from percentChange) moves the stat in its good direction. */
export function isBetter(stat: string, change: number): boolean {
  const definition = STAT_DEFINITIONS[stat as BenchmarkStatKey]
  if (!definition) return false
  return definition.higherIsBetter ? change > 0 : change < 0
}

/** Runs use Unix seconds. This converts one to an ISO string for relativeTime and formatTimestamp. */
export function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

/** Shows "mixed" when the run's pods did not share one revision. */
export function revisionLabel(run: BenchmarkRun): string {
  if (run.mixed) return 'mixed'
  return run.revision || '—'
}
