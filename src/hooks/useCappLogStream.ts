import { useCallback, useEffect, useRef, useState } from 'react'
import { BackendApiError } from '@/api/client'
import { streamCappLogs } from '@/api/logs'
import { useAuthStore } from '@/store/auth'
import type { CappLogEvent } from '@/types/logs'

/** Lines kept in memory; older ones are dropped. */
export const MAX_LOG_ENTRIES = 5000
const INITIAL_TAIL_LINES = 100
/** A dropped connection is retried this often in a row before giving up. */
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export type LogStreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopped' | 'failed'

export interface LogEntry {
  id: number
  kind: 'line' | 'pod' | 'notice' | 'error'
  pod?: string
  timestamp?: string
  text: string
}

export interface LogPod {
  name: string
  active: boolean
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** The backend refused the stream (403, 404, ...): connecting again will not help. */
function isRefused(error: unknown): boolean {
  return error instanceof BackendApiError && error.status >= 400 && error.status < 500
}

function allEnded(pods: LogPod[]): LogPod[] {
  return pods.some((p) => p.active) ? pods.map((p) => ({ ...p, active: false })) : pods
}

/**
 * Follows a Capp's log stream. Nothing is opened until start(). Lines are
 * collected and committed once per animation frame, so a busy log does not
 * render once per line. When the backend ends the stream after its maximum
 * duration, or the connection drops, it connects again without history so
 * lines are not repeated.
 */
export function useCappLogStream(namespace: string, name: string) {
  const cluster = useAuthStore((s) => s.cluster)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [pods, setPods] = useState<LogPod[]>([])
  const [status, setStatus] = useState<LogStreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const controller = useRef<AbortController | null>(null)
  const pending = useRef<LogEntry[]>([])
  const frame = useRef<number | null>(null)
  const nextId = useRef(0)

  const flush = useCallback(() => {
    frame.current = null
    const batch = pending.current
    if (batch.length === 0) return
    pending.current = []
    setEntries((prev) => {
      const merged = prev.concat(batch)
      return merged.length > MAX_LOG_ENTRIES ? merged.slice(merged.length - MAX_LOG_ENTRIES) : merged
    })
  }, [])

  const push = useCallback((entry: Omit<LogEntry, 'id'>) => {
    const queue = pending.current
    queue.push({ ...entry, id: nextId.current++ })
    // A background tab does not run animation frames, so the queue is
    // trimmed here too, in steps so that a busy log does not copy it per line.
    if (queue.length >= 2 * MAX_LOG_ENTRIES) queue.splice(0, queue.length - MAX_LOG_ENTRIES)
    if (frame.current === null) frame.current = requestAnimationFrame(flush)
  }, [flush])

  const setPod = useCallback((pod: string, active: boolean) => {
    setPods((prev) => {
      const others = prev.filter((p) => p.name !== pod)
      return [...others, { name: pod, active }].sort((a, b) => a.name.localeCompare(b.name))
    })
  }, [])

  const stop = useCallback(() => {
    if (!controller.current) return
    controller.current.abort()
    controller.current = null
    setPods(allEnded)
    setStatus('stopped')
  }, [])

  const start = useCallback(() => {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setError(null)
    setStatus('connecting')
    // Pods are announced again by the new stream; one deleted while the
    // stream was stopped must not count as followed.
    setPods(allEnded)

    const onEvent = (event: CappLogEvent): 'end' | 'error' | undefined => {
      switch (event.type) {
        case 'log':
          push({ kind: 'line', pod: event.data.pod, timestamp: event.data.timestamp, text: event.data.line })
          return undefined
        case 'pod-started':
          setPod(event.data.pod, true)
          push({ kind: 'pod', pod: event.data.pod, text: 'following' })
          return undefined
        case 'pod-ended':
          setPod(event.data.pod, false)
          push({ kind: 'pod', pod: event.data.pod, text: event.data.reason ?? 'ended' })
          return undefined
        case 'notice':
          push({ kind: 'notice', text: event.data.message })
          return undefined
        case 'error':
          push({ kind: 'error', text: event.data.message })
          return 'error'
        case 'end':
          return 'end'
      }
    }

    void (async () => {
      let tailLines = INITIAL_TAIL_LINES
      let retries = 0
      let connectedOnce = false
      for (;;) {
        let outcome: 'end' | 'error' | undefined
        let opened = false
        let received = false
        try {
          await streamCappLogs(namespace, name, { tailLines }, (event) => {
            if (!received) {
              received = true
              retries = 0
            }
            outcome = onEvent(event) ?? outcome
          }, abort.signal, () => {
            opened = true
            connectedOnce = true
            setStatus('live')
          })
        } catch (e) {
          // stop() set the status already.
          if (isAbort(e) || abort.signal.aborted) return
          // The first connection failing, or any refusal, is final. A
          // reconnect that cannot reach the backend uses the retry budget.
          if (!opened && (!connectedOnce || isRefused(e))) {
            controller.current = null
            setError(e instanceof Error ? e.message : String(e))
            setStatus('failed')
            return
          }
        }
        if (abort.signal.aborted) return
        if (outcome === 'error') {
          controller.current = null
          setStatus('failed')
          setError('The log stream ended with an error.')
          return
        }
        if (outcome !== 'end') {
          retries++
          if (retries > MAX_RETRIES) {
            controller.current = null
            setStatus('failed')
            setError('The connection to the log stream was lost.')
            return
          }
          push({ kind: 'notice', text: 'connection lost; reconnecting' })
          setStatus('reconnecting')
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          if (abort.signal.aborted) return
        }
        // The pods are announced again by the new stream.
        setPods(allEnded)
        tailLines = 0
      }
    })()
  }, [name, namespace, push, setPod])

  const clear = useCallback(() => {
    pending.current = []
    setEntries([])
  }, [])

  // Another Capp or cluster, or leaving the page, ends the stream and its state.
  useEffect(() => {
    return () => {
      controller.current?.abort()
      controller.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      pending.current = []
      setEntries([])
      setPods([])
      setStatus('idle')
      setError(null)
    }
  }, [cluster, namespace, name])

  return { entries, pods, status, error, start, stop, clear }
}
