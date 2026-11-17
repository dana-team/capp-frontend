import React from 'react'
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ConfirmDeleteDialogProps {
  /** "Pool" or "Function". */
  kind: string
  /** The dialog is open while a name is set. */
  name: string | null
  note?: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  error: string | null
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  kind, name, note, onClose, onConfirm, isDeleting, error,
}) => (
  <AlertDialog
    open={name !== null}
    onOpenChange={(open) => {
      if (!open && !isDeleting) onClose()
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {kind}</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
          {note && ` ${note}`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            // Keep the dialog open until the request ends, so a refusal is shown in it.
            e.preventDefault()
            onConfirm()
          }}
          className="bg-danger hover:bg-danger/90 text-white"
          disabled={isDeleting}
        >
          {isDeleting && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
