import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CaretRight, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { SecretForm, SecretFormValues, emptyRegistry, toSecretData } from '@/components/secrets/SecretForm';
import { DOCKER_CONFIG_JSON_KEY, DOCKER_CONFIG_JSON_TYPE, parseDockerConfigJson } from '@/utils/dockerConfig';
import { useSecret, useUpdateSecret } from '@/hooks/useSecrets';
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
      <div className="flex items-center justify-center py-16">
        <CircleNotch className="animate-spin h-8 w-8 text-text-muted" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{(loadError as Error).message}</AlertDescription>
        </Alert>
      </div>
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
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/secrets" className="text-text-muted hover:text-text transition-colors">
          Secrets
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <Link
          to={`/secrets/${namespace}/${name}`}
          className="text-text-muted hover:text-text transition-colors"
        >
          <span className="truncate max-w-[200px]">{name}</span>
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <span className="text-text">Edit</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Edit {name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Namespace: <span className="text-primary font-medium">{namespace}</span>
          {isImagePull && <> · Image pull secret{!registry && ' (raw data)'}</>}
        </p>
      </div>

      <SecretForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        onCancel={() => navigate(`/secrets/${namespace}/${name}`)}
      />
    </div>
  );
};
