import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CaretRight, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useConfigMap, useDeleteConfigmap } from '@/hooks/useConfigmaps'
import { ConfigMapDetail } from '@/components/configmaps/ConfigmapDetail'

export const ConfigMapDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()

  const { data: configMap, isLoading, error } = useConfigMap(namespace, name)
  const { mutateAsync: deleteConfigMap, isPending: isDeleting } = useDeleteConfigmap()
    
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deleteConfigMap({ namespace, name })
      navigate('/configmaps')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete ConfigMap')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/configmaps" className="text-text-muted hover:text-text transition-colors">
          ConfigMaps
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
          <AlertDescription>{(error as Error).message ?? 'Failed to load ConfigMap'}</AlertDescription>
        </Alert>
      )}

      {configMap && (
        <div>
          <ConfigMapDetail
            configMap={configMap}
            onDelete={() => setShowDeleteConfirm(true)}
            isDeleting={isDeleting}
          />

          <AlertDialog
            open={showDeleteConfirm}
            onOpenChange={(open) => {
              if (open) {
                setShowDeleteConfirm(true)
                setDeleteError(null)
              } else {
                setShowDeleteConfirm(false)
                setDeleteError(null)
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete ConfigMap</AlertDialogTitle>
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
