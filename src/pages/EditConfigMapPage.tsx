import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { ConfigMapForm, ConfigMapFormValues } from '@/components/configmaps/ConfigMapForm';
import { useConfigMap, useUpdateConfigmap } from '@/hooks/useConfigmaps';
import { DetailCrumbs } from '@/components/layout/DetailParts';
import { Sheet } from '@/components/layout/Sheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EditConfigMapPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  const { data: configmap, isLoading, error: loadError } = useConfigMap(namespace, name);
  const { mutateAsync: updateConfigmap, isPending, error: updateError } = useUpdateConfigmap();

  const handleSubmit = async (values: ConfigMapFormValues) => {
    await updateConfigmap({
      namespace,
      name,
      req: {
        data: Object.fromEntries(values.data.map(({ key, value }) => [key, value])),
      },
    });
    navigate(`/configmaps/${namespace}/${name}`);
  };

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
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/configmaps/${namespace}/${name}`)}
      />
    </div>
  );
};
