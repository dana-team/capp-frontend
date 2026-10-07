import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DetailCrumbs } from '@/components/layout/DetailParts';
import { PageHeader } from '@/components/layout/PageHeader';
import { SecretForm, SecretFormValues, emptyRegistry, toSecretData } from '@/components/secrets/SecretForm';
import { DOCKER_CONFIG_JSON_TYPE } from '@/utils/dockerConfig';
import { useCreateSecret } from '@/hooks/useSecrets';
import { useNamespaceContext } from '@/context/NamespaceContext';

export const CreateSecretPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialKind = searchParams.get('type') === 'imagePull' ? 'imagePull' : 'generic';
  const { selectedNamespace } = useNamespaceContext();
  const namespace = selectedNamespace ?? 'default';
  const { mutateAsync: createSecret, isPending, error } = useCreateSecret();

  const handleSubmit = async (values: SecretFormValues) => {
    await createSecret({
      namespace,
      req: {
        name: values.name,
        namespace,
        type: values.kind === 'imagePull' ? DOCKER_CONFIG_JSON_TYPE : 'Opaque',
        data: toSecretData(values),
      },
    });
    navigate(`/secrets/${namespace}/${values.name}`);
  };

  return (
    <div>
      <DetailCrumbs to="/secrets" parent="Secrets" name="Create" />
      <PageHeader
        title="Create Secret"
        description={
          <>
            Deploying to namespace{' '}
            <span className="font-medium text-primary">{namespace}</span>
          </>
        }
        className="mb-5"
      />

      <SecretForm
        initialValues={{ name: '', kind: initialKind, data: [], registry: emptyRegistry }}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Secret"
        namespace={namespace}
        onCancel={() => navigate('/secrets')}
      />
    </div>
  );
};
