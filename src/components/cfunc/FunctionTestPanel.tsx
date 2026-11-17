import React, { useState } from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { KeyValueList, type KeyValuePair } from '@/components/ui/KeyValueList'
import { SectionSheet } from '@/components/layout/DetailParts'
import { BackendApiError } from '@/api/client'
import { useTestFunction } from '@/hooks/useCfunc'
import type { FunctionResponse } from '@/types/cfunc'

const HTTP_NOT_IMPLEMENTED = 501
const HTTP_TOO_MANY_REQUESTS = 429
const codeCls = 'max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border-subtle bg-background/40 p-3 font-mono text-xs text-text'

const statusVariant = (code: number) => (code < 300 ? 'success' : code < 500 ? 'warning' : 'danger')

/** Sends one request through an http trigger of the function and shows the answer. */
export const FunctionTestPanel: React.FC<{ fn: FunctionResponse }> = ({ fn }) => {
  const httpTriggers = fn.triggers.filter((t) => t.type === 'http')
  const [triggerName, setTriggerName] = useState(httpTriggers[0]?.name ?? '')
  const [method, setMethod] = useState('')
  const [headers, setHeaders] = useState<KeyValuePair[]>([])
  const [body, setBody] = useState('')
  const { mutate, data, error, isPending, reset } = useTestFunction()

  const trigger = httpTriggers.find((t) => t.name === triggerName) ?? httpTriggers[0]
  const methods = trigger?.methods?.length ? trigger.methods : ['GET']
  const selectedMethod = methods.includes(method) ? method : methods[0]
  const notConfigured = error instanceof BackendApiError && error.status === HTTP_NOT_IMPLEMENTED

  if (!trigger) {
    return (
      <SectionSheet title="Test call">
        <p className="text-sm text-text-muted">
          A test call goes through an HTTP trigger. This Function has no HTTP trigger.
        </p>
      </SectionSheet>
    )
  }

  const send = () => {
    reset()
    const sentHeaders = Object.fromEntries(headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]))
    mutate({
      namespace: fn.namespace,
      name: fn.name,
      req: {
        trigger: trigger.name,
        method: selectedMethod,
        ...(Object.keys(sentHeaders).length > 0 && { headers: sentHeaders }),
        ...(body && { body }),
      },
    })
  }

  return (
    <SectionSheet title="Test call">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
          <SimpleSelect
            label="Trigger"
            options={httpTriggers.map((t) => ({ value: t.name, label: `${t.name}  ${t.fullPath ?? t.path ?? ''}` }))}
            value={trigger.name}
            onChange={setTriggerName}
          />
          <SimpleSelect
            label="Method"
            options={methods.map((m) => ({ value: m, label: m }))}
            value={selectedMethod}
            onChange={setMethod}
          />
          <Button type="button" onClick={send} loading={isPending} icon={<PlayIcon size={14} />}>
            Send
          </Button>
        </div>
        <KeyValueList label="Headers" value={headers} onChange={setHeaders} keyPlaceholder="Header" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="test-body" className="font-sans text-sm font-medium text-text-secondary">Body</label>
          <textarea
            id="test-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder='{"name": "world"}'
            className="w-full resize-y rounded border border-border bg-card px-3 py-2 font-mono text-xs text-text placeholder:text-text-muted hover:border-text/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-danger">
            {notConfigured
              ? 'Test calls are not available: the backend has no router URL for this cluster.'
              : error.message}
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <Badge variant={statusVariant(data.statusCode)}>{data.statusCode}</Badge>
              <span className="tabular-nums">{data.durationMs} ms</span>
              <span className="min-w-0 break-all font-mono">{data.method} {data.url}</span>
            </div>
            {data.headers && Object.keys(data.headers).length > 0 && (
              <details className="text-xs text-text-muted">
                <summary className="cursor-pointer select-none hover:text-text">
                  Response headers ({Object.keys(data.headers).length})
                </summary>
                <pre className={`${codeCls} mt-2`}>
                  {Object.entries(data.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </pre>
              </details>
            )}
            <pre className={codeCls}>{data.body || '(empty body)'}</pre>
            {data.statusCode === HTTP_TOO_MANY_REQUESTS && (
              <p className="text-xs text-warning">
                The Function has no free pod: it is at its concurrency limit. Try again, or increase Concurrency.
              </p>
            )}
            {data.truncated && (
              <p className="text-xs text-warning">The body is longer than the backend returns. This is the first part.</p>
            )}
          </div>
        )}
      </div>
    </SectionSheet>
  )
}
