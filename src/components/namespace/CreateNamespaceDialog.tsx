import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrayInput } from '@/components/ui/ArrayInput';
import { useCreateNamespace } from '@/hooks/useNamespaces';

interface CreateNamespaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (name: string) => void;
}

export const CreateNamespaceDialog: React.FC<CreateNamespaceDialogProps> = ({
  open, onOpenChange, onCreated,
}) => {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [cpu, setCpu] = useState('');
  const [memory, setMemory] = useState('');
  const [pods, setPods] = useState('');
  const createMutation = useCreateNamespace();

  const reset = () => {
    setName('');
    setUsers([]);
    setCpu('');
    setMemory('');
    setPods('');
    createMutation.reset();
  };

  const handleClose = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const quota = (cpu || memory || pods)
      ? {
          ...(cpu ? { cpu } : {}),
          ...(memory ? { memory } : {}),
          ...(pods ? { pods: parseInt(pods, 10) } : {}),
        }
      : undefined;

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        ...(users.length > 0 ? { users } : {}),
        ...(quota ? { quota } : {}),
      });
      onCreated?.(name.trim());
      handleClose(false);
    } catch {
      // error state handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Namespace</DialogTitle>
          <DialogDescription>
            Create a new namespace with optional resource quotas and user access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Name"
            required
            placeholder="my-namespace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-mono"
          />

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

          <ArrayInput
            label="Users"
            value={users}
            onChange={setUsers}
            placeholder="username@example.com"
          />

          {createMutation.isError && (
            <p className="text-xs text-danger">
              Failed to create namespace. Please check the name and try again.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
