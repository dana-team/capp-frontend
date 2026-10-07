import React from 'react'
import { MegaphoneIcon } from '@phosphor-icons/react'
import { ANNOTATION_MESSAGE } from '@/types/capp'

interface CappMessageBannerProps {
  annotations?: Record<string, string>
}

/**
 * Shows the message an operator left on a Capp through the
 * `rcs.dana.io/message` annotation.
 */
export const CappMessageBanner: React.FC<CappMessageBannerProps> = ({ annotations }) => {
  const message = annotations?.[ANNOTATION_MESSAGE]?.trim()
  if (!message) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[10px] border border-primary/50 border-l-4 border-l-primary bg-[color-mix(in_oklab,var(--color-primary)_16%,var(--color-card))] px-4 py-3.5 shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <MegaphoneIcon size={18} weight="fill" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Message</p>
        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium text-text">{message}</p>
      </div>
    </div>
  )
}
