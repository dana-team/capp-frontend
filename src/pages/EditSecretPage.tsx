import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { SecretForm, SecretFormValues, emptyRegistry, toSecretData } from '@/components/secrets/SecretForm';
import { DOCKER_CONFIG_JSON_KEY, DOCKER_CONFIG_JSON_TYPE, parseDockerConfigJson } from '@/utils/dockerConfig';
import { useSecret, useUpdateSecret } from '@/hooks/useSecrets';
import { DetailCrumbs } from '@/components/layout/DetailParts';
import { Sheet } from '@/components/layout/Sheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EditSecretPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  const { data: secret, isLoading, error: loadError } = useSecret(namespace, name);
  const { mutateAsync: updateSecret, isPending, error: updateError } = useUpdateSecret();

  const handleSubmit = async (values: SecretFormValues) => {
    await updateSecret({
      namespace,
      name,
      req: {
        data: toSecretData(values),
      },
    });
    navigate(`/secrets/${namespace}/${name}`);
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

  const isImagePull = secret?.type === DOCKER_CONFIG_JSON_TYPE;
  // Single-registry pull secrets get structured fields; anything else falls
  // back to raw key/value editing so no data is lost.
  const registry = isImagePull ? parseDockerConfigJson(secret?.data?.[DOCKER_CONFIG_JSON_KEY]) : null;
  const initialValues: SecretFormValues = {
    name,
    kind: registry ? 'imagePull' : 'generic',
    data: Object.entries(secret?.data ?? {}).map(([key, value]) => ({ key, value })),
    registry: registry ? { ...registry, email: registry.email ?? '' } : emptyRegistry,
  };

  return (
    <div>
      <DetailCrumbs to={`/secrets/${namespace}/${name}`} parent={name} name="Edit" />
      <PageHeader
        title={`Edit ${name}`}
        description={
          <>
            Namespace <span className="font-medium text-primary">{namespace}</span>
            {isImagePull && <> · Image pull secret{!registry && ' (raw data)'}</>}
          </>
        }
        className="mb-5"
      />

      <SecretForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/secrets/${namespace}/${name}`)}
      />
    </div>
  );
};
