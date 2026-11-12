import React from 'react'
import { CircleNotchIcon, LinkSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { SectionSheet } from '@/components/layout/DetailParts'
import { useBoundCapps } from '@/hooks/useBoundCapps'
import { BOUND_KIND_LABEL, BoundResourceKind } from '@/types/bound'
import { BoundCappList } from './BoundCappList'

interface BoundCappsSectionProps {
  kind: BoundResourceKind
  namespace: string
  name: string
}

/** Detail-page section listing the Capps that reference a Secret or ConfigMap. */
export const BoundCappsSection: React.FC<BoundCappsSectionProps> = ({ kind, namespace, name }) => {
  const { data, isPending, error } = useBoundCapps(kind, namespace, name)
  const label = BOUND_KIND_LABEL[kind]
  const total = data?.boundCapps.length ?? 0
  const reloading = data?.toReload.length ?? 0

  return (
    <SectionSheet
      title={<><LinkSimpleIcon size={16} className="text-text-muted" /> Bound Capps</>}
      aside={data ? `${total}` : undefined}
    >
      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <CircleNotchIcon size={14} className="animate-spin" /> Looking for Capps that use this {label}…
        </div>
      ) : error ? (
        <p className="flex items-center gap-2 text-sm text-danger">
          <WarningCircleIcon size={14} /> Could not load bound Capps: {(error as Error).message}
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-text-muted">No Capps in this namespace use this {label}.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {reloading === 0
              ? `Changing this ${label} rolls out none of these Capps.`
              : reloading === total
                ? `Changing this ${label} rolls out ${total === 1 ? 'this Capp' : `all ${total} Capps`}.`
                : `Changing this ${label} rolls out ${reloading} of these ${total} Capps.`}
            {' '}It cannot be deleted while any Capp uses it.
          </p>
          <BoundCappList kind={kind} namespace={namespace} bound={data} />
        </div>
      )}
    </SectionSheet>
  )
}
