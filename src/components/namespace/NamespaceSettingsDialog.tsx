import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrayInput } from '@/components/ui/ArrayInput';
import { NamespaceItem } from '@/api/namespaces';
import { usePatchNamespace, useUpdateNamespace } from '@/hooks/useNamespaces';

interface NamespaceSettingsDialogProps {
  namespace: NamespaceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

export const NamespaceSettingsDialog: React.FC<NamespaceSettingsDialogProps> = ({
  namespace, open, onOpenChange, isAdmin,
}) => {
  const [users, setUsers] = useState<string[]>([]);
  const [cpu, setCpu] = useState('');
  const [memory, setMemory] = useState('');
  const [pods, setPods] = useState('');

  const patchMutation = usePatchNamespace();
  const updateMutation = useUpdateNamespace();

  useEffect(() => {
    if (namespace && open) {
      setUsers(namespace.users ?? []);
      setCpu(namespace.quota?.cpu ?? '');
      setMemory(namespace.quota?.memory ?? '');
      setPods(namespace.quota?.pods != null ? String(namespace.quota.pods) : '');
    }
  }, [namespace, open]);

  const reset = () => {
    patchMutation.reset();
    updateMutation.reset();
  };

  const handleClose = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  if (!namespace) return null;

  const activeMutation = isAdmin ? updateMutation : patchMutation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namespace) return;

    try {
      if (isAdmin) {
        const quota = (cpu || memory || pods)
          ? {
              ...(cpu ? { cpu } : {}),
              ...(memory ? { memory } : {}),
              ...(pods ? { pods: parseInt(pods, 10) } : {}),
            }
          : undefined;

        await updateMutation.mutateAsync({
          name: namespace.name,
          req: {
            ...(users.length > 0 ? { users } : {}),
            ...(quota ? { quota } : {}),
          },
        });
      } else {
        await patchMutation.mutateAsync({
          name: namespace.name,
          req: { users },
        });
      }
      handleClose(false);
    } catch {
      // error state handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-primary">{namespace.name}</span> Settings
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Manage users and resource quotas for this namespace.'
              : 'Manage user access for this namespace.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ArrayInput
            label="Users"
            value={users}
            onChange={setUsers}
            placeholder="username@example.com"
          />

          {isAdmin && (
            <fieldset className="flex flex-col gap-3 rounded border border-border p-3">
              <legend className="px-1.5 text-xs font-medium text-text-secondary">
                Resource Quota
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="CPU"
                  placeholder="e.g. 4"
                  hint="cores"
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                  className="font-mono"
                />
                <Input
                  label="Memory"
                  placeholder="e.g. 8Gi"
                  hint="Mi / Gi"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  className="font-mono"
                />
                <Input
                  label="Pods"
                  placeholder="e.g. 20"
                  type="number"
                  min={0}
                  value={pods}
                  onChange={(e) => setPods(e.target.value)}
                  className="font-mono"
                />
              </div>
            </fieldset>
          )}

          {activeMutation.isError && (
            <p className="text-xs text-danger">
              Failed to update namespace settings. Please try again.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={activeMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
