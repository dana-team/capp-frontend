import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CaretRight, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { CappDetail } from '@/components/capps/CappDetail'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCapp, useDeleteCapp, useSyncCappToGit } from '@/hooks/useCapps'
import { SyncToGitResponse } from '@/types/capp'

export const CappDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()

  const { data: capp, isLoading, error } = useCapp(namespace, name)
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp()
  const { mutateAsync: syncToGit, isPending: isSyncing } = useSyncCappToGit()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncToGitResponse | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deleteCapp({ namespace, name })
      navigate('/capps')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Capp')
    }
  }

  const handleSync = async () => {
    setSyncResult(null)
    setSyncError(null)
    try {
      const result = await syncToGit({ namespace, name })
      setSyncResult(result)
    } catch (e) {
      setSyncError((e as Error).message ?? 'Failed to sync to Git')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/capps" className="text-text-muted hover:text-text transition-colors">
          Capps
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <span className="text-text">{name}</span>
      </nav>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <CircleNotch className="animate-spin h-8 w-8 text-text-muted" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Capp'}</AlertDescription>
        </Alert>
      )}

      {capp && (
        <div>
          <CappDetail
            capp={capp}
            onDelete={() => setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
            onSync={handleSync}
            isSyncing={isSyncing}
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
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <Alert variant="destructive">
                  <WarningCircle className="h-4 w-4" />
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
                  {isDeleting && <CircleNotch className="h-4 w-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
