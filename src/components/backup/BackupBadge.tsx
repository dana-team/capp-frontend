import React from 'react'
import { DatabaseIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import type { Drift } from '@/types/drift'
import { BACKUP_INFO, backupState } from '@/utils/backup'

/** Whether an object is backed up, as far as the backend can tell. */
export const BackupBadge: React.FC<{ drift?: Drift }> = ({ drift }) => {
  const { label, hint, variant } = BACKUP_INFO[backupState(drift)]
  return (
    <Badge variant={variant} className="gap-1" title={hint}>
      <DatabaseIcon size={12} /> {label}
    </Badge>
  )
}
