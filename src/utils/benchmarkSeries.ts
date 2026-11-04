import type { PrometheusRangeResponse } from '@/types/benchmark'

export const BENCHMARK_RANGES = [
  { id: '15m', label: '15m', seconds: 15 * 60, step: 15 },
  { id: '1h', label: '1h', seconds: 60 * 60, step: 30 },
  { id: '6h', label: '6h', seconds: 6 * 60 * 60, step: 60 },
  { id: '24h', label: '24h', seconds: 24 * 60 * 60, step: 120 },
] as const

export type BenchmarkRange = (typeof BENCHMARK_RANGES)[number]

export interface NamedSeries {
  legend: string
  samples: { time: number; value: number }[]
}

export interface ChartPoint {
  time: number
  [series: string]: number
}

export function rangeWindow(range: BenchmarkRange, now = Date.now()): { start: number; end: number } {
  const end = Math.floor(now / 1000)
  return { start: end - range.seconds, end }
}

function trimNumber(value: number, digits: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
}

export function formatMetricValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '—'
  if (unit === 'seconds') {
    if (value !== 0 && Math.abs(value) < 1) return `${trimNumber(value * 1000, 1)} ms`
    return `${trimNumber(value, 3)} s`
  }
  if (unit === 'pods') return trimNumber(value, 1)
  if (unit === 'requests/s') return `${trimNumber(value, 2)} req/s`
  return unit ? `${trimNumber(value, 2)} ${unit}` : trimNumber(value, 2)
}

export function formatAxisTick(value: number, unit: string): string {
  if (!Number.isFinite(value)) return ''
  if (unit === 'seconds') {
    if (value !== 0 && Math.abs(value) < 1) return `${trimNumber(value * 1000, 0)}ms`
    return `${trimNumber(value, 2)}s`
  }
  if (unit === 'pods') return trimNumber(value, 0)
  return trimNumber(value, 1)
}

export function formatChartTime(unixSeconds: number, spanSeconds: number): string {
  const date = new Date(unixSeconds * 1000)
  if (!Number.isFinite(date.getTime())) return ''
  if (spanSeconds >= 24 * 60 * 60) {
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function seriesLegend(
  legend: string,
  metric: Record<string, string> | undefined,
  index: number,
  total: number,
): string {
  if (total <= 1) return legend
  const extra = Object.entries(metric ?? {})
    .filter(([key]) => key !== '__name__' && key !== 'le')
    .map(([, value]) => value)
    .filter(Boolean)
    .join(', ')
  return extra ? `${legend} (${extra})` : `${legend} ${index + 1}`
}

export function seriesFromMatrix(legend: string, body: PrometheusRangeResponse): NamedSeries[] {
  const result = body.data?.result ?? []
  return result.flatMap((series, index) => {
    const samples = (series.values ?? []).flatMap(([time, raw]) => {
      const value = Number(raw)
      if (!Number.isFinite(time) || !Number.isFinite(value)) return []
      return [{ time, value }]
    })
    if (samples.length === 0) return []
    return [{ legend: seriesLegend(legend, series.metric, index, result.length), samples }]
  })
}

export function pointsForChart(series: NamedSeries[]): ChartPoint[] {
  const byTime = new Map<number, ChartPoint>()
  for (const line of series) {
    for (const sample of line.samples) {
      const row = byTime.get(sample.time) ?? { time: sample.time }
      row[line.legend] = sample.value
      byTime.set(sample.time, row)
    }
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}
