import React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Sheet } from './Sheet'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral'

export const toneDot: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-text-muted/60',
}

interface StatTileProps {
  label: string
  value?: React.ReactNode
  /** Status dot beside the label. */
  tone?: Tone
  /** 0..1 share rendered as a thin bar under the number. */
  share?: number
  /** Replaces the default number layout (e.g. a breakdown). */
  children?: React.ReactNode
  /** Stagger position. */
  index?: number
  className?: string
}

const MotionSheet = motion.create(Sheet)

/** A floating paper tile: one number and its label. */
export const StatTile: React.FC<StatTileProps> = ({
  label, value, tone, share, children, index = 0, className,
}) => (
  <MotionSheet
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: 0.12 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ y: -2 }}
    className={cn('flex flex-col justify-between p-4', className)}
  >
    <div className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
      {tone && <span className={cn('h-2 w-2 rounded-full', toneDot[tone])} aria-hidden />}
      {label}
    </div>
    {children ?? (
      <div className="mt-3">
        <div className="font-display text-[40px] font-medium leading-none tabular-nums text-text">{value}</div>
        {share != null && (
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-border-subtle">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', toneDot[tone ?? 'neutral'])}
              style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
            />
          </div>
        )}
      </div>
    )}
  </MotionSheet>
)
