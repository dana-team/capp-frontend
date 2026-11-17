import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CfuncHeader } from '@/components/cfunc/CfuncHeader'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile } from '@/components/layout/StatTile'
import { ResourceListSheet, type ListColumn } from '@/components/cfunc/ResourceListSheet'
import { ConfirmDeleteDialog } from '@/components/cfunc/ConfirmDeleteDialog'
import { useNamespaceContext } from '@/context/NamespaceContext'
import { useDeletePool, usePools } from '@/hooks/useCfunc'
import type { PoolResponse } from '@/types/cfunc'
import { poolHealth } from '@/utils/cfunc'
import { relativeTime } from '@/utils/time'

const COLUMNS: ListColumn<PoolResponse>[] = [
  {
    key: 'namespace', label: 'Namespace', className: 'hidden w-36 shrink-0 md:block',
    sortValue: (p) => p.namespace, render: (p) => p.namespace,
  },
  {
    key: 'flavor', label: 'Flavor', className: 'hidden w-20 shrink-0 sm:block',
    sortValue: (p) => p.flavor, render: (p) => p.flavor || 'custom',
  },
  {
    key: 'size', label: 'Size', className: 'hidden w-20 shrink-0 lg:block',
    sortValue: (p) => p.size, render: (p) => p.size || 'custom',
  },
  {
    key: 'poolSize', label: 'Pods', className: 'hidden w-12 shrink-0 sm:block', end: true,
    sortValue: (p) => p.poolSize, render: (p) => p.poolSize,
  },
  {
    key: 'createdAt', label: 'Created', className: 'hidden w-20 shrink-0 sm:block', end: true,
    sortValue: (p) => p.createdAt ?? '', render: (p) => relativeTime(p.createdAt),
  },
]

export const PoolListPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const { data: items, isPending: isLoading, error } = usePools(selectedNamespace)
  const { mutateAsync: deletePool, isPending: isDeleting } = useDeletePool()
  const [deleteTarget, setDeleteTarget] = useState<PoolResponse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const list = items ?? []
    const flavors = new Map<string, number>()
    list.forEach((p) => flavors.set(p.flavor || 'custom', (flavors.get(p.flavor || 'custom') ?? 0) + 1))
    return {
      total: list.length,
      ready: list.filter((p) => poolHealth(p).tone === 'success').length,
      notReady: list.filter((p) => poolHealth(p).tone === 'danger').length,
      pods: list.reduce((n, p) => n + p.poolSize, 0),
      flavors: [...flavors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4),
    }
  }, [items])
  const loading = isLoading || !items
  const num = (n: number) => (loading ? '–' : n)
  const maxFlavor = stats.flavors[0]?.[1] ?? 1

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePool({ namespace: deleteTarget.namespace, name: deleteTarget.name })
      setDeleteTarget(null)
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Pool')
    }
  }

  return (
    <div className="space-y-4">
      <CfuncHeader view="pools" />

      <StatBand>
        <StatTile index={0} label="Total" value={num(stats.total)} share={stats.total ? 1 : 0} />
        <StatTile
          index={1} label="Ready" tone="success" value={num(stats.ready)}
          share={stats.total ? stats.ready / stats.total : 0}
        />
        <StatTile
          index={2} label="Not ready" tone="danger" value={num(stats.notReady)}
          share={stats.total ? stats.notReady / stats.total : 0}
        />
        <StatTile index={3} label="Warm pods">
          <div className="mt-3">
            <div className="font-display text-[40px] font-medium leading-none tabular-nums text-text">{num(stats.pods)}</div>
            <div className="mt-3 truncate text-xs text-text-muted">across all Pools</div>
          </div>
        </StatTile>
        <StatTile index={4} label="Flavors" className="col-span-2">
          <ul className="mt-3 space-y-1.5">
            {stats.flavors.length === 0 && (
              <li className="text-xs text-text-muted">{loading ? 'Loading…' : 'No Pools yet'}</li>
            )}
            {stats.flavors.map(([flavor, n]) => (
              <li key={flavor} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate font-mono text-text-secondary" title={flavor}>{flavor}</span>
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-border-subtle">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(n / maxFlavor) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-text-muted">{n}</span>
              </li>
            ))}
          </ul>
        </StatTile>
      </StatBand>

      <ResourceListSheet
        title="Pools"
        kind="Pool"
        basePath="/pools"
        items={items}
        isLoading={isLoading}
        error={error}
        columns={COLUMNS}
        subline={(p) => p.image}
        health={poolHealth}
        searchText={(p) => `${p.flavor} ${p.size}`}
        emptyDescription="Create a Pool before you create a Function. A Function runs in a Pool of its namespace."
        onCreate={() => navigate('/pools/new')}
        onDelete={(p) => { setDeleteTarget(p); setDeleteError(null) }}
      />

      <ConfirmDeleteDialog
        kind="Pool"
        name={deleteTarget?.name ?? null}
        note="The backend refuses the delete while a Function of the namespace uses the Pool."
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  )
}
