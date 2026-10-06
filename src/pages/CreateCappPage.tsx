import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CappForm, CappFormValues } from '@/components/capps/CappForm';
import { DetailCrumbs, DetailHeader } from '@/components/layout/DetailParts';
import { useCreateCapp } from '@/hooks/useCapps';
import { useNamespaces } from '@/hooks/useNamespaces';
import { useNamespaceContext } from '@/context/NamespaceContext';
import { buildCappRequest } from '@/utils/cappBuilder';

export const CreateCappPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const namespace = selectedNamespace ?? 'default';
  const { mutateAsync: createCapp, isPending, error } = useCreateCapp();
  const { data: namespacesData } = useNamespaces();
  const nsQuota = namespacesData?.items?.find((ns) => ns.name === namespace)?.quota;

  const handleSubmit = async (values: CappFormValues) => {
    const req = buildCappRequest(namespace, values);
    await createCapp({ namespace, req });
    navigate(`/capps/${namespace}/${values.name}`);
  };

  return (
    <div>
      <DetailCrumbs to="/capps" parent="Capps" name="Create" />
      <CappForm
        header={(toggle) => (
          <DetailHeader
            title="Create Capp"
            meta={
              <span>
                Deploying to namespace{' '}
                <span className="font-mono text-primary">{namespace}</span>
              </span>
            }
            actions={toggle}
          />
        )}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={error ? (error as Error).message : undefined}
        submitLabel="Create Capp"
        namespace={namespace}
        onCancel={() => navigate('/capps')}
        quota={nsQuota}
      />
    </div>
  );
};
