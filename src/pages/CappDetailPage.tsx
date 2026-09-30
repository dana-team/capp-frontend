import React, { useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { CaretRightIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { CappDetail } from '@/components/capps/CappDetail'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WarningBanner } from '@/components/capps/WarningBanner'
import { useCapp, useDeleteCapp, useDisableCappGitSync, useSyncCappToGit } from '@/hooks/useCapps'
import { hasBackupLabel, SyncToGitResponse, WarningNavState } from '@/types/capp'

export const CappDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  // Warnings handed over by EditCappPage after a save whose backup failed.
  const carriedWarnings = (useLocation().state as WarningNavState | null)?.warnings

  const { data: capp, isLoading, error } = useCapp(namespace, name)
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp()
  const { mutateAsync: syncToGit, isPending: isSyncing } = useSyncCappToGit()
  const { mutateAsync: disableGitSync, isPending: isDisabling } = useDisableCappGitSync()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncToGitResponse | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const isGitSynced = hasBackupLabel(capp?.labels)

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

  const runGitSync = async (action: typeof syncToGit) => {
    setSyncResult(null)
    setSyncError(null)
    try {
      setSyncResult(await action({ namespace, name }))
    } catch (e) {
      setSyncError((e as Error).message ?? 'Git sync failed')
    }
  }

  const handleDisableSync = async () => {
    setShowDisableConfirm(false)
    await runGitSync(disableGitSync)
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/capps" className="text-text-muted hover:text-text transition-colors">
          Capps
        </Link>
        <CaretRightIcon size={14} className="text-text-muted" />
        <span className="text-text">{name}</span>
      </nav>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <CircleNotchIcon className="animate-spin h-8 w-8 text-text-muted" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Capp'}</AlertDescription>
        </Alert>
      )}

      {capp && (
        <div className="flex flex-col gap-6">
          <WarningBanner warnings={carriedWarnings} />

          <CappDetail
            capp={capp}
            onDelete={() => setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
            onSync={() => runGitSync(syncToGit)}
            onDisableSync={() => setShowDisableConfirm(true)}
            isSyncing={isSyncing || isDisabling}
            syncResult={syncResult}
            syncError={syncError}
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
                  {isGitSynced && ' Its values file will also be removed from Git.'}
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

          <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable Git sync</AlertDialogTitle>
                <AlertDialogDescription>
                  Disable Git sync for &quot;{name}&quot;?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDisableSync()}
                  className="bg-danger hover:bg-danger/90 text-white"
                >
                  Disable
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
