import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleNotchIcon } from '@phosphor-icons/react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { useClusters } from '@/hooks/useClusters';
import { useNamespacesForCluster } from '@/hooks/useNamespaces';
import { useMigrateCapp } from '@/hooks/useCapps';
import { useAuthStore } from '@/store/auth';
import { BackendApiError } from '@/api/client';
import { cn } from '@/lib/utils';
import type { MigrateResponse } from '@/types/capp';

interface MigrateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cappName: string;
  cappNamespace: string;
  sourceHostname?: string;
}

export const MigrateDialog: React.FC<MigrateDialogProps> = ({
  open, onOpenChange, cappName, cappNamespace, sourceHostname,
}) => {
  const navigate = useNavigate();
  const currentCluster = useAuthStore((s) => s.cluster);
  const { mutateAsync, isPending } = useMigrateCapp();

  const [targetCluster, setTargetCluster] = useState('');
  const [targetNamespace, setTargetNamespace] = useState('');
  const [targetHostname, setTargetHostname] = useState('');
  const [deleteSource, setDeleteSource] = useState(false);
  const [submittedDeleteSource, setSubmittedDeleteSource] = useState(false);
  const [result, setResult] = useState<MigrateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: clusters } = useClusters();
  const { data: namespaces, isLoading: namespacesLoading } = useNamespacesForCluster(targetCluster);

  const healthyClusters = clusters?.filter((c) => c.healthy) ?? [];

  const filteredNamespaces = (namespaces ?? []).filter(
    (ns) => !(targetCluster === currentCluster && ns.name === cappNamespace),
  );

  const reset = () => {
    setTargetCluster('');
    setTargetNamespace('');
    setTargetHostname('');
    setDeleteSource(false);
    setSubmittedDeleteSource(false);
    setResult(null);
    setError(null);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      if (result?.sourceDeleted) {
        reset();
        onOpenChange(false);
        navigate('/capps');
        return;
      }
      reset();
    }
    onOpenChange(value);
  };

  const handleClusterChange = (value: string) => {
    setTargetCluster(value);
    setTargetNamespace('');
  };

  const handleSubmit = async () => {
    setSubmittedDeleteSource(deleteSource);
    try {
      const res = await mutateAsync({
        namespace: cappNamespace,
        name: cappName,
        req: {
          targetCluster,
          targetNamespace,
          deleteSource,
          ...(targetHostname ? { targetHostname } : {}),
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof BackendApiError ? e.message : 'Migration failed');
    }
  };

  const handleRetry = () => {
    setError(null);
    handleSubmit();
  };

  const hostnameRequired = Boolean(sourceHostname) && !deleteSource;
  const hostnameError = sourceHostname && !deleteSource && targetHostname === sourceHostname
    ? 'Must differ from the current hostname'
    : undefined;
  const canSubmit =
    targetCluster !== '' &&
    targetNamespace !== '' &&
    (!hostnameRequired || targetHostname !== '') &&
    !hostnameError;
  const isPartialFailure = result !== null && submittedDeleteSource && !result.sourceDeleted;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-5 rounded-[10px] shadow-[0_24px_70px_-20px_hsl(var(--text)/0.5)] sm:max-w-md">
        <DialogHeader className="gap-1.5 border-b border-border-subtle pb-4 pr-6">
          <DialogTitle>Migrate Capp</DialogTitle>
          <DialogDescription>
            Migrate <span className="font-mono font-medium text-text">{cappName}</span> to a different cluster or namespace.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            {isPartialFailure ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Capp migrated to <span className="font-mono font-medium">{result.targetCluster}/{result.targetNamespace}</span>,
                but the source could not be deleted.
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                Capp migrated to <span className="font-mono font-medium">{result.targetCluster}/{result.targetNamespace}</span>.
              </div>
            )}

            {result.copiedSecrets && result.copiedSecrets.length > 0 && (
              <div className="text-sm">
                <span className="text-text-secondary">Copied Secrets:</span>{' '}
                <span className="font-mono text-text">{result.copiedSecrets.join(', ')}</span>
              </div>
            )}
            {result.copiedConfigMaps && result.copiedConfigMaps.length > 0 && (
              <div className="text-sm">
                <span className="text-text-secondary">Copied ConfigMaps:</span>{' '}
                <span className="font-mono text-text">{result.copiedConfigMaps.join(', ')}</span>
              </div>
            )}

            <DialogFooter className="gap-2 border-t border-border-subtle pt-4 sm:space-x-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : error ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
            <DialogFooter className="gap-2 border-t border-border-subtle pt-4 sm:space-x-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button onClick={handleRetry} disabled={isPending}>
                {isPending && <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />}
                Retry
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SimpleSelect
              label="Target Cluster"
              required
              placeholder="Select a cluster"
              options={healthyClusters.map((c) => ({ value: c.name, label: c.displayName }))}
              value={targetCluster}
              onChange={handleClusterChange}
            />

            <SimpleSelect
              label="Target Namespace"
              required
              placeholder={
                !targetCluster
                  ? 'Select a cluster first'
                  : namespacesLoading
                    ? 'Loading namespaces…'
                    : filteredNamespaces.length === 0
                      ? 'No accessible namespaces found'
                      : 'Select a namespace'
              }
              options={filteredNamespaces.map((ns) => ({ value: ns.name, label: ns.name }))}
              value={targetNamespace}
              onChange={setTargetNamespace}
              disabled={!targetCluster || namespacesLoading || filteredNamespaces.length === 0}
            />

            {sourceHostname && (
              <Input
                label="Target Hostname"
                required={hostnameRequired}
                placeholder="e.g. new-app.example.com"
                hint={`Current: ${sourceHostname}`}
                error={hostnameError}
                value={targetHostname}
                onChange={(e) => setTargetHostname(e.target.value)}
              />
            )}

            <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background/40 px-3.5 py-3">
              <button
                type="button"
                role="switch"
                aria-checked={deleteSource}
                onClick={() => setDeleteSource(!deleteSource)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  deleteSource ? 'bg-primary' : 'bg-border',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    deleteSource ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
              <label className="font-sans text-sm text-text-secondary">
                Delete source after migration
              </label>
            </div>

            <DialogFooter className="gap-2 border-t border-border-subtle pt-4 sm:space-x-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
                {isPending && <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />}
                Migrate
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
