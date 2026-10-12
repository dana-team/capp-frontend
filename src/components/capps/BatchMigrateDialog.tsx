import React, { useState, useMemo } from 'react';
import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { useClusters } from '@/hooks/useClusters';
import { useNamespacesForCluster } from '@/hooks/useNamespaces';
import { useAuthStore } from '@/store/auth';
import { migrateCapp } from '@/api/capps';
import { BackendApiError } from '@/api/client';
import { getBackendUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import type { CappResponse } from '@/types/capp';

interface BatchResult {
  name: string;
  migrated: boolean;
  sourceDeleted: boolean;
  error?: string;
}

interface BatchMigrateState {
  results: BatchResult[];
  failedCount: number;
  copiedSecrets: string[];
  copiedConfigMaps: string[];
  targetCluster: string;
  targetNamespace: string;
}

interface BatchMigrateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Capp names selected for migration. */
  selectedNames: string[];
  /** Total Capps in the namespace (for "migrate all" detection). */
  totalCapps: number;
  /** Source namespace (from context). */
  namespace: string;
  /** Full Capp list — used to look up hostnames for the hostname map section. */
  capps: CappResponse[];
  /** Called after dialog closes to clear selection when sources were deleted. */
  onMigrated?: () => void;
}

export const BatchMigrateDialog: React.FC<BatchMigrateDialogProps> = ({
  open, onOpenChange, selectedNames, totalCapps, namespace, capps, onMigrated,
}) => {
  const currentCluster = useAuthStore((s) => s.cluster);
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [view, setView] = useState<'form' | 'results'>('form');
  const [result, setResult] = useState<BatchMigrateState | null>(null);

  const [targetCluster, setTargetCluster] = useState('');
  const [targetNamespace, setTargetNamespace] = useState('');
  const [deleteSource, setDeleteSource] = useState(false);
  const [submittedDeleteSource, setSubmittedDeleteSource] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [hostnameMap, setHostnameMap] = useState<Record<string, string>>({});

  const { data: clusters } = useClusters();
  const { data: namespaces, isLoading: namespacesLoading } = useNamespacesForCluster(targetCluster);

  const healthyClusters = clusters?.filter((c) => c.healthy) ?? [];

  const filteredNamespaces = (namespaces ?? []).filter(
    (ns) => !(targetCluster === currentCluster && ns.name === namespace),
  );

  const cappsWithHostname = useMemo(() =>
    capps.filter((c) => selectedNames.includes(c.name) && c.routeSpec?.hostname),
  [capps, selectedNames]);

  const hostnameErrors: Record<string, string | undefined> = {};
  for (const capp of cappsWithHostname) {
    const val = (hostnameMap[capp.name] ?? '').trim();
    if (!deleteSource && val && val === capp.routeSpec!.hostname) {
      hostnameErrors[capp.name] = 'Must differ from the current hostname';
    }
  }

  const hostnameReady = cappsWithHostname.every((capp) => {
    const val = (hostnameMap[capp.name] ?? '').trim();
    if (!deleteSource && !val) return false;
    if (hostnameErrors[capp.name]) return false;
    return true;
  });

  const canSubmit =
    targetCluster !== '' &&
    targetNamespace !== '' &&
    hostnameReady &&
    !isSubmitting;

  const reset = () => {
    setView('form');
    setResult(null);
    setIsSubmitting(false);
    setTargetCluster('');
    setTargetNamespace('');
    setDeleteSource(false);
    setSubmittedDeleteSource(false);
    setSubmittedCount(0);
    setHostnameMap({});
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      if (result && submittedDeleteSource && result.results.some((r) => r.sourceDeleted)) {
        onMigrated?.();
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
    setSubmittedCount(selectedNames.length);
    setIsSubmitting(true);

    const results: BatchResult[] = [];
    let failedCount = 0;
    const copiedSecrets = new Set<string>();
    const copiedConfigMaps = new Set<string>();

    for (const name of selectedNames) {
      const hostname = (hostnameMap[name] ?? '').trim();
      try {
        const res = await migrateCapp(namespace, name, {
          targetCluster,
          targetNamespace,
          deleteSource,
          ...(hostname ? { targetHostname: hostname } : {}),
        });
        results.push({ name, migrated: true, sourceDeleted: res.sourceDeleted });
        res.copiedSecrets?.forEach((s) => copiedSecrets.add(s));
        res.copiedConfigMaps?.forEach((m) => copiedConfigMaps.add(m));
      } catch (e) {
        results.push({
          name,
          migrated: false,
          sourceDeleted: false,
          error: e instanceof BackendApiError ? e.message : 'Migration failed',
        });
        failedCount++;
      }
    }

    const backendUrl = getBackendUrl();
    queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, currentCluster] });
    queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, currentCluster, namespace] });
    queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, targetCluster] });
    queryClient.invalidateQueries({ queryKey: ['capps', backendUrl, targetCluster, targetNamespace] });

    setIsSubmitting(false);

    setResult({
      results,
      failedCount,
      copiedSecrets: [...copiedSecrets],
      copiedConfigMaps: [...copiedConfigMaps],
      targetCluster,
      targetNamespace,
    });
    setView('results');
  };

  const displayCount = view === 'form' && !isSubmitting ? selectedNames.length : submittedCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto rounded-[10px] shadow-[0_24px_70px_-20px_hsl(var(--text)/0.5)] sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b border-border-subtle pb-4 pr-6">
          <DialogTitle>Batch Migrate</DialogTitle>
          {view === 'form' && (
            <DialogDescription>
              Migrate {displayCount} {displayCount === 1 ? 'Capp' : 'Capps'} from{' '}
              <span className="font-mono font-medium text-text">{namespace}</span> to another cluster or namespace.
            </DialogDescription>
          )}
        </DialogHeader>

        {view === 'results' && result ? (
          <div className="flex flex-col gap-4">
            {result.failedCount === 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                Migrated {result.results.length} Capps to cluster{' '}
                <span className="font-mono font-medium">{result.targetCluster}</span> namespace{' '}
                <span className="font-mono font-medium">{result.targetNamespace}</span>.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                {result.results.length - result.failedCount}/{result.results.length} Capps migrated to cluster{' '}
                <span className="font-mono font-medium">{result.targetCluster}</span> namespace{' '}
                <span className="font-mono font-medium">{result.targetNamespace}</span>.
                {' '}{result.failedCount} failed.
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  {submittedDeleteSource && <TableHead>Source Deleted</TableHead>}
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-mono">{r.name}</TableCell>
                    <TableCell>
                      {r.migrated
                        ? <CheckIcon size={14} className="text-success" />
                        : <XIcon size={14} className="text-danger" />}
                    </TableCell>
                    {submittedDeleteSource && (
                      <TableCell>
                        {r.sourceDeleted
                          ? <CheckIcon size={14} className="text-success" />
                          : <span className="text-text-muted">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-danger">{r.error ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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

            {cappsWithHostname.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-text-secondary">Target Hostnames</p>
                {cappsWithHostname.map((capp) => (
                  <Input
                    key={capp.name}
                    label={capp.name}
                    required={!deleteSource}
                    placeholder="e.g. new-app.example.com"
                    hint={`Current: ${capp.routeSpec!.hostname}`}
                    error={hostnameErrors[capp.name]}
                    value={hostnameMap[capp.name] ?? ''}
                    onChange={(e) =>
                      setHostnameMap((prev) => ({ ...prev, [capp.name]: e.target.value }))
                    }
                  />
                ))}
              </div>
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

            {selectedNames.length === totalCapps && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                This will migrate all {totalCapps} Capps in namespace{' '}
                <span className="font-mono font-medium">{namespace}</span>.
              </div>
            )}

            {!canSubmit && targetCluster && targetNamespace && !hostnameReady && (
              <p className="text-xs text-text-muted">
                Fill in all required target hostnames to continue.
              </p>
            )}

            <DialogFooter className="gap-2 border-t border-border-subtle pt-4 sm:space-x-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
                Migrate
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
