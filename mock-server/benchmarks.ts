/**
 * In-memory benchmark Jobs for the mock backend.
 * A running Job settles after 20 seconds. X-Mock-Benchmark-Outcome: failed
 * makes that settle a failure; the header is mock-only.
 */
const RUN_MS = 20_000
const TYPES = new Set(['latency', 'throughput', 'scale'])

type JobStatus = 'running' | 'completed' | 'failed'

interface Job {
  jobName: string
  type: string
  status: JobStatus
  startedAt: number
  outcome: 'completed' | 'failed'
}

const jobs = new Map<string, Job>()

function key(cluster: string, namespace: string, name: string): string {
  return `${cluster}\0${namespace}\0${name}`
}

function jobName(cappName: string): string {
  const name = `bench-${cappName}`
  if (name.length <= 63) return name
  return name.slice(0, 63).replace(/[-.]+$/, '')
}

function settle(job: Job): Job {
  if (job.status === 'running' && Date.now() - job.startedAt >= RUN_MS) {
    job.status = job.outcome
  }
  return job
}

export function benchmarkStatus(cluster: string, namespace: string, name: string): { jobName: string; status: string } {
  const job = jobs.get(key(cluster, namespace, name))
  if (!job) return { jobName: '', status: '' }
  const current = settle(job)
  return { jobName: current.jobName, status: current.status }
}

export function triggerBenchmark(
  cluster: string,
  namespace: string,
  name: string,
  type: unknown,
  outcome: 'completed' | 'failed',
):
  | { ok: true; body: { cappName: string; jobName: string; type: string } }
  | { ok: false; status: 400 | 409; message: string } {
  if (typeof type !== 'string' || !TYPES.has(type)) {
    return { ok: false, status: 400, message: `unknown benchmark type ${JSON.stringify(type ?? '')}` }
  }
  const id = key(cluster, namespace, name)
  const existing = jobs.get(id)
  if (existing && settle(existing).status === 'running') {
    return { ok: false, status: 409, message: `benchmark is already running for capp "${name}"` }
  }
  const created: Job = {
    jobName: jobName(name),
    type,
    status: 'running',
    startedAt: Date.now(),
    outcome,
  }
  jobs.set(id, created)
  return { ok: true, body: { cappName: name, jobName: created.jobName, type } }
}

const MAX_POINTS = 1_200

function promQLString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Same three charts the backend returns from GET .../metrics/dashboards. */
export function benchmarkDashboards(namespace: string, cappName: string) {
  const sel = `k8s_namespace_name="${promQLString(namespace)}",kn_service_name="${promQLString(cappName)}"`
  const latency = `kn_serving_invocation_duration_seconds_bucket{${sel}}`
  const requests = `kn_serving_invocation_duration_seconds_count{${sel}}`
  const quantile = (q: string) => `histogram_quantile(${q}, sum by (le) (rate(${latency}[5m])))`
  return [
    {
      id: 'latency',
      title: 'Latency',
      description: 'Request duration measured by the queue-proxy, excluding activator wait.',
      unit: 'seconds',
      queries: [
        { legend: 'p50', query: quantile('0.50') },
        { legend: 'p95', query: quantile('0.95') },
      ],
    },
    {
      id: 'throughput',
      title: 'Throughput',
      description: 'Requests per second served by the Capp.',
      unit: 'requests/s',
      queries: [
        { legend: 'requests', query: `sum(rate(${requests}[1m]))` },
      ],
    },
    {
      id: 'autoscaling',
      title: 'Autoscaling',
      description: 'Pods the autoscaler wants compared with pods that are ready.',
      unit: 'pods',
      queries: [
        { legend: 'desired', query: `sum(kn_revision_pods_desired{${sel}})` },
        { legend: 'ready', query: `sum(kn_revision_pods_count{${sel}})` },
      ],
    },
  ]
}

function stepSeconds(step: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(step.trim())
  if (!match) return undefined
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const unit = match[2] ?? 's'
  if (unit === 'ms') return Math.max(1, Math.round(amount / 1000))
  if (unit === 'm') return amount * 60
  if (unit === 'h') return amount * 3600
  return amount
}

function sampleValue(query: string, unix: number): number {
  const minute = unix / 60
  if (query.includes('histogram_quantile(0.95')) return 0.09 + 0.03 * Math.sin(minute / 3)
  if (query.includes('histogram_quantile(0.50')) return 0.035 + 0.008 * Math.sin(minute / 2)
  if (query.includes('_count')) return Math.max(0, 18 + 7 * Math.sin(minute / 4))
  if (query.includes('pods_desired')) return 2 + (Math.floor(minute / 5) % 3)
  if (query.includes('pods_count')) return 1 + (Math.floor(minute / 5) % 3)
  return 1
}

export function queryBenchmarkRange(params: URLSearchParams):
  | { ok: true; body: unknown }
  | { ok: false; message: string } {
  const query = params.get('query') ?? ''
  const startRaw = params.get('start')
  const endRaw = params.get('end')
  const stepRaw = params.get('step') ?? ''
  const start = Number(startRaw)
  const end = Number(endRaw)
  if (!query || !startRaw || !endRaw || !stepRaw || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, message: 'query, start, end, and step are required' }
  }
  const parsedStep = stepSeconds(stepRaw)
  if (!parsedStep) return { ok: false, message: 'step must be a duration' }

  const span = Math.max(0, end - start)
  const step = span / parsedStep > MAX_POINTS ? Math.ceil(span / MAX_POINTS) : parsedStep
  const values: [number, string][] = []
  if (end > start) {
    const first = Math.ceil(start / step) * step
    for (let t = first; t <= end; t += step) {
      values.push([t, sampleValue(query, t).toFixed(4)])
    }
  }

  return {
    ok: true,
    body: {
      status: 'success',
      data: { resultType: 'matrix', result: values.length ? [{ metric: {}, values }] : [] },
    },
  }
}
