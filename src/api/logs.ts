import { backendFetch, clusterBase } from '@/api/client'
import type { CappLogEvent, CappLogStreamOptions } from '@/types/logs'
import { readServerSentEvents } from '@/utils/sse'

const EVENT_TYPES = new Set<CappLogEvent['type']>(['log', 'pod-started', 'pod-ended', 'notice', 'error', 'end'])

/**
 * Streams the logs of a Capp's pods and calls onEvent for each event, until
 * the server closes the stream (resolves) or signal aborts it (rejects with
 * an AbortError). onOpen is called once the response headers arrive: the
 * backend sends them as soon as the stream is open, and a Capp with no pods
 * then sends only keepalive comments, which are not events.
 *
 * The backend answers Server-Sent Events, but the browser's EventSource
 * cannot send the Authorization header, so the stream is read with fetch.
 * A failure before the stream starts (403, 404, ...) throws a
 * BackendApiError like any other request.
 */
export async function streamCappLogs(
  namespace: string,
  name: string,
  options: CappLogStreamOptions,
  onEvent: (event: CappLogEvent) => void,
  signal: AbortSignal,
  onOpen?: () => void,
): Promise<void> {
  const params = new URLSearchParams()
  if (options.tailLines !== undefined) params.set('tailLines', String(options.tailLines))
  if (options.pod) params.set('pod', options.pod)
  const query = params.toString()
  const path = `${clusterBase()}/namespaces/${encodeURIComponent(namespace)}/capps/${encodeURIComponent(name)}/logs${query ? `?${query}` : ''}`

  const response = await backendFetch(path, { signal, headers: { Accept: 'text/event-stream' } })
  onOpen?.()
  if (!response.body) return

  await readServerSentEvents(response.body, (type, data) => {
    if (!EVENT_TYPES.has(type as CappLogEvent['type'])) return
    try {
      onEvent({ type, data: JSON.parse(data) } as CappLogEvent)
    } catch {
      // A malformed event is skipped; the stream goes on.
    }
  })
}
