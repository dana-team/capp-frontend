import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowCounterClockwiseIcon, CircleNotchIcon, TrashSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionSheet } from '@/components/layout/DetailParts'
import { DriftPanel } from '@/components/backup/DriftPanel'
import { BackendApiError } from '@/api/client'
import type { DriftAction, DriftKind } from '@/api/drift'
import { useResolveDrift } from '@/hooks/useDrift'
import type { Drift, DriftMissing } from '@/types/drift'
import { formatTimestamp, relativeTime } from '@/utils/time'

const NOUN: Record<DriftKind, string> = { capps: 'Capp', configmaps: 'ConfigMap', secrets: 'Secret' }
const LIST_PATH: Record<DriftKind, string> = { capps: '/capps', configmaps: '/configmaps', secrets: '/secrets' }

/** What restoring creates, said before it is done. */
export const RESTORES: Record<DriftKind | 'namespaces', string> = {
  capps: 'The Capp is created again with the spec, labels and annotations of its backup. ConfigMaps and Secrets it uses are restored on their own pages.',
  configmaps: 'The ConfigMap is created again with the data, labels and annotations of its backup.',
  secrets: 'The Secret is created again with the values, labels and annotations of its backup.',
  namespaces: 'The namespace is created again with the quota and members of its backup. Its Capps, ConfigMaps and Secrets are restored on their own pages.',
}

const FORGETS = 'It is no longer listed and can no longer be restored. The backup is archived, not deleted.'

/** When the backup was taken, and by whom when the backend knows. */
export const BackedUp: React.FC<{ drift: Drift }> = ({ drift }) =>
  drift.updatedAt ? (
    <span title={formatTimestamp(drift.updatedAt)}>
      backed up {relativeTime(drift.updatedAt)}{drift.updatedBy && ` by ${drift.updatedBy}`}
    </span>
  ) : (
    <span>backed up</span>
  )

function failure(e: unknown, reviewHref?: string): React.ReactNode {
  if (e instanceof BackendApiError && e.code === 'DRIFT_DETECTED') {
    if (e.details?.drift?.state === 'missing') return 'Its backup changed in the meantime. The list is up to date again; decide again.'
    // The object exists after all: created again, or it lost the label that puts it under the console.
    if (!reviewHref) return 'It is in the cluster again. Reload to review it.'
    return (
      <>It is in the cluster again. <Link to={reviewHref} className="underline underline-offset-2">Review it</Link> before you restore it.</>
    )
  }
  return (e as Error).message
}

interface RestoreActionsProps {
  /** Says what restoring does. */
  restores: string
  /** Sends a revert (restore) or an accept (forget). */
  resolve: (action: DriftAction) => Promise<unknown>
  /** Runs after a successful forget. */
  onForgotten?: () => void
  /** Where to review an object that turns out to exist. */
  reviewHref?: string
}

/** Restore and Forget, each confirmed in place, so they also work inside a dialog. */
export const RestoreActions: React.FC<RestoreActionsProps> = ({ restores, resolve, onForgotten, reviewHref }) => {
  const [confirming, setConfirming] = useState<DriftAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<React.ReactNode>(null)

  const run = async (action: DriftAction) => {
    setBusy(true)
    setError(null)
    try {
      await resolve(action)
      setConfirming(null)
      if (action === 'accept') onForgotten?.()
    } catch (e) {
      setConfirming(null)
      setError(failure(e, reviewHref))
    } finally {
      setBusy(false)
    }
  }

  const ask = (action: DriftAction) => () => {
    setError(null)
    setConfirming(action)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
      {error && (
        <Alert variant="destructive" className="py-2">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {confirming ? (
        <div className="flex max-w-md flex-col gap-2 sm:items-end">
          <p className="text-sm text-text-secondary sm:text-right">{confirming === 'revert' ? restores : FORGETS}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={confirming === 'revert' ? 'primary' : 'danger'} size="sm" onClick={() => void run(confirming)} disabled={busy}>
              {busy && <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />}
              {confirming === 'revert' ? 'Restore' : 'Forget'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={ask('revert')}>
            <ArrowCounterClockwiseIcon size={14} className="mr-1.5" /> Restore
          </Button>
          <Button variant="ghost" size="sm" onClick={ask('accept')}>
            Forget
          </Button>
        </div>
      )}
    </div>
  )
}

const deletedTitle = (
  <>
    <TrashSimpleIcon size={16} className="text-warning" /> Deleted from cluster
  </>
)

const MissingRow: React.FC<{ kind: DriftKind; item: DriftMissing; showNamespace: boolean }> = ({ kind, item, showNamespace }) => {
  const { mutateAsync } = useResolveDrift(kind)
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm text-text" title={item.name}>{item.name}</div>
        <div className="mt-0.5 truncate text-xs text-text-muted">
          {showNamespace && <span className="font-mono">{item.namespace} · </span>}
          <BackedUp drift={item.drift} />
        </div>
      </div>
      <RestoreActions
        restores={RESTORES[kind]}
        resolve={(action) => mutateAsync({ action, namespace: item.namespace, name: item.name, drift: item.drift })}
        reviewHref={`${LIST_PATH[kind]}/${item.namespace}/${item.name}`}
      />
    </li>
  )
}

/** The objects of a list that were deleted from the cluster but have a backup. */
export const MissingSection: React.FC<{ kind: DriftKind; missing?: DriftMissing[]; showNamespace: boolean }> = ({
  kind, missing, showNamespace,
}) => {
  if (!missing?.length) return null
  const noun = NOUN[kind]
  return (
    <SectionSheet title={deletedTitle} aside={`${missing.length} with a backup`}>
      <p className="mb-3 text-sm text-text-secondary">
        {missing.length === 1 ? `This ${noun} was` : `These ${noun}s were`} deleted from the cluster outside the
        console. The backup is kept: restore to create it again, or forget it.
      </p>
      <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
        {missing.map((m) => (
          <MissingRow key={`${m.namespace}/${m.name}`} kind={kind} item={m} showNamespace={showNamespace} />
        ))}
      </ul>
    </SectionSheet>
  )
}

const DeletedNotice: React.FC<{ kind: DriftKind; namespace: string; name: string; drift: Drift }> = ({
  kind, namespace, name, drift,
}) => {
  const navigate = useNavigate()
  const { mutateAsync } = useResolveDrift(kind)
  return (
    <SectionSheet title={deletedTitle} aside={<BackedUp drift={drift} />}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          This {NOUN[kind]} was deleted from the cluster outside the console, but its backup is kept.
        </p>
        <RestoreActions
          restores={RESTORES[kind]}
          resolve={(action) => mutateAsync({ action, namespace, name, drift })}
          onForgotten={() => navigate(LIST_PATH[kind])}
        />
      </div>
    </SectionSheet>
  )
}

/**
 * Shown by a detail page whose object is not there but has a backup (see notFoundDrift): an offer to
 * restore a deleted object, or the drift of one that lost the label that puts it under the console.
 */
export const BackedUpNotFound: React.FC<{ kind: DriftKind; namespace: string; name: string; drift: Drift }> = (props) =>
  props.drift.state === 'missing' ? <DeletedNotice {...props} /> : <DriftPanel {...props} />
