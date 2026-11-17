import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailCrumbs } from '@/components/layout/DetailParts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sheet } from '@/components/layout/Sheet'
import {
  FunctionForm, formValuesToFunctionRequest, functionToFormValues,
  type FunctionFormValues, type PartialSaveNavState,
} from '@/components/cfunc/FunctionForm'
import { useFunction, useUpdateFunction } from '@/hooks/useCfunc'
import { NO_AUTO_REFETCH } from '@/lib/query'

export const EditFunctionPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const carried = useLocation().state as PartialSaveNavState | null
  const { data: fn, isLoading, error: loadError } = useFunction(namespace, name, NO_AUTO_REFETCH)
  const { mutateAsync: updateFunction, isPending, error: updateError } = useUpdateFunction()

  const handleSubmit = async (values: FunctionFormValues) => {
    await updateFunction({ namespace, name, req: { ...formValuesToFunctionRequest(values), name } })
    navigate(`/functions/${namespace}/${name}`)
  }

  if (isLoading) {
    return (
      <Sheet className="flex items-center justify-center py-16">
        <CircleNotchIcon className="h-8 w-8 animate-spin text-text-muted" />
      </Sheet>
    )
  }

  if (loadError || !fn) {
    return (
      <Sheet className="p-5">
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(loadError as Error | null)?.message ?? 'Failed to load Function'}</AlertDescription>
        </Alert>
      </Sheet>
    )
  }

  return (
    <div>
      <DetailCrumbs
        to="/functions" parent="Functions"
        via={{ to: `/functions/${namespace}/${name}`, name }}
        name="Edit"
      />
      <PageHeader
        title={`Edit ${name}`}
        description={
          <>
            Namespace <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />
      <FunctionForm
        initialValues={carried?.values ?? functionToFormValues(fn)}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        notice={carried?.partialSave}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/functions/${namespace}/${name}`)}
      />
    </div>
  )
}
