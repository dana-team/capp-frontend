import React from 'react'
import { useNavigate } from 'react-router-dom'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PoolForm, formValuesToPoolRequest, type PoolFormValues } from '@/components/cfunc/PoolForm'
import { useCreatePool } from '@/hooks/useCfunc'
import { useNamespaceContext } from '@/context/NamespaceContext'

export const CreatePoolPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const namespace = selectedNamespace ?? 'default'
  const { mutateAsync: createPool, isPending, error } = useCreatePool()

  const handleSubmit = async (values: PoolFormValues) => {
    await createPool({ namespace, req: formValuesToPoolRequest(values) })
    navigate(`/pools/${namespace}/${values.name}`)
  }

  return (
    <div>
      <DetailCrumbs to="/pools" parent="Pools" name="Create" />
      <PageHeader
        title="Create Pool"
        description={
          <>
            Deploying to namespace <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />
      <PoolForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Pool"
        namespace={namespace}
        onCancel={() => navigate('/pools')}
      />
    </div>
  )
}
