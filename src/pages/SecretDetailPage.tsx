import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { useSecret, useDeleteSecret } from '@/hooks/useSecrets'
import { SecretDetail } from '@/components/secrets/SecretDetail'

export const SecretDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()

  const { data: secret, isLoading, error } = useSecret(namespace, name)
  const { mutateAsync: deleteSecretMut, isPending: isDeleting } = useDeleteSecret()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deleteSecretMut({ namespace, name })
      navigate('/secrets')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Secret')
    }
  }

  return (
    <div>
      <DetailCrumbs to="/secrets" parent="Secrets" name={name} />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotch className="animate-spin h-8 w-8 text-text-muted" />
        </Sheet>
      )}

      {error && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Secret'}</AlertDescription>
        </Alert>
      )}

      {secret && (
        <div>
          <SecretDetail
            secret={secret}
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
                <AlertDialogTitle>Delete Secret</AlertDialogTitle>
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
