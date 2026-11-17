import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CfuncHeader } from '@/components/cfunc/CfuncHeader'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile } from '@/components/layout/StatTile'
import { ResourceListSheet, type ListColumn } from '@/components/cfunc/ResourceListSheet'
import { ConfirmDeleteDialog } from '@/components/cfunc/ConfirmDeleteDialog'
import { useNamespaceContext } from '@/context/NamespaceContext'
import { useDeleteFunction, useFunctions } from '@/hooks/useCfunc'
import type { FunctionResponse } from '@/types/cfunc'
import { functionHealth } from '@/utils/cfunc'
import { relativeTime } from '@/utils/time'

const triggerSummary = (f: FunctionResponse) => {
  const http = f.triggers.filter((t) => t.type === 'http').length
  const cron = f.triggers.length - http
  return [http && `${http} http`, cron && `${cron} cron`].filter(Boolean).join(' · ') || 'none'
}

const COLUMNS: ListColumn<FunctionResponse>[] = [
  {
    key: 'namespace', label: 'Namespace', className: 'hidden w-36 shrink-0 md:block',
    sortValue: (f) => f.namespace, render: (f) => f.namespace,
  },
  {
    key: 'pool', label: 'Pool', className: 'hidden w-32 shrink-0 sm:block',
    sortValue: (f) => f.pool, render: (f) => f.pool,
  },
  {
    key: 'triggers', label: 'Triggers', className: 'hidden w-28 shrink-0 lg:block',
    sortValue: (f) => f.triggers.length, render: triggerSummary,
  },
  {
    key: 'state', label: 'State', className: 'hidden w-28 shrink-0 sm:block',
    sortValue: (f) => functionHealth(f).label, render: (f) => functionHealth(f).label,
  },
  {
    key: 'createdAt', label: 'Created', className: 'hidden w-20 shrink-0 sm:block', end: true,
    sortValue: (f) => f.createdAt ?? '', render: (f) => relativeTime(f.createdAt),
  },
]

export const FunctionListPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const { data: items, isPending: isLoading, error } = useFunctions(selectedNamespace)
  const { mutateAsync: deleteFunction, isPending: isDeleting } = useDeleteFunction()
  const [deleteTarget, setDeleteTarget] = useState<FunctionResponse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const list = items ?? []
    const tones = list.map((f) => functionHealth(f).tone)
    const triggers = list.flatMap((f) => f.triggers)
    return {
      total: list.length,
      ready: tones.filter((t) => t === 'success').length,
      building: tones.filter((t) => t === 'warning').length,
      failed: tones.filter((t) => t === 'danger').length,
      http: triggers.filter((t) => t.type === 'http').length,
      cron: triggers.filter((t) => t.type === 'cron').length,
    }
  }, [items])
  const loading = isLoading || !items
  const num = (n: number) => (loading ? '–' : n)
  const share = (n: number) => (stats.total ? n / stats.total : 0)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteFunction({ namespace: deleteTarget.namespace, name: deleteTarget.name })
      setDeleteTarget(null)
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Function')
    }
  }

  return (
    <div className="space-y-4">
      <CfuncHeader view="functions" />

      <StatBand>
        <StatTile index={0} label="Total" value={num(stats.total)} share={stats.total ? 1 : 0} />
        <StatTile index={1} label="Ready" tone="success" value={num(stats.ready)} share={share(stats.ready)} />
        <StatTile index={2} label="Building" tone="warning" value={num(stats.building)} share={share(stats.building)} />
        <StatTile index={3} label="Failed" tone="danger" value={num(stats.failed)} share={share(stats.failed)} />
        <StatTile index={4} label="Triggers" className="col-span-2">
          <div className="mt-3 flex items-end gap-8">
            {([['http', stats.http], ['cron', stats.cron]] as const).map(([label, n]) => (
              <div key={label}>
                <div className="font-display text-[40px] font-medium leading-none tabular-nums text-text">{num(n)}</div>
                <div className="mt-3 font-mono text-xs text-text-muted">{label}</div>
              </div>
            ))}
          </div>
        </StatTile>
      </StatBand>

      <ResourceListSheet
        title="Functions"
        kind="Function"
        basePath="/functions"
        items={items}
        isLoading={isLoading}
        error={error}
        columns={COLUMNS}
        subline={(f) => [f.source.url, f.source.path].filter(Boolean).join(' · ')}
        health={functionHealth}
        searchText={(f) => `${f.pool} ${f.source.url}`}
        emptyDescription="A Function is code from a git repository that runs in a Pool, with the triggers that call it."
        onCreate={() => navigate('/functions/new')}
        onDelete={(f) => { setDeleteTarget(f); setDeleteError(null) }}
      />

      <ConfirmDeleteDialog
        kind="Function"
        name={deleteTarget?.name ?? null}
        note="Its triggers are deleted with it."
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  )
}
