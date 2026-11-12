import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowsClockwiseIcon, CubeIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { BoundCappsResponse, BoundResourceKind } from '@/types/bound'

const NO_ROLLOUT_HINT: Record<BoundResourceKind, string> = {
  configmap: 'This Capp has rollout on bound resource change turned off.',
  secret:
    'This Capp has rollout on bound resource change turned off, or uses the Secret only for log shipping or a Kafka source, which a rollout would not refresh.',
}

/** Bound Capps first by whether they roll out, then by name. */
export function sortBound(bound: BoundCappsResponse): Array<{ name: string; reloads: boolean }> {
  const reload = new Set(bound.toReload)
  return [...bound.boundCapps]
    .map((name) => ({ name, reloads: reload.has(name) }))
    .sort((a, b) => Number(b.reloads) - Number(a.reloads) || a.name.localeCompare(b.name))
}

interface BoundCappListProps {
  kind: BoundResourceKind
  namespace: string
  bound: BoundCappsResponse
  /** Hide the per-row rollout badge, e.g. when deleting, where rollouts do not apply. */
  hideRollout?: boolean
  /** Opens Capp links in a new tab so an open dialog or unsaved form survives. */
  newTab?: boolean
}

export const BoundCappList: React.FC<BoundCappListProps> = ({ kind, namespace, bound, hideRollout, newTab }) => (
  <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
    {sortBound(bound).map(({ name, reloads }) => (
      <li key={name} className="flex items-center justify-between gap-3 px-3 py-2">
        <Link
          to={`/capps/${namespace}/${name}`}
          {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="flex min-w-0 items-center gap-2 font-mono text-sm text-text hover:text-primary hover:underline"
        >
          <CubeIcon size={14} weight="duotone" className="shrink-0 text-text-muted" />
          <span className="truncate">{name}</span>
        </Link>
        {!hideRollout &&
          (reloads ? (
            <Badge variant="warning" className="shrink-0 gap-1">
              <ArrowsClockwiseIcon size={12} /> Rolls out
            </Badge>
          ) : (
            <Badge variant="default" className="shrink-0" title={NO_ROLLOUT_HINT[kind]}>
              No rollout
            </Badge>
          ))}
      </li>
    ))}
  </ul>
)
