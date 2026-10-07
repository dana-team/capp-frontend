import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CaretRightIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { CappForm, CappFormValues } from '@/components/capps/CappForm';
import { useCapp, useUpdateCapp } from '@/hooks/useCapps';
import { useNamespaces } from '@/hooks/useNamespaces';
import { buildCappRequest, cappToFormValues } from '@/utils/cappBuilder';
import { Sheet } from '@/components/layout/Sheet';
import { DetailHeader } from '@/components/layout/DetailParts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { hasBackupLabel, WarningNavState } from '@/types/capp';

export const EditCappPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  const { data: capp, isLoading, error: loadError } = useCapp(namespace, name);
  const { mutateAsync: updateCapp, isPending, error: updateError } = useUpdateCapp();
  const { data: namespacesData } = useNamespaces();
  const nsQuota = namespacesData?.items?.find((ns) => ns.name === namespace)?.quota;

  const handleSubmit = async (values: CappFormValues) => {
    if (!capp) return;
    const req = buildCappRequest(namespace, values);
    // The save succeeded; warnings mean the Git backup is stale, which the
    // detail page reports once we land there.
    const updated = await updateCapp({ namespace, name, req });
    navigate(`/capps/${namespace}/${name}`, {
      state: updated?.warnings?.length
        ? ({ warnings: updated.warnings } satisfies WarningNavState)
        : undefined,
    });
  };

  if (isLoading) {
    return (
      <Sheet className="flex items-center justify-center py-16">
        <CircleNotchIcon className="animate-spin h-8 w-8 text-text-muted" />
      </Sheet>
    );
  }

  if (loadError) {
    return (
      <Sheet className="p-5">
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(loadError as Error).message}</AlertDescription>
        </Alert>
      </Sheet>
    );
  }

  const initialValues = capp ? cappToFormValues(capp) : undefined;

  return (
    <div>
      <nav className="mb-4 inline-flex max-w-full items-center gap-1 rounded-full bg-background/70 px-3 py-1 text-sm backdrop-blur-md">
        <Link to="/capps" className="text-text-secondary transition-colors hover:text-text">
          Capps
        </Link>
        <CaretRightIcon size={13} className="shrink-0 text-text-muted" />
        <Link
          to={`/capps/${namespace}/${name}`}
          className="truncate text-text-secondary transition-colors hover:text-text"
        >
          {name}
        </Link>
        <CaretRightIcon size={13} className="shrink-0 text-text-muted" />
        <span className="text-text">Edit</span>
      </nav>

      <CappForm
        header={(toggle) => (
          <DetailHeader
            title={`Edit ${name}`}
            meta={
              <>
                <span>
                  Namespace <span className="font-mono text-primary">{namespace}</span>
                </span>
                {hasBackupLabel(capp?.labels) && <span>Changes will be committed to Git.</span>}
              </>
            }
            actions={toggle}
          />
        )}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        error={updateError ? (updateError as Error).message : undefined}
        submitLabel="Save Changes"
        isEdit
        namespace={namespace}
        onCancel={() => navigate(`/capps/${namespace}/${name}`)}
        quota={nsQuota}
      />
    </div>
  );
};
