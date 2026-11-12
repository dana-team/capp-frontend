import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { useSecret, useDeleteSecret } from '@/hooks/useSecrets'
import { SecretDetail } from '@/components/secrets/SecretDetail'
import { BoundCappsSection } from '@/components/bound/BoundCappsSection'
import { DeleteBoundResourceDialog } from '@/components/bound/DeleteBoundResourceDialog'

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
            onDelete={() => {
              setDeleteError(null)
              setShowDeleteConfirm(true)
            }}
            isDeleting={isDeleting}
          />

          <div className="mt-4">
            <BoundCappsSection kind="secret" namespace={namespace} name={name} />
          </div>

          <DeleteBoundResourceDialog
            kind="secret"
            namespace={namespace}
            name={showDeleteConfirm ? name : null}
            onClose={() => {
              setShowDeleteConfirm(false)
              setDeleteError(null)
            }}
            onConfirm={() => handleDelete()}
            isDeleting={isDeleting}
            error={deleteError}
          />
        </div>
      )}
    </div>
  )
}
