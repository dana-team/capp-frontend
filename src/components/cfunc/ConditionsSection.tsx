import React from 'react'
import { Badge } from '@/components/ui/badge'
import { SectionSheet, DataTable, rowCls } from '@/components/layout/DetailParts'
import type { CfuncCondition } from '@/types/cfunc'
import { relativeTime } from '@/utils/time'
import { statusVariant } from '@/utils/cappHealth'

export const ConditionsSection: React.FC<{ conditions?: CfuncCondition[] }> = ({ conditions }) => {
  const list = conditions ?? []
  return (
    <SectionSheet title="Status conditions" aside={list.length ? `${list.length}` : undefined}>
      {list.length === 0 ? (
        <p className="text-sm text-text-muted">No status conditions reported yet.</p>
      ) : (
        <DataTable head={['Type', 'Status', 'Reason', 'Message', 'Changed']}>
          {list.map((c) => (
            <tr key={c.type} className={rowCls}>
              <td className="px-3 py-2 text-sm font-medium text-text">{c.type}</td>
              <td className="px-3 py-2"><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">{c.reason ?? '—'}</td>
              <td className="break-words px-3 py-2 text-xs text-text-muted">{c.message ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-text-muted">
                {relativeTime(c.lastTransitionTime)}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </SectionSheet>
  )
}

/** Value line used inside StatTile children. */
export const TileValue: React.FC<{ main: React.ReactNode; sub?: React.ReactNode; className?: string }> = ({
  main, sub, className,
}) => (
  <div className="mt-3 min-w-0">
    <div className={`truncate font-display text-[28px] font-medium leading-[1.2] tabular-nums text-text ${className ?? ''}`}>
      {main}
    </div>
    {sub && <div className="mt-2 line-clamp-2 break-words text-xs text-text-muted">{sub}</div>}
  </div>
)
