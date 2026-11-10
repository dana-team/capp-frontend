import React, { useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BackendApiError } from '@/api/client'
import { isBenchmarkUnavailable } from '@/api/benchmarks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBenchmarkRun, useBenchmarkRuns } from '@/hooks/useBenchmarks'
import { cn } from '@/lib/utils'
import type { BenchmarkChart, BenchmarkRun, BenchmarkRunDetail } from '@/types/benchmark'
import { formatChartTime, formatAxisTick, formatMetricValue } from '@/utils/benchmarkSeries'
import {
  headlineText,
  isBetter,
  isoFromUnix,
  percentChange,
  revisionLabel,
  statRows,
  typeLabel,
} from '@/utils/benchmarkRuns'
import { formatTimestamp, relativeTime } from '@/utils/time'
import { useChartTheme } from './BenchmarkDashboards'

const RESULT_BADGE = {
  passed: { label: 'Passed', variant: 'success' as const },
  failed: { label: 'Failed', variant: 'danger' as const },
}

function formatChange(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

const RunChart: React.FC<{ chart: BenchmarkChart }> = ({ chart }) => {
  const theme = useChartTheme()
  const points = chart.points.map(([time, value]) => ({ time, value }))

  if (points.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-text-muted">
        No chart data for this run
      </div>
    )
  }

  const span = points[points.length - 1].time - points[0].time

  return (
    <div className="h-[240px] w-full min-w-0" role="img" aria-label={`${chart.title} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => formatChartTime(Number(value), span)}
            tick={{ fill: theme.tick, fontSize: 11 }}
            stroke={theme.axis}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(value) => formatAxisTick(Number(value), chart.unit)}
            tick={{ fill: theme.tick, fontSize: 11 }}
            stroke={theme.axis}
            width={64}
            domain={[0, 'auto']}
            allowDecimals={chart.unit !== 'pods'}
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
            labelFormatter={(label) => formatChartTime(Number(label), span)}
            formatter={(value) => formatMetricValue(Number(value), chart.unit)}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={chart.title}
            stroke={theme.series[0]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const RunDetail: React.FC<{ run: BenchmarkRunDetail }> = ({ run }) => {
  const rows = statRows(run)
  const started = isoFromUnix(run.startedAt)
  const result = RESULT_BADGE[run.result] ?? RESULT_BADGE.failed

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={result.variant}>{result.label}</Badge>
          {run.result === 'failed' && run.reason && (
            <p className="text-sm text-danger">{run.reason}</p>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          <span className="text-text">{typeLabel(run.type)}</span>
          <span className="font-mono">{run.path || '/'}</span>
          <span title={formatTimestamp(started)}>{relativeTime(started)}</span>
          <span className="font-mono">{revisionLabel(run)}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">This run recorded no measurements.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {rows.map((row) => {
            const previous = run.previous?.stats[row.stat]
            const change = percentChange(row.value, previous)
            const tone = change === undefined || change === 0
              ? 'text-text-muted'
              : isBetter(row.stat, change) ? 'text-success' : 'text-danger'
            return (
              <div key={row.stat} className="flex flex-col gap-0.5">
                <dt className="text-xs text-text-muted">{row.label}</dt>
                <dd className="font-display text-xl font-medium tabular-nums text-text">{row.display}</dd>
                {change !== undefined && (
                  <dd
                    className={cn('text-xs tabular-nums', tone)}
                    title={previous === undefined ? undefined : `Previous run: ${previous}`}
                  >
                    {formatChange(change)} vs previous run
                  </dd>
                )}
              </div>
            )
          })}
        </dl>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base font-medium text-text">{run.chart.title}</h3>
          <span className="text-xs text-text-muted">{run.chart.unit}</span>
        </div>
        <RunChart chart={run.chart} />
      </div>
    </div>
  )
}

export const BenchmarkResults: React.FC<{ namespace: string; name: string; awaitedRunId?: string }> = ({
  namespace,
  name,
  awaitedRunId,
}) => {
  const runs = useBenchmarkRuns(namespace, name, awaitedRunId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const items: BenchmarkRun[] = runs.data?.items ?? []
  const latest = items[0]
  const activeId = items.some((run) => run.runId === selectedId) ? selectedId : (latest?.runId ?? null)
  const detail = useBenchmarkRun(namespace, name, activeId)

  if (isBenchmarkUnavailable(runs.error)) return null
  if (runs.isPending) return null
  if (runs.isError && items.length === 0) {
    return <p className="mt-6 border-t border-border-subtle pt-6 text-sm text-danger">Benchmark results could not be loaded. {runs.error.message}</p>
  }
  if (!latest) return null

  const earlier = items.slice(1)
  const detailMissing = detail.error instanceof BackendApiError && detail.error.status === 404

  return (
    <div className="mt-6 flex flex-col gap-6 border-t border-border-subtle pt-6">
      {detail.isPending && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <CircleNotchIcon size={14} className="animate-spin" />
          Loading run…
        </div>
      )}

      {detail.isError && (
        <p className="text-sm text-danger">
          {detailMissing ? 'This run is no longer available.' : `The run could not be loaded. ${detail.error.message}`}
        </p>
      )}

      {detail.data && <RunDetail run={detail.data} />}

      {earlier.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-medium text-text">Earlier runs</h3>
            {activeId !== latest.runId && (
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                Show latest
              </Button>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
            {earlier.map((run) => {
              const started = isoFromUnix(run.startedAt)
              const result = RESULT_BADGE[run.result] ?? RESULT_BADGE.failed
              const selected = run.runId === activeId
              return (
                <li key={run.runId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(run.runId)}
                    className={cn(
                      'flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-sm transition-colors',
                      selected ? 'bg-primary-subtle' : 'hover:bg-surface',
                    )}
                  >
                    <span className="text-text" title={formatTimestamp(started)}>{relativeTime(started)}</span>
                    <span className="text-text-secondary">{typeLabel(run.type)}</span>
                    <span className="font-mono text-xs text-text-secondary">{revisionLabel(run)}</span>
                    <span className="ml-auto font-mono tabular-nums text-text">{headlineText(run)}</span>
                    <Badge variant={result.variant}>{result.label}</Badge>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
