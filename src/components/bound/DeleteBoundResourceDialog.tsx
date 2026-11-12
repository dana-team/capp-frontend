import React from 'react'
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useBoundCapps } from '@/hooks/useBoundCapps'
import { BOUND_KIND_LABEL, BoundResourceKind } from '@/types/bound'
import { BoundCappList } from './BoundCappList'

interface DeleteBoundResourceDialogProps {
  kind: BoundResourceKind
  namespace: string
  /** The resource to delete; the dialog is open while set. */
  name: string | null
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
  error?: string | null
}

/**
 * Delete confirmation for a Secret or ConfigMap. The backend refuses to delete
 * one that Capps still use, so the dialog lists them and blocks the delete.
 */
export const DeleteBoundResourceDialog: React.FC<DeleteBoundResourceDialogProps> = ({
  kind, namespace, name, onClose, onConfirm, isDeleting, error,
}) => {
  const open = name !== null
  const { data, isPending, error: boundError } = useBoundCapps(kind, namespace, name ?? '', open)
  const label = BOUND_KIND_LABEL[kind]
  const inUse = (data?.boundCapps.length ?? 0) > 0

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !isDeleting) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{inUse ? `${label} in use` : `Delete ${label}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isPending
              ? `Checking which Capps use “${name}”…`
              : inUse
                ? `“${name}” is used by ${data!.boundCapps.length === 1 ? 'this Capp' : `these ${data!.boundCapps.length} Capps`}. Remove it from them before deleting it.`
                : `Are you sure you want to delete “${name}”? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isPending && (
          <div className="flex justify-center py-4">
            <CircleNotchIcon className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        )}

        {data && inUse && (
          <div className="max-h-72 overflow-y-auto">
            <BoundCappList kind={kind} namespace={namespace} bound={data} hideRollout newTab />
          </div>
        )}

        {boundError && (
          <p className="text-xs text-text-muted">
            Could not check which Capps use this {label}: {(boundError as Error).message}
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <WarningCircleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{inUse ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {!inUse && (
            <Button
              variant="destructive"
              onClick={onConfirm}
              loading={isDeleting}
              disabled={isPending}
            >
              Delete
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
