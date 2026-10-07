import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailCrumbs } from '@/components/layout/DetailParts';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfigMapForm, ConfigMapFormValues } from '@/components/configmaps/ConfigMapForm';
import { useCreateConfigmap } from '@/hooks/useConfigmaps';
import { useNamespaceContext } from '@/context/NamespaceContext';

export const CreateConfigMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const namespace = selectedNamespace ?? 'default';
  const { mutateAsync: createConfigmap, isPending, error } = useCreateConfigmap();

  const handleSubmit = async (values: ConfigMapFormValues) => {
    await createConfigmap({
      namespace,
      req: {
        name: values.name,
        namespace,
        data: Object.fromEntries(values.data.map(({ key, value }) => [key, value])),
      },
    });
    navigate(`/configmaps/${namespace}/${values.name}`);
  };

  return (
    <div>
      <DetailCrumbs to="/configmaps" parent="ConfigMaps" name="Create" />
      <PageHeader
        title="Create ConfigMap"
        description={
          <>
            Deploying to namespace{' '}
            <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />

      <ConfigMapForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create ConfigMap"
        namespace={namespace}
        onCancel={() => navigate('/configmaps')}
      />
    </div>
  );
};
