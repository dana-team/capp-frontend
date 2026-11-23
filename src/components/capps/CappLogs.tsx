import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { SectionSheet } from '@/components/layout/DetailParts'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  MAX_LOG_ENTRIES,
  type LogEntry,
  type LogPod,
  type LogStreamStatus,
  useCappLogStream,
} from '@/hooks/useCappLogStream'

const ALL_PODS = '__all__'
/** Pixels from the bottom within which the view keeps following new lines. */
const FOLLOW_THRESHOLD = 24

const POD_COLORS = ['text-primary', 'text-warning', 'text-success', 'text-accent', 'text-text-secondary'] as const

const STATUS_LABEL: Record<LogStreamStatus, string> = {
  idle: 'Not streaming',
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  stopped: 'Stopped',
  failed: 'Failed',
}

const STATUS_DOT: Record<LogStreamStatus, string> = {
  idle: 'bg-text-muted',
  connecting: 'bg-warning animate-pulse-dot',
  live: 'bg-success animate-pulse-dot',
  reconnecting: 'bg-warning animate-pulse-dot',
  stopped: 'bg-text-muted',
  failed: 'bg-danger',
}

function podColor(pod: string, pods: LogPod[]): string {
  const index = pods.findIndex((p) => p.name === pod)
  return POD_COLORS[(index < 0 ? 0 : index) % POD_COLORS.length]
}

