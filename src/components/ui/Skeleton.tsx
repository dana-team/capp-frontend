import React from 'react'
import { cn } from '@/lib/utils'

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton', className)} aria-hidden="true" />
)

export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 6 }) => (
  <tr className="border-b border-border/50">
    <td className="w-2 p-0" />
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className={cn('h-4', i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-20')} />
      </td>
    ))}
    <td className="w-24 px-4 py-3">
      <Skeleton className="h-4 w-12 ml-auto" />
    </td>
  </tr>
)
