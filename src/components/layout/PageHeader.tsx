import React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  /** Shown beside the title, e.g. a resource count. */
  count?: number
  actions?: React.ReactNode
  className?: string
}

/** Page title block for dashboard pages that sit directly on the painting. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title, description, count, actions, className,
}) => (
  <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
    <div className="min-w-0 [text-shadow:0_0_12px_hsl(var(--background)),0_0_2px_hsl(var(--background))]">
      <h1 className="flex items-baseline gap-3 font-display text-[34px] font-medium leading-none tracking-tight text-text">
        {title}
        {count != null && (
          <span className="font-sans text-sm font-medium tabular-nums text-text-muted">{count}</span>
        )}
      </h1>
      {description && <p className="mt-1.5 text-sm text-text-secondary">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
)
