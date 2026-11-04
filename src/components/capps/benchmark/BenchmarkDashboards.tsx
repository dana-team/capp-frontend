import React, { useEffect, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isBenchmarkUnavailable } from '@/api/benchmarks'
import { SectionSheet } from '@/components/layout/DetailParts'
import { Button } from '@/components/ui/button'
import { benchmarkRangeQuery, useBenchmarkDashboards } from '@/hooks/useBenchmarks'
import { useAuthStore } from '@/store/auth'
import type { Dashboard } from '@/types/benchmark'
import {
  BENCHMARK_RANGES,
  type BenchmarkRange,
  formatAxisTick,
  formatChartTime,
  formatMetricValue,
  pointsForChart,
  seriesFromMatrix,
} from '@/utils/benchmarkSeries'

const SERIES_TOKENS = ['--primary', '--warning', '--success', '--danger'] as const

function readToken(token: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return raw ? `hsl(${raw})` : fallback
}

function useChartTheme() {
  const read = () => ({
    series: SERIES_TOKENS.map((token) => readToken(token, 'hsl(166 39% 55%)')),
    grid: readToken('--border-subtle', 'hsl(167 13% 14%)'),
    axis: readToken('--border', 'hsl(168 12% 17%)'),
    tick: readToken('--text-muted', 'hsl(168 7% 56%)'),
    popover: readToken('--popover', 'hsl(171 11% 12%)'),
    text: readToken('--text', 'hsl(160 15% 88%)'),
  })
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const update = () => setTheme(read())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

const DashboardChart: React.FC<{
  namespace: string
  name: string
  dashboard: Dashboard
  range: BenchmarkRange
}> = ({ namespace, name, dashboard, range }) => {
  const cluster = useAuthStore((s) => s.cluster)
  const theme = useChartTheme()
  const queries = dashboard.queries ?? []
  const results = useQueries({
    queries: queries.map((query) => benchmarkRangeQuery(cluster, namespace, name, query.query, range)),
  })

  const series = results.flatMap((result, index) => (
    result.data ? seriesFromMatrix(queries[index]?.legend ?? `series ${index + 1}`, result.data) : []
  ))
  const points = pointsForChart(series)
  const legends = series.map((line) => line.legend)
  const pending = results.some((result) => result.isPending)
  const error = results.find((result) => result.isError)?.error

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-medium text-text">{dashboard.title}</h3>
        <span className="text-xs text-text-muted">{dashboard.unit}</span>
      </div>
      <p className="mb-3 text-xs text-text-muted">{dashboard.description}</p>

      {pending && points.length === 0 && (
        <div className="flex h-[220px] items-center justify-center gap-2 text-sm text-text-muted">
          <CircleNotchIcon size={14} className="animate-spin" />
          Loading samples…
        </div>
      )}

      {!pending && points.length === 0 && (
        <div className={`flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm break-words ${error instanceof Error ? 'text-danger' : 'text-text-muted'}`}>
          {error instanceof Error ? error.message : 'No samples in this window.'}
        </div>
      )}

      {points.length > 0 && (
        <div className="h-[260px] w-full min-w-0" role="img" aria-label={`${dashboard.title} chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                scale="linear"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => formatChartTime(Number(value), range.seconds)}
                tick={{ fill: theme.tick, fontSize: 11 }}
                stroke={theme.axis}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(value) => formatAxisTick(Number(value), dashboard.unit)}
                tick={{ fill: theme.tick, fontSize: 11 }}
                stroke={theme.axis}
                width={64}
                domain={[0, 'auto']}
                allowDecimals={dashboard.unit !== 'pods'}
              />
              <Tooltip
                contentStyle={{
                  background: theme.popover,
                  border: `1px solid ${theme.axis}`,
                  borderRadius: 3,
                  fontSize: 12,
                  color: theme.text,
                }}
                labelStyle={{ color: theme.tick }}
                itemStyle={{ color: theme.text }}
                labelFormatter={(label) => formatChartTime(Number(label), range.seconds)}
                formatter={(value) => formatMetricValue(Number(value), dashboard.unit)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: theme.tick }} />
              {legends.map((legend, index) => (
                <Line
                  key={legend}
                  type="monotone"
                  dataKey={legend}
                  stroke={theme.series[index % theme.series.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {error instanceof Error && points.length > 0 && (
        <p className="mt-2 text-xs text-danger">{error.message}</p>
      )}
    </div>
  )
}

export const BenchmarkDashboards: React.FC<{ namespace: string; name: string }> = ({ namespace, name }) => {
  const dashboards = useBenchmarkDashboards(namespace, name)
  const [rangeId, setRangeId] = useState<BenchmarkRange['id']>('1h')
  const range = BENCHMARK_RANGES.find((item) => item.id === rangeId) ?? BENCHMARK_RANGES[1]

  if (dashboards.isPending) return null
  if (isBenchmarkUnavailable(dashboards.error)) return null

  return (
    <SectionSheet title="Performance">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Knative serving metrics for this Capp.</p>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {BENCHMARK_RANGES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === range.id ? 'primary' : 'secondary'}
              onClick={() => setRangeId(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {dashboards.isError && (
        <p className="text-sm text-danger">{dashboards.error.message}</p>
      )}

      {dashboards.data && dashboards.data.dashboards.length === 0 && (
        <p className="text-sm text-text-secondary">No charts are configured for this Capp.</p>
      )}

      {dashboards.data && dashboards.data.dashboards.length > 0 && (
        <div className="flex flex-col gap-4">
          {dashboards.data.dashboards.map((dashboard) => (
            <DashboardChart
              key={dashboard.id}
              namespace={namespace}
              name={name}
              dashboard={dashboard}
              range={range}
            />
          ))}
        </div>
      )}
    </SectionSheet>
  )
}
