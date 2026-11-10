import React, { useRef, useState } from 'react'
import { PlayIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { BackendApiError } from '@/api/client'
import { isBenchmarkUnavailable } from '@/api/benchmarks'
import { SectionSheet } from '@/components/layout/DetailParts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useBenchmarkStatus, useTriggerBenchmark } from '@/hooks/useBenchmarks'
import { cn } from '@/lib/utils'
import {
  BENCHMARK_TYPES,
  type BenchmarkJobStatus,
  type BenchmarkTarget,
  type BenchmarkType,
} from '@/types/benchmark'

const TYPE_DETAILS: Record<BenchmarkType, { label: string; description: string }> = {
  latency: {
    label: 'Latency',
    description: 'Short requests that measure how long each call takes.',
  },
  throughput: {
    label: 'Throughput',
    description: 'A steady stream of requests that measures how much traffic the Capp can serve.',
  },
  scale: {
    label: 'Scale',
    description: 'Load that asks the Capp to scale out, then measures that run.',
  },
}

const STATUS_BADGE: Record<BenchmarkJobStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' }> = {
  '': { label: 'Idle', variant: 'default' },
  running: { label: 'Running', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
}

interface HeaderRow {
  id: number
  name: string
  value: string
}

/** Builds the POST body. Empty path and header names are left out of the request. */
function buildTarget(type: BenchmarkType, path: string, headers: HeaderRow[]): BenchmarkTarget {
  const target: BenchmarkTarget = { type }
  const trimmedPath = path.trim()
  if (trimmedPath) target.path = trimmedPath
  const named = headers.filter((row) => row.name.trim())
  if (named.length > 0) {
    target.headers = Object.fromEntries(named.map((row) => [row.name.trim(), row.value]))
  }
  return target
}

function statusDetail(status: BenchmarkJobStatus, jobName: string, reason?: string): string {
  const detail = reason ? ` ${reason}` : ''
  if (status === 'running') {
    return (jobName ? `Job ${jobName} is running.` : 'A benchmark is running.') + detail
  }
  if (status === 'completed') {
    return (jobName
      ? `Job ${jobName} finished. Starting another run replaces it.`
      : 'The last benchmark finished. Starting another run replaces it.') + detail
  }
  if (status === 'failed') {
    return (jobName
      ? `Job ${jobName} failed. You can start another run.`
      : 'The last benchmark failed. You can start another run.') + detail
  }
  return 'Run a latency, throughput, or scale benchmark against this Capp.'
}

export const BenchmarkPanel: React.FC<{ namespace: string; name: string }> = ({ namespace, name }) => {
  const statusQuery = useBenchmarkStatus(namespace, name)
  const trigger = useTriggerBenchmark(namespace, name)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<BenchmarkType>('latency')
  const [path, setPath] = useState('')
  const [headers, setHeaders] = useState<HeaderRow[]>([])
  const nextHeaderId = useRef(0)
  const [error, setError] = useState<string | null>(null)

  if (statusQuery.isPending) return null
  if (isBenchmarkUnavailable(statusQuery.error)) return null

  const status = statusQuery.data?.status ?? ''
  const jobName = statusQuery.data?.jobName ?? ''
  const reason = statusQuery.data?.reason
  const running = status === 'running'
  const badge = statusQuery.isError
    ? { label: 'Unavailable', variant: 'danger' as const }
    : (STATUS_BADGE[status] ?? STATUS_BADGE[''])
  const action = running ? 'Benchmark running' : status === '' ? 'Run benchmark' : 'Run again'

  const close = () => {
    setOpen(false)
    setError(null)
    setPath('')
    setHeaders([])
  }

  const addHeader = () => {
    nextHeaderId.current += 1
    setHeaders((rows) => [...rows, { id: nextHeaderId.current, name: '', value: '' }])
  }

  const updateHeader = (id: number, field: 'name' | 'value', text: string) => {
    setHeaders((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: text } : row)))
  }

  const removeHeader = (id: number) => {
    setHeaders((rows) => rows.filter((row) => row.id !== id))
  }

  const handleRun = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await trigger.mutateAsync(buildTarget(type, path, headers))
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The benchmark could not be started.')
      if (err instanceof BackendApiError && err.status === 409) {
        void statusQuery.refetch()
      }
    }
  }

  return (
    <SectionSheet title="Benchmark">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex max-w-2xl flex-col items-start gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <p className={cn('text-sm', status === 'failed' || statusQuery.isError ? 'text-danger' : 'text-text-secondary')} aria-live="polite">
            {statusQuery.isError
              ? statusQuery.error.message
              : statusDetail(status, jobName, reason)}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setError(null); setOpen(true) }}
          disabled={running}
          loading={running}
          icon={running ? undefined : <PlayIcon size={14} />}
        >
          {action}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); else setOpen(true) }}>
        <DialogContent className="gap-5 rounded-[10px] shadow-[0_24px_70px_-20px_hsl(var(--text)/0.5)] sm:max-w-lg">
          <DialogHeader className="gap-1.5 border-b border-border-subtle pb-4 pr-6">
            <DialogTitle>Run benchmark</DialogTitle>
            <DialogDescription>
              Choose what to measure. A finished run is replaced when you start another one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRun} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-text-secondary">Type</legend>
              {BENCHMARK_TYPES.map((id) => {
                const detail = TYPE_DETAILS[id]
                const selected = type === id
                return (
                  <label
                    key={id}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-lg border p-3',
                      selected ? 'border-primary bg-primary-subtle' : 'border-border-subtle hover:border-text/30',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-text">
                      <input
                        type="radio"
                        name="benchmark-type"
                        value={id}
                        checked={selected}
                        onChange={() => setType(id)}
                        className="accent-primary"
                      />
                      {detail.label}
                    </span>
                    <span className="pl-6 text-xs text-text-muted">{detail.description}</span>
                  </label>
                )
              })}
            </fieldset>

            <Input
              id="benchmark-path"
              label="Path"
              placeholder="/"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-text-secondary">Headers</legend>
              {headers.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Input
                    aria-label="Header name"
                    placeholder="Name"
                    value={row.name}
                    onChange={(event) => updateHeader(row.id, 'name', event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                  />
                  <Input
                    type="password"
                    aria-label="Header value"
                    placeholder="Value"
                    value={row.value}
                    onChange={(event) => updateHeader(row.id, 'value', event.target.value)}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove header"
                    onClick={() => removeHeader(row.id)}
                  >
                    <XIcon size={14} />
                  </Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={addHeader} icon={<PlusIcon size={14} />}>
                  Add header
                </Button>
              </div>
            </fieldset>

            {error && <p className="text-sm text-danger">{error}</p>}

            <DialogFooter className="gap-2 border-t border-border-subtle pt-4 sm:space-x-0">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" loading={trigger.isPending} disabled={running}>
                Start benchmark
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionSheet>
  )
}
