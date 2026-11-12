import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { useConfigMap, useDeleteConfigmap } from '@/hooks/useConfigmaps'
import { ConfigMapDetail } from '@/components/configmaps/ConfigmapDetail'
import { BoundCappsSection } from '@/components/bound/BoundCappsSection'
import { DeleteBoundResourceDialog } from '@/components/bound/DeleteBoundResourceDialog'

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
    <div>
      <DetailCrumbs to="/configmaps" parent="ConfigMaps" name={name} />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotch className="animate-spin h-8 w-8 text-text-muted" />
        </Sheet>
      )}

      {error && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load ConfigMap'}</AlertDescription>
        </Alert>
      )}

      {configMap && (
        <div>
          <ConfigMapDetail
            configMap={configMap}
            onDelete={() => {
              setDeleteError(null)
              setShowDeleteConfirm(true)
            }}
            isDeleting={isDeleting}
          />

          <div className="mt-4">
            <BoundCappsSection kind="configmap" namespace={namespace} name={name} />
          </div>

          <DeleteBoundResourceDialog
            kind="configmap"
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
