import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { CappDetail } from '@/components/capps/CappDetail'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BlurFade } from '@/components/ui/blur-fade'
import { useCapp, useDeleteCapp } from '@/hooks/useCapps'

export const CappDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()

  const { data: capp, isLoading, error } = useCapp(namespace, name)
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deleteCapp({ namespace, name })
      navigate('/capps')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Capp')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/capps" className="text-text-muted hover:text-text transition-colors">
          Capps
        </Link>
        <ChevronRight size={14} className="text-text-muted" />
        <span className="text-text">{name}</span>
      </nav>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-text-muted" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Capp'}</AlertDescription>
        </Alert>
      )}

      {capp && (
        <BlurFade>
          <CappDetail
            capp={capp}
            onDelete={() => setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
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
                  <AlertCircle className="h-4 w-4" />
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
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </BlurFade>
      )}
    </div>
  )
}
