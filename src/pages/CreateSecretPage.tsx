import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import { SecretForm, SecretFormValues } from '@/components/secrets/SecretForm';
import { useCreateSecret } from '@/hooks/useSecrets';
import { useNamespaceContext } from '@/context/NamespaceContext';

export const CreateSecretPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const namespace = selectedNamespace ?? 'default';
  const { mutateAsync: createSecret, isPending, error } = useCreateSecret();

  const handleSubmit = async (values: SecretFormValues) => {
    await createSecret({
      namespace,
      req: {
        name: values.name,
        namespace,
        data: Object.fromEntries(values.data.map(({ key, value }) => [key, value])),
      },
    });
    navigate(`/secrets/${namespace}/${values.name}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/secrets" className="text-text-muted hover:text-text transition-colors">
          Secrets
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <span className="text-text">Create</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Create Secret</h1>
        <p className="mt-1 text-sm text-text-muted">
          Deploying to namespace:{' '}
          <span className="text-primary font-medium">{namespace}</span>
        </p>
      </div>

      <SecretForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Secret"
        onCancel={() => navigate('/secrets')}
      />
    </div>
  );
};
