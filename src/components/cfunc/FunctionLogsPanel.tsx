import React, { useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { SectionSheet } from '@/components/layout/DetailParts'
import { BackendApiError } from '@/api/client'
import { useFunctionLogs } from '@/hooks/useCfunc'

const HTTP_FORBIDDEN = 403
const LINE_OPTIONS = ['100', '250', '500', '1000'].map((n) => ({ value: n, label: `${n} lines` }))

/** Recent log lines of the pods that serve the function. Loaded on request, not with the page. */
export const FunctionLogsPanel: React.FC<{ namespace: string; name: string }> = ({ namespace, name }) => {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState('100')
  const { data, error, isFetching, refetch } = useFunctionLogs(namespace, name, Number(lines), open)
  const forbidden = error instanceof BackendApiError && error.status === HTTP_FORBIDDEN
  const pods = data?.pods ?? []

  return (
    <SectionSheet title="Logs" aside={data ? `${pods.length} ${pods.length === 1 ? 'pod' : 'pods'}` : undefined}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36">
            <SimpleSelect options={LINE_OPTIONS} value={lines} onChange={setLines} />
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={isFetching}
            icon={<ArrowsClockwiseIcon size={14} />}
            onClick={() => (open ? refetch() : setOpen(true))}
          >
            {open ? 'Refresh' : 'Load logs'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-danger">
            {forbidden ? `Logs are not available to you on this backend: ${error.message}` : error.message}
          </p>
        )}

        {data && pods.length === 0 && (
          <p className="text-sm text-text-muted">
            No recent runs. A pod leaves the Function after approximately two minutes without a request.
          </p>
        )}

        {pods.map((pod) => (
          <div key={pod.pod}>
            <p className="mb-1 font-mono text-xs text-text-muted">{pod.pod}</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border-subtle bg-background/40 p-3 font-mono text-xs leading-relaxed text-text">
              {pod.lines.length > 0 ? pod.lines.join('\n') : '(no lines)'}
            </pre>
          </div>
        ))}
      </div>
    </SectionSheet>
  )
}
