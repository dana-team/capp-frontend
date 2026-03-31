import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
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
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/configmaps" className="text-text-muted hover:text-text transition-colors">
          ConfigMaps
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <span className="text-text">Create</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Create ConfigMap</h1>
        <p className="mt-1 text-sm text-text-muted">
          Deploying to namespace:{' '}
          <span className="text-primary font-medium">{namespace}</span>
        </p>
      </div>

      <ConfigMapForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create ConfigMap"
        onCancel={() => navigate('/configmaps')}
      />
    </div>
  );
};
