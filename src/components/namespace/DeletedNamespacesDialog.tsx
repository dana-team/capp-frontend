import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { BackedUp, RESTORES, RestoreActions } from '@/components/backup/Deleted';
import { useResolveNamespaceDrift } from '@/hooks/useDrift';
import type { DriftMissing } from '@/types/drift';

const NamespaceRow: React.FC<{ item: DriftMissing }> = ({ item }) => {
  const { mutateAsync } = useResolveNamespaceDrift();
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm text-text" title={item.name}>{item.name}</div>
        <div className="mt-0.5 truncate text-xs text-text-muted"><BackedUp drift={item.drift} /></div>
      </div>
      <RestoreActions
        restores={RESTORES.namespaces}
        resolve={(action) => mutateAsync({ action, namespace: item.name, drift: item.drift })}
      />
    </li>
  );
};

interface DeletedNamespacesDialogProps {
  /** Recorded namespaces that no longer exist (NamespaceListResponse.missing). */
  missing: DriftMissing[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Lists the namespaces deleted from the cluster outside the console, to restore or forget each. */
export const DeletedNamespacesDialog: React.FC<DeletedNamespacesDialogProps> = ({ missing, open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Deleted namespaces</DialogTitle>
        <DialogDescription>
          These namespaces were deleted from the cluster outside the console. Their backup is kept.
        </DialogDescription>
      </DialogHeader>
      {missing.length > 0 ? (
        <ul className="max-h-[60vh] divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle">
          {missing.map((m) => <NamespaceRow key={m.name} item={m} />)}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">Nothing is left to restore.</p>
      )}
    </DialogContent>
  </Dialog>
);
