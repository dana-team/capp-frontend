import React from 'react'
import { useNavigate } from 'react-router-dom'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  FunctionForm, formValuesToFunctionRequest, type FunctionFormValues, type PartialSaveNavState,
} from '@/components/cfunc/FunctionForm'
import { useCreateFunction } from '@/hooks/useCfunc'
import { useNamespaceContext } from '@/context/NamespaceContext'
import { isPartialSave } from '@/utils/cfunc'

export const CreateFunctionPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const namespace = selectedNamespace ?? 'default'
  const { mutateAsync: createFunction, isPending, error } = useCreateFunction()

  const handleSubmit = async (values: FunctionFormValues) => {
    try {
      await createFunction({ namespace, req: formValuesToFunctionRequest(values) })
    } catch (e) {
      const message = (e as Error).message
      if (!isPartialSave(message)) return
      // The function exists now, so a second POST would be a conflict. The edit
      // page finishes it with a PUT of the same values, which the saved part may lack.
      navigate(`/functions/${namespace}/${values.name}/edit`, {
        state: { partialSave: message, values } satisfies PartialSaveNavState,
      })
      return
    }
    navigate(`/functions/${namespace}/${values.name}`)
  }

  return (
    <div>
      <DetailCrumbs to="/functions" parent="Functions" name="Create" />
      <PageHeader
        title="Create Function"
        description={
          <>
            Deploying to namespace <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />
      <FunctionForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Function"
        namespace={namespace}
        onCancel={() => navigate('/functions')}
      />
    </div>
  )
}
