import React from 'react'
import { cn } from '@/lib/utils'

interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as a different element, e.g. "section". */
  as?: React.ElementType
}

/** A sheet of paper resting on the painting: card surface, hairline, soft lift. */
export const Sheet: React.FC<SheetProps> = ({ as: Tag = 'div', className, ...props }) => (
  <Tag
    className={cn(
      'rounded-[10px] border border-border bg-card',
      'shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]',
      className
    )}
    {...props}
  />
)
