import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { toneDot, type Tone } from './StatTile'

/** Compact list container; rows are separated by hairlines. */
export const ResourceList: React.FC<React.HTMLAttributes<HTMLUListElement>> = ({ className, ...props }) => (
  <ul className={cn('divide-y divide-border-subtle', className)} {...props} />
)

interface ResourceRowProps {
  to: string
  name: string
  /** Mono line under the name, e.g. an image reference. */
  subline?: React.ReactNode
  tone?: Tone
  statusLabel?: string
  /** Right-aligned meta cells (hidden progressively on small screens by the caller). */
  meta?: React.ReactNode
  /** Hover/focus-revealed actions; must not be nested inside the link. */
  actions?: React.ReactNode
  index?: number
}

/** A row whose whole surface is a link; actions reveal on hover or focus. */
export const ResourceRow: React.FC<ResourceRowProps> = ({
  to, name, subline, tone = 'neutral', statusLabel, meta, actions, index = 0,
}) => (
  <motion.li
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay: index < 12 ? index * 0.02 : 0, ease: [0.16, 1, 0.3, 1] }}
    className="group relative"
  >
    <Link
      to={to}
      className="flex items-center gap-4 px-4 py-3 pr-20 outline-none transition-colors hover:bg-primary/[0.05] focus-visible:bg-primary/[0.07] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', toneDot[tone])}
        title={statusLabel}
        role="img"
        aria-label={statusLabel}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-text">{name}</span>
        {subline && <span className="mt-0.5 block truncate font-mono text-xs text-text-muted">{subline}</span>}
      </span>
      {meta}
    </Link>
    {actions && (
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded bg-card/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {actions}
      </div>
    )}
  </motion.li>
)
