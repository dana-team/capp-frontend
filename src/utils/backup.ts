import type { Drift, DriftState } from '@/types/drift'

export type BackupState = DriftState | 'off'

interface BackupInfo {
  label: string
  /** Shown on hover. */
  hint: string
  variant: 'secondary' | 'success' | 'warning'
}

/** What a page says about an object's backup. `missing` is never the state of an object that can be shown. */
export const BACKUP_INFO: Record<BackupState, BackupInfo> = {
  off: { label: 'No backup', hint: 'Backups are not turned on in this backend.', variant: 'secondary' },
  inSync: { label: 'Backed up', hint: 'The backup matches the cluster.', variant: 'success' },
  changed: {
    label: 'Differs from backup',
    hint: 'This was changed outside the console, or a change could not be backed up.',
    variant: 'warning',
  },
  unmanaged: { label: 'Not backed up', hint: 'There is no backup of this yet. Saving it creates one.', variant: 'warning' },
  missing: { label: 'Deleted from cluster', hint: 'Only the backup is left.', variant: 'warning' },
  unavailable: {
    label: 'Backup unavailable',
    hint: 'The backup store cannot be reached. Changes still work, but are not backed up.',
    variant: 'warning',
  },
}

/** The backend leaves `drift` out when backups are turned off. */
export const backupState = (drift: Drift | undefined): BackupState => drift?.state ?? 'off'

/** Where a field of the compared state lives, from the most specific prefix down. */
const FIELD_PREFIXES: Array<{ prefix: string; label: string; key?: boolean }> = [
  { prefix: '/spec/configurationSpec/template/spec/containers/0/', label: 'container' },
  { prefix: '/spec/configurationSpec/template/spec/', label: 'pod' },
  { prefix: '/spec/', label: '' },
  // Label, annotation and data keys may contain a slash, so they are one segment.
  { prefix: '/metadata/labels/', label: 'label', key: true },
  { prefix: '/metadata/annotations/', label: 'annotation', key: true },
  { prefix: '/data/', label: 'data', key: true },
];

const unescapePointer = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

/** A drift path (a JSON pointer) as people read it, e.g. "container › image". */
export function fieldLabel(path: string): string {
  const match = FIELD_PREFIXES.find(({ prefix }) => path.startsWith(prefix));
  const rest = match ? path.slice(match.prefix.length) : path.slice(1);
  const parts = match?.key ? [unescapePointer(rest)] : rest.split('/').map(unescapePointer);
  return [...(match?.label ? [match.label] : []), ...parts].join(' › ');
}