/** Knative pod names end in "<revision>-deployment-<hash>-<id>"; the part after "deployment-" tells pods apart. */
export function shortPodName(pod: string): string {
  const marker = '-deployment-'
  const at = pod.lastIndexOf(marker)
  return at >= 0 ? pod.slice(at + marker.length) : pod
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function download(entries: LogEntry[], fileName: string): void {
  const text = entries
    .filter((e) => e.kind === 'line')
    .map((e) => [e.timestamp ?? '', e.pod ?? '', e.text].join(' '))
    .join('\n')
  const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const LogRow: React.FC<{ entry: LogEntry; pods: LogPod[]; showPod: boolean; showTime: boolean }> = React.memo(
  ({ entry, pods, showPod, showTime }) => {
    if (entry.kind !== 'line') {
      const tone = entry.kind === 'error' ? 'text-danger' : entry.kind === 'notice' ? 'text-warning' : 'text-text-muted'
      return (
        <div className={cn('flex gap-3 py-0.5 italic', tone)}>
          <span aria-hidden>—</span>
          <span className="min-w-0 break-words">
            {entry.pod && <span className={podColor(entry.pod, pods)} title={entry.pod}>{shortPodName(entry.pod)} </span>}
            {entry.text}
          </span>
        </div>
      )
    }
    return (
      <div className="flex gap-3 py-px hover:bg-background/40">
        {showTime && (
          <span className="w-[6.5rem] shrink-0 tabular-nums text-text-muted" title={entry.timestamp}>
            {formatTime(entry.timestamp)}
          </span>
        )}
        {showPod && entry.pod && (
          <span className={cn('w-36 shrink-0 truncate', podColor(entry.pod, pods))} title={entry.pod}>
            {shortPodName(entry.pod)}
          </span>
        )}
        <span className="min-w-0 whitespace-pre-wrap break-all text-text">{entry.text}</span>
      </div>
    )
  },
)
LogRow.displayName = 'LogRow'

/**
 * Live log of a Capp's pods. The stream is opened on request, not with the
 * page, because it holds a connection and a log stream per pod on the
 * cluster for as long as it runs.
 */
export const CappLogs: React.FC<{ namespace: string; name: string }> = ({ namespace, name }) => {
  const { entries, pods, status, error, start, stop, clear } = useCappLogStream(namespace, name)
  const [podFilter, setPodFilter] = useState(ALL_PODS)
  const [search, setSearch] = useState('')
  const [showTime, setShowTime] = useState(true)
  const [following, setFollowing] = useState(true)
  const viewport = useRef<HTMLDivElement>(null)

  const running = status === 'connecting' || status === 'live' || status === 'reconnecting'
  const activePods = pods.filter((p) => p.active).length

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (podFilter !== ALL_PODS && e.pod !== podFilter && e.kind !== 'error') return false
      if (needle && e.kind === 'line' && !e.text.toLowerCase().includes(needle)) return false
      if (needle && e.kind !== 'line') return false
      return true
    })
  }, [entries, podFilter, search])

  const podOptions = useMemo(
    () => [
      { value: ALL_PODS, label: `All pods (${pods.length})` },
      ...pods.map((p) => ({ value: p.name, label: `${shortPodName(p.name)}${p.active ? '' : ' (ended)'}` })),
    ],
    [pods],
  )

  useLayoutEffect(() => {
    const el = viewport.current
    if (el && following) el.scrollTop = el.scrollHeight
  }, [visible, following])

  const onScroll = () => {
    const el = viewport.current
    if (!el) return
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_THRESHOLD)
  }

  const jumpToLatest = () => {
    setFollowing(true)
    const el = viewport.current
    if (el) el.scrollTop = el.scrollHeight
  }

  const lineCount = entries.filter((e) => e.kind === 'line').length

  return (
    <SectionSheet
      title="Logs"
      aside={
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} aria-hidden />
          {STATUS_LABEL[status]}
          {running && status === 'live' && ` · ${activePods} ${activePods === 1 ? 'pod' : 'pods'}`}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <Button type="button" variant="secondary" size="sm" icon={<StopIcon size={14} />} onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="button" size="sm" icon={<PlayIcon size={14} />} onClick={start}>
              {status === 'idle' ? 'Stream logs' : 'Resume'}
            </Button>
          )}
          <div className="w-52">
            <SimpleSelect options={podOptions} value={podFilter} onChange={setPodFilter} disabled={pods.length === 0} />
          </div>
          <label className="relative flex items-center">
            <MagnifyingGlassIcon size={14} className="pointer-events-none absolute left-2.5 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter lines"
              aria-label="Filter log lines"
              className="h-9 w-48 rounded border border-border bg-background/40 pl-8 pr-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} className="accent-primary" />
            Timestamps
          </label>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<DownloadSimpleIcon size={14} />}
              onClick={() => download(visible, `${name}.log`)}
              disabled={lineCount === 0}
              title="Download the lines shown"
            >
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<TrashIcon size={14} />}
              onClick={clear}
              disabled={entries.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="relative">
          <div
            ref={viewport}
            onScroll={onScroll}
            role="log"
            aria-live="off"
            className="h-[28rem] overflow-auto rounded-lg border border-border-subtle bg-background/40 p-3 font-mono text-xs leading-relaxed"
          >
            {visible.length > 0 ? (
              visible.map((entry) => (
                <LogRow key={entry.id} entry={entry} pods={pods} showPod={pods.length > 1} showTime={showTime} />
              ))
            ) : (
              <p className="font-sans text-sm text-text-muted">
                {status === 'idle' && "Stream the live log of this Capp's pods. Pods that start while you watch join the stream."}
                {status === 'connecting' && 'Connecting…'}
                {(status === 'live' || status === 'reconnecting') && (
                  entries.length > 0
                    ? 'No lines match the filter.'
                    : pods.length === 0
                      ? 'No pod is running. A Capp that scaled to zero starts a pod on its next request, and the pod joins here.'
                      : 'Waiting for log lines…'
                )}
                {(status === 'stopped' || status === 'failed') && (entries.length > 0 ? 'No lines match the filter.' : 'No log lines.')}
              </p>
            )}
          </div>
          {!following && visible.length > 0 && (
            <Button
              type="button"
              size="sm"
              icon={<ArrowDownIcon size={14} />}
              onClick={jumpToLatest}
              className="absolute bottom-3 right-5 shadow-lg"
            >
              Latest
            </Button>
          )}
        </div>
        {entries.length >= MAX_LOG_ENTRIES && (
          <p className="text-xs text-text-muted">Showing the last {MAX_LOG_ENTRIES.toLocaleString()} lines; older ones are dropped.</p>
        )}
      </div>
    </SectionSheet>
  )
}
