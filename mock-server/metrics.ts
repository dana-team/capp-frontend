/**
 * Per-Capp metrics for the mock backend. Mirrors GET .../capps/:name/metrics
 * and .../metrics/:metric: callers pick a configured metric by name and never
 * send PromQL.
 */
const MAX_POINTS = 11_000

interface Metric {
  name: string
  description: string
  type: 'gauge' | 'counter' | 'histogram'
  unit: string
  legends: string[]
}

const METRICS: Metric[] = [
  {
    name: 'latency',
    description: 'Request duration measured by the queue-proxy',
    type: 'histogram',
    unit: 'seconds',
    legends: ['p50', 'p95'],
  },
  {
    name: 'throughput',
    description: 'Requests per second',
    type: 'counter',
    unit: 'requests/s',
    legends: ['throughput'],
  },
  {
    name: 'autoscaling',
    description: 'Pods the autoscaler wants compared with pods that are ready',
    type: 'gauge',
    unit: 'pods',
    legends: ['desired', 'ready'],
  },
]

export function listMetrics(): Metric[] {
  return METRICS
}

function parseTime(raw: string): number | undefined {
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return seconds
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms / 1000 : undefined
}

function parseStep(raw: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)?$/.exec(raw.trim())
  if (!match) return undefined
  const amount = Number(match[1])
  const factor = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86_400, w: 604_800, y: 31_536_000 }[match[2] ?? 's'] ?? 1
  const step = amount * factor
  return Number.isFinite(step) && step > 0 ? step : undefined
}

function sampleValue(metric: string, legend: string, unix: number): number {
  const minute = unix / 60
  if (metric === 'latency') {
    return legend === 'p95' ? 0.09 + 0.03 * Math.sin(minute / 3) : 0.035 + 0.008 * Math.sin(minute / 2)
  }
  if (metric === 'throughput') return Math.max(0, 18 + 7 * Math.sin(minute / 4))
  if (metric === 'autoscaling') return (legend === 'desired' ? 2 : 1) + (Math.floor(minute / 5) % 3)
  return 1
}

export function queryMetric(name: string, params: URLSearchParams):
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 404; message: string } {
  const metric = METRICS.find((item) => item.name === name)
  if (!metric) return { ok: false, status: 404, message: `Metric "${name}" not found` }

  const startRaw = params.get('start') ?? ''
  const endRaw = params.get('end') ?? ''
  const stepRaw = params.get('step') ?? ''

  if (!startRaw && !endRaw && !stepRaw) {
    const now = Math.floor(Date.now() / 1000)
    return {
      ok: true,
      body: {
        ...metric,
        series: metric.legends.map((legend) => ({
          legend,
          resultType: 'vector',
          result: [{ metric: {}, value: [now, sampleValue(metric.name, legend, now).toFixed(4)] }],
        })),
      },
    }
  }

  const bad = (message: string) => ({ ok: false as const, status: 400 as const, message })
  if (!startRaw || !endRaw || !stepRaw) return bad('start, end and step must be set together')
  const start = parseTime(startRaw)
  if (start === undefined) return bad('start must be an RFC 3339 time or a Unix timestamp')
  const end = parseTime(endRaw)
  if (end === undefined) return bad('end must be an RFC 3339 time or a Unix timestamp')
  const step = parseStep(stepRaw)
  if (step === undefined) return bad('step must be a positive duration, such as 30s, or a number of seconds')
  if (end < start) return bad('end must not be before start')
  if ((end - start) / step > MAX_POINTS) {
    return bad(`range is too long for step; at most ${MAX_POINTS} points are allowed`)
  }

  return {
    ok: true,
    body: {
      ...metric,
      series: metric.legends.map((legend) => {
        const values: [number, string][] = []
        for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
          values.push([t, sampleValue(metric.name, legend, t).toFixed(4)])
        }
        return {
          legend,
          resultType: 'matrix',
          result: values.length ? [{ metric: {}, values }] : [],
        }
      }),
    },
  }
}
