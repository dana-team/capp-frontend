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
