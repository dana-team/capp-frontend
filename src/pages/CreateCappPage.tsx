import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CappForm, CappFormValues } from '@/components/capps/CappForm';
import { useCreateCapp } from '@/hooks/useCapps';
import { useNamespaceContext } from '@/context/NamespaceContext';
import { buildCappRequest } from '@/utils/cappBuilder';

export const CreateCappPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const namespace = selectedNamespace ?? 'default';
  const { mutateAsync: createCapp, isPending, error } = useCreateCapp();

  const handleSubmit = async (values: CappFormValues) => {
    const req = buildCappRequest(namespace, values);
    await createCapp({ namespace, req });
    navigate(`/capps/${namespace}/${values.name}`);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1 text-sm mb-6">
        <Link to="/capps" className="text-text-muted hover:text-text transition-colors">
          Capps
        </Link>
        <ChevronRight size={14} className="text-text-muted" />
        <span className="text-text">Create</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Create Capp</h1>
        <p className="mt-1 text-sm text-text-muted">
          Deploying to namespace:{' '}
          <span className="text-primary font-medium">{namespace}</span>
        </p>
      </div>

      <CappForm
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Capp"
        namespace={namespace}
        onCancel={() => navigate('/capps')}
      />
    </div>
  );
};
