import React, { useState } from 'react'
import { ArrowCounterClockwiseIcon, CheckIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DataTable, SectionSheet, rowCls } from '@/components/layout/DetailParts'
import { BackendApiError } from '@/api/client'
import type { DriftAction, DriftKind } from '@/api/drift'
import { useResolveDrift } from '@/hooks/useDrift'
import type { Drift } from '@/types/drift'
import { fieldLabel } from '@/utils/backup'
import { relativeTime, formatTimestamp } from '@/utils/time'

interface DriftPanelProps {
  kind: DriftKind
  namespace: string
  name: string
  drift?: Drift
}

const NOUN: Record<DriftKind, string> = { capps: 'Capp', configmaps: 'ConfigMap', secrets: 'Secret' }

/** What each choice does, said before it is made. */
const CONSEQUENCE: Record<DriftAction, Record<DriftKind, string>> = {
  revert: {
    capps: 'The Capp is changed back to its backup, which rolls out a new revision.',
    configmaps: 'The ConfigMap is changed back to its backup. Capps that roll out on its changes are restarted.',
    secrets: 'The Secret is changed back to its backup. Capps that roll out on its changes are restarted.',
  },
  accept: {
    capps: 'The cluster is left as it is, and becomes the new backup.',
    configmaps: 'The cluster is left as it is, and becomes the new backup.',
    secrets: 'The cluster is left as it is, and becomes the new backup.',
  },
}

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="italic text-text-muted">{children}</span>
)

const Code: React.FC<{ value: unknown }> = ({ value }) => (
  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-sm">
    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
  </pre>
)

/** Entries of `list` that `other` does not have. Lists differ as a whole when their lengths do. */
function onlyIn(list: unknown[], other: unknown[]): unknown[] {
  const others = new Set(other.map((v) => JSON.stringify(v)))
  return list.filter((v) => !others.has(JSON.stringify(v)))
}

const Value: React.FC<{ value: unknown; other: unknown; hidden: boolean }> = ({ value, other, hidden }) => {
  if (hidden) return <Muted>hidden</Muted>
  if (value === undefined) return <Muted>not set</Muted>
  if (!Array.isArray(value) || !Array.isArray(other)) return <Code value={value} />
  // Show what differs, not the whole list.
  const own = onlyIn(value, other)
  const same = value.length - own.length
  return (
    <div className="flex flex-col gap-1">
      {own.map((entry, i) => <Code key={i} value={entry} />)}
      {own.length === 0 && (
        <Muted>
          {same === 0 ? 'empty' : onlyIn(other, value).length === 0 ? 'same entries, other order' : `only the ${same} that match`}
        </Muted>
      )}
      {own.length > 0 && same > 0 && <Muted>and {same} more that match</Muted>}
    </div>
  )
}

/**
 * Shows how an object differs from its backup and lets the user decide: restore the backup,
 * or keep what is in the cluster. Also offers to back up an object that has no backup yet.
 */
export const DriftPanel: React.FC<DriftPanelProps> = ({ kind, namespace, name, drift }) => {
  const { mutateAsync, isPending } = useResolveDrift(kind)
  const [confirming, setConfirming] = useState<DriftAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (drift?.state !== 'changed' && drift?.state !== 'unmanaged') return null

  const run = async (action: DriftAction) => {
    setError(null)
    try {
      await mutateAsync({ action, namespace, name, drift })
      setConfirming(null)
    } catch (e) {
      setConfirming(null)
      const changed = e instanceof BackendApiError && e.code === 'DRIFT_DETECTED'
      setError(changed ? 'It changed again in the meantime. The current difference is shown; decide again.' : (e as Error).message)
    }
  }

  const errorAlert = error && (
    <Alert variant="destructive">
      <WarningCircleIcon className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  if (drift.state === 'unmanaged') {
    return (
      <SectionSheet title="Not backed up">
        <div className="flex flex-col gap-3">
          {errorAlert}
          <p className="text-sm text-text-secondary">
            There is no backup of this {NOUN[kind]} yet. It gets one the next time it is saved, or now.
          </p>
          <div>
            <Button variant="secondary" size="sm" onClick={() => run('accept')} disabled={isPending}>
              {isPending ? <CircleNotchIcon size={14} className="mr-1.5 animate-spin" /> : <CheckIcon size={14} className="mr-1.5" />}
              Back up now
            </Button>
          </div>
        </div>
      </SectionSheet>
    )
  }

  const fields = drift.fields ?? []
  const secret = kind === 'secrets'
  const backedUp = drift.updatedAt && (
    <span title={formatTimestamp(drift.updatedAt)}>
      backed up {relativeTime(drift.updatedAt)}{drift.updatedBy && ` by ${drift.updatedBy}`}
    </span>
  )

  return (
    <SectionSheet title="Differs from backup" aside={backedUp}>
      <div className="flex flex-col gap-4">
        {errorAlert}
        <p className="text-sm text-text-secondary">
          {fields.length === 1 ? 'One field' : `${fields.length} fields`} in the cluster differ from the backup:
          changed outside the console, or a change that could not be backed up. Choose which version to keep.
          {secret && ' Secret values are never shown.'}
        </p>
        <DataTable head={['Field', 'Backup', 'Cluster now']}>
          {fields.map((f) => (
            <tr key={f.path} className={rowCls}>
              <td className="w-1/4 break-words px-3 py-2 align-top font-mono text-sm text-text" title={f.path}>
                {fieldLabel(f.path)}
              </td>
              <td className="w-[37.5%] px-3 py-2 align-top text-text-secondary">
                <Value value={f.desired} other={f.live} hidden={secret} />
              </td>
              <td className="w-[37.5%] px-3 py-2 align-top text-text">
                <Value value={f.live} other={f.desired} hidden={secret} />
              </td>
            </tr>
          ))}
        </DataTable>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setError(null); setConfirming('revert') }} disabled={isPending}>
            <ArrowCounterClockwiseIcon size={14} className="mr-1.5" /> Restore backup
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setError(null); setConfirming('accept') }} disabled={isPending}>
            <CheckIcon size={14} className="mr-1.5" /> Keep cluster version
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open && !isPending) setConfirming(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming === 'revert' ? 'Restore the backup' : 'Keep the cluster version'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && CONSEQUENCE[confirming][kind]}
              {confirming === 'accept' && ' The current backup is replaced and cannot be restored.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirming) void run(confirming) }} disabled={isPending}>
              {isPending && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
              {confirming === 'revert' ? 'Restore backup' : 'Keep cluster version'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionSheet>
  )
}
