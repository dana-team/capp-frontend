import React, { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { CappDetail } from '@/components/capps/CappDetail'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { WarningBanner } from '@/components/capps/WarningBanner'
import { CappMessageBanner } from '@/components/capps/CappMessageBanner'
import { useCapp, useDeleteCapp } from '@/hooks/useCapps'
import { WarningNavState } from '@/types/capp'
import { MigrateDialog } from '@/components/capps/MigrateDialog'
import { BackedUpNotFound } from '@/components/backup/Deleted'
import { notFoundDrift } from '@/utils/backup'

export const CappDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  // Warnings handed over by EditCappPage after a save whose backup failed.
  const carriedWarnings = (useLocation().state as WarningNavState | null)?.warnings

  const { data: capp, isLoading, error } = useCapp(namespace, name)
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp()
  const backedUp = notFoundDrift(error)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      // The Capp is gone either way; a 200 body means its backup is now stale,
      // so carry that over to the list page rather than dropping it.
      const result = await deleteCapp({ namespace, name })
      navigate('/capps', {
        state: result?.warnings?.length ? ({ warnings: result.warnings } satisfies WarningNavState) : undefined,
      })
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Capp')
    }
  }

  return (
    <div>
      <DetailCrumbs to="/capps" parent="Capps" name={name} />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotchIcon className="animate-spin h-8 w-8 text-text-muted" />
        </Sheet>
      )}

      {backedUp && <BackedUpNotFound kind="capps" namespace={namespace} name={name} drift={backedUp} />}

      {error && !backedUp && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Capp'}</AlertDescription>
        </Alert>
      )}

      {capp && (
        <div className="flex flex-col gap-6">
          <CappMessageBanner annotations={capp.annotations} />
          <WarningBanner warnings={carriedWarnings} />

          <CappDetail
            capp={capp}
            onDelete={() => setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
            onMigrate={() => setShowMigrate(true)}
          />

          <AlertDialog
            open={showDeleteConfirm}
            onOpenChange={(open) => {
              if (!open && isDeleting) return
              if (!open) setShowDeleteConfirm(false)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Capp</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <Alert variant="destructive">
                  <WarningCircleIcon className="h-4 w-4" />
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete()}
                  className="bg-danger hover:bg-danger/90 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <MigrateDialog
            open={showMigrate}
            onOpenChange={setShowMigrate}
            cappName={name}
            cappNamespace={namespace}
            sourceHostname={capp?.routeSpec?.hostname}
          />
        </div>
      )}
    </div>
  )
}
