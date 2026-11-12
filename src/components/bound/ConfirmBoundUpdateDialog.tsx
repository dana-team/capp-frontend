import React from 'react'
import { ArrowsClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BOUND_KIND_LABEL, BoundCappsResponse, BoundResourceKind } from '@/types/bound'
import { BoundCappList } from './BoundCappList'

interface ConfirmBoundUpdateDialogProps {
  kind: BoundResourceKind
  namespace: string
  name: string
  open: boolean
  /** Bound Capps fetched when the user pressed save. */
  bound?: BoundCappsResponse
  /** Set when that fetch failed: what a save rolls out is unknown. */
  error?: Error
  onCancel: () => void
  onConfirm: () => void
  isSaving?: boolean
}

const plural = (n: number) => `${n} Capp${n === 1 ? '' : 's'}`

/** Shown before saving a Secret or ConfigMap: which bound Capps the change rolls out. */
export const ConfirmBoundUpdateDialog: React.FC<ConfirmBoundUpdateDialogProps> = ({
  kind, namespace, name, open, bound, error, onCancel, onConfirm, isSaving,
}) => {
  const label = BOUND_KIND_LABEL[kind]
  const reloading = bound?.toReload.length ?? 0
  const notReloading = (bound?.boundCapps.length ?? 0) - reloading

  const title = error
    ? 'Could not check bound Capps'
    : reloading > 0 ? `Roll out ${plural(reloading)}?` : `Save ${label}`
  const description = error
    ? `Loading which Capps use “${name}” failed. Saving may still roll out every Capp that uses this ${label} and has rollout on change turned on.`
    : reloading > 0
      ? `Saving “${name}” rolls out ${reloading === 1 ? 'this Capp' : 'these Capps'}: each starts a new revision that picks up the new data.`
      : `Saving “${name}” rolls out no Capps.`
  const action = error
    ? 'Save anyway'
    : reloading > 0 ? `Save & roll out ${plural(reloading)}` : 'Save changes'

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !isSaving) onCancel() }}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <WarningCircleIcon className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {bound && bound.boundCapps.length > 0 && (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            <BoundCappList kind={kind} namespace={namespace} bound={bound} newTab />
            {notReloading > 0 && (
              <p className="text-xs text-text-muted">
                {notReloading === 1
                  ? `The Capp marked “No rollout” keeps its running pods: environment variables from this ${label} update only on its next rollout.`
                  : `The ${notReloading} Capps marked “No rollout” keep their running pods: environment variables from this ${label} update only on their next rollout.`}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <Button
            variant={error ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={isSaving}
          >
            {!isSaving && !error && reloading > 0 && <ArrowsClockwiseIcon size={14} />}
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
