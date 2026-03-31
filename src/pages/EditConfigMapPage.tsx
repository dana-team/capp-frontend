import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CaretRight, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { ConfigMapForm, ConfigMapFormValues } from '@/components/configmaps/ConfigMapForm';
import { useConfigMap, useUpdateConfigmap } from '@/hooks/useConfigmaps';
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

  const initialValues: ConfigMapFormValues = {
    name,
    data: Object.entries(configmap?.data ?? {}).map(([key, value]) => ({ key, value })),
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/configmaps" className="text-text-muted hover:text-text transition-colors">
          ConfigMaps
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <Link
          to={`/configmaps/${namespace}/${name}`}
          className="text-text-muted hover:text-text transition-colors"
        >
          {name}
        </Link>
        <CaretRight size={14} className="text-text-muted" />
        <span className="text-text">Edit</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Edit {name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Namespace: <span className="text-primary font-medium">{namespace}</span>
        </p>
      </div>

      <ConfigMapForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        onCancel={() => navigate(`/configmaps/${namespace}/${name}`)}
      />
    </div>
  );
};
