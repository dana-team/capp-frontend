/**
 * Reads a text/event-stream body and calls onEvent with each event's name
 * and data. Comments (keepalives) and events without data are skipped.
 */
export async function readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (type: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let type = ''
  let data: string[] = []

  const dispatch = () => {
    if (data.length > 0) onEvent(type || 'message', data.join('\n'))
    type = ''
    data = []
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (line === '') {
          dispatch()
        } else if (line.startsWith(':')) {
          // comment
        } else {
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          const raw = colon < 0 ? '' : line.slice(colon + 1)
          const fieldValue = raw.startsWith(' ') ? raw.slice(1) : raw
          if (field === 'event') type = fieldValue
          else if (field === 'data') data.push(fieldValue)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
