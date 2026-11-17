import React from 'react'
import { cn } from '@/lib/utils'

/** Marks the cfunc pages as beta: the backend API behind them can still change. */
export const BetaTag: React.FC<{ className?: string }> = ({ className }) => (
  <span
    title="Beta: this feature can still change"
    className={cn(
      'inline-flex shrink-0 items-center rounded-full border border-primary/40 px-1.5 py-px font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-primary',
      className,
    )}
  >
    Beta
  </span>
)
