import React from 'react'
import { cn } from '@/lib/utils'

/** Responsive grid of StatTiles floating over the painting. */
export const StatBand: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn('grid grid-cols-2 gap-3 lg:grid-cols-6', className)}
    {...props}
  />
)
