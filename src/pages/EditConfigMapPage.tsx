import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { ConfigMapForm, ConfigMapFormValues } from '@/components/configmaps/ConfigMapForm';
import { useConfigMap, useUpdateConfigmap } from '@/hooks/useConfigmaps';
import { DetailCrumbs } from '@/components/layout/DetailParts';
import { Sheet } from '@/components/layout/Sheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NO_AUTO_REFETCH } from '@/lib/query';
import { useBoundSaveGuard } from '@/hooks/useBoundCapps';
import { ConfirmBoundUpdateDialog } from '@/components/bound/ConfirmBoundUpdateDialog';

export const EditConfigMapPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  const { data: configmap, isLoading, error: loadError } = useConfigMap(namespace, name, NO_AUTO_REFETCH);
  const { mutateAsync: updateConfigmap, isPending, error: updateError } = useUpdateConfigmap();

  const save = async (values: ConfigMapFormValues) => {
    await updateConfigmap({
      namespace,
      name,
      req: {
        data: Object.fromEntries(values.data.map(({ key, value }) => [key, value])),
      },
    });
    navigate(`/configmaps/${namespace}/${name}`);
  };

  const guard = useBoundSaveGuard<ConfigMapFormValues>('configmap', namespace, name, save);

  if (isLoading) {
    return (
      <Sheet className="flex items-center justify-center py-16">
        <CircleNotch className="animate-spin h-8 w-8 text-text-muted" />
      </Sheet>
    );
  }

  if (loadError) {
    return (
      <Sheet className="p-5">
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{(loadError as Error).message}</AlertDescription>
        </Alert>
      </Sheet>
    );
  }

  const initialValues: ConfigMapFormValues = {
    name,
    data: Object.entries(configmap?.data ?? {}).map(([key, value]) => ({ key, value })),
  };

  return (
    <div>
      <DetailCrumbs to={`/configmaps/${namespace}/${name}`} parent={name} name="Edit" />
      <PageHeader
        title={`Edit ${name}`}
        description={
          <>
            Namespace <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />

      <ConfigMapForm
        initialValues={initialValues}
        onSubmit={guard.handleSubmit}
        isLoading={isPending || guard.isChecking}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/configmaps/${namespace}/${name}`)}
      />

      <ConfirmBoundUpdateDialog
        kind="configmap"
        namespace={namespace}
        name={name}
        open={guard.check !== null}
        bound={guard.check?.bound}
        error={guard.check?.error}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
        isSaving={isPending}
      />
    </div>
  );
};
