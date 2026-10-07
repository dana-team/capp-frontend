import React from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Warning } from '@/types/capp'

interface WarningBannerProps {
  warnings?: Warning[]
}

/**
 * Renders warnings returned alongside a successful response. The operation the
 * user asked for did happen — only a side effect, such as the Git backup,
 * did not.
 */
export const WarningBanner: React.FC<WarningBannerProps> = ({ warnings }) => {
  if (!warnings?.length) return null

  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-warning/40 bg-card px-4 py-3 text-sm text-warning shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]">
      {warnings.map((w, i) => (
        <div key={`${w.code}-${i}`} className="flex items-start gap-2">
          <WarningCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  )
}
