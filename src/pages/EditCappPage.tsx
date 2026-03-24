import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { CappForm, CappFormValues } from '@/components/capps/CappForm';
import { useCapp, useUpdateCapp } from '@/hooks/useCapps';
import { buildCappRequest, cappToFormValues } from '@/utils/cappBuilder';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EditCappPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  const { data: capp, isLoading, error: loadError } = useCapp(namespace, name);
  const { mutateAsync: updateCapp, isPending, error: updateError } = useUpdateCapp();

  const handleSubmit = async (values: CappFormValues) => {
    if (!capp) return;
    const req = buildCappRequest(namespace, values);
    await updateCapp({ namespace, name, req });
    navigate(`/capps/${namespace}/${name}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin h-8 w-8 text-text-muted" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{(loadError as Error).message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const initialValues = capp ? cappToFormValues(capp) : undefined;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/capps" className="text-text-muted hover:text-text transition-colors">
          Capps
        </Link>
        <ChevronRight size={14} className="text-text-muted" />
        <Link
          to={`/capps/${namespace}/${name}`}
          className="text-text-muted hover:text-text transition-colors"
        >
          {name}
        </Link>
        <ChevronRight size={14} className="text-text-muted" />
        <span className="text-text">Edit</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Edit {name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Namespace: <span className="text-primary font-medium">{namespace}</span>
        </p>
      </div>

      <CappForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/capps/${namespace}/${name}`)}
      />
    </div>
  );
};
