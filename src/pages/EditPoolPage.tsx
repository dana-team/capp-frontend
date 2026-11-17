import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sheet } from '@/components/layout/Sheet'
import {
  PoolForm, formValuesToPoolRequest, poolToFormValues, type PoolFormValues,
} from '@/components/cfunc/PoolForm'
import { usePool, useUpdatePool } from '@/hooks/useCfunc'
import { NO_AUTO_REFETCH } from '@/lib/query'

export const EditPoolPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const { data: pool, isLoading, error: loadError } = usePool(namespace, name, NO_AUTO_REFETCH)
  const { mutateAsync: updatePool, isPending, error: updateError } = useUpdatePool()

  const handleSubmit = async (values: PoolFormValues) => {
    await updatePool({ namespace, name, req: { ...formValuesToPoolRequest(values), name } })
    navigate(`/pools/${namespace}/${name}`)
  }

  if (isLoading) {
    return (
      <Sheet className="flex items-center justify-center py-16">
        <CircleNotchIcon className="h-8 w-8 animate-spin text-text-muted" />
      </Sheet>
    )
  }

  if (loadError || !pool) {
    return (
      <Sheet className="p-5">
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(loadError as Error | null)?.message ?? 'Failed to load Pool'}</AlertDescription>
        </Alert>
      </Sheet>
    )
  }

  return (
    <div>
      <DetailCrumbs to="/pools" parent="Pools" via={{ to: `/pools/${namespace}/${name}`, name }} name="Edit" />
      <PageHeader
        title={`Edit ${name}`}
        description={
          <>
            Namespace <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />
      <PoolForm
        initialValues={poolToFormValues(pool)}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/pools/${namespace}/${name}`)}
      />
    </div>
  )
}
