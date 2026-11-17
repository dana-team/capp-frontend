import React, { useEffect, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isMetricsUnavailable } from '@/api/metrics'
import { SectionSheet } from '@/components/layout/DetailParts'
import { Button } from '@/components/ui/button'
import { useCappMetricRange, useCappMetrics } from '@/hooks/useCappMetrics'
import type { MetricInfo } from '@/types/metrics'
import {
  METRIC_RANGES,
  type MetricRange,
  formatAxisTick,
  formatChartTime,
  formatMetricValue,
  pointsForChart,
  seriesFromResponse,
} from '@/utils/metricSeries'

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

const MetricChart: React.FC<{
  namespace: string
  name: string
  metric: MetricInfo
  range: MetricRange
}> = ({ namespace, name, metric, range }) => {
  const theme = useChartTheme()
  const result = useCappMetricRange(namespace, name, metric.name, range)
  const unit = metric.unit ?? ''

  const series = result.data ? seriesFromResponse(result.data) : []
  const points = pointsForChart(series)
  const legends = series.map((line) => line.legend)
  const pending = result.isPending
  const error = result.error

  if (isMetricsUnavailable(error)) return null

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-medium text-text first-letter:uppercase">{metric.name}</h3>
        {unit && <span className="text-xs text-text-muted">{unit}</span>}
      </div>
      {metric.description && <p className="mb-3 text-xs text-text-muted">{metric.description}</p>}

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
        <div className="h-[260px] w-full min-w-0" role="img" aria-label={`${metric.name} chart`}>
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
                tickFormatter={(value) => formatAxisTick(Number(value), unit)}
                tick={{ fill: theme.tick, fontSize: 11 }}
                stroke={theme.axis}
                width={64}
                domain={[0, 'auto']}
                allowDecimals={unit !== 'pods'}
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
                formatter={(value) => formatMetricValue(Number(value), unit)}
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

export const CappMetrics: React.FC<{ namespace: string; name: string }> = ({ namespace, name }) => {
  const metrics = useCappMetrics(namespace, name)
  const [rangeId, setRangeId] = useState<MetricRange['id']>('1h')
  const range = METRIC_RANGES.find((item) => item.id === rangeId) ?? METRIC_RANGES[1]

  if (metrics.isPending) return null
  if (isMetricsUnavailable(metrics.error)) return null

  const items = metrics.data?.items ?? []

  return (
    <SectionSheet title="Metrics">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Metrics for this Capp.</p>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {METRIC_RANGES.map((item) => (
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

      {metrics.isError && (
        <p className="text-sm text-danger">{metrics.error.message}</p>
      )}

      {metrics.data && items.length === 0 && (
        <p className="text-sm text-text-secondary">No metrics are configured for this Capp.</p>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((metric) => (
            <MetricChart
              key={metric.name}
              namespace={namespace}
              name={name}
              metric={metric}
              range={range}
            />
          ))}
        </div>
      )}
    </SectionSheet>
  )
}
