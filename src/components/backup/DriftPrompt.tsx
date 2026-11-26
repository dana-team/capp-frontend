import React from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDriftPrompt } from '@/store/driftPrompt'
import type { DriftField } from '@/types/drift'

const show = (v: unknown) => (v === undefined ? 'not set' : typeof v === 'string' ? v : JSON.stringify(v))

const FieldRow: React.FC<{ field: DriftField }> = ({ field }) => (
  <li className="min-w-0 break-words border-b border-border-subtle px-3 py-2 last:border-b-0">
    <div className="font-mono text-xs text-text">{field.path}</div>
    {/* Secrets carry no values. */}
    {(field.desired !== undefined || field.live !== undefined) && (
      <div className="mt-0.5 text-xs text-text-muted">
        backup: {show(field.desired)} · cluster: {show(field.live)}
      </div>
    )}
  </li>
)

/** Opened by the API client when an update meets an object that was changed outside the console. */
export const DriftPrompt: React.FC = () => {
  const { drift, answer } = useDriftPrompt()
  return (
    <AlertDialog open={drift !== null} onOpenChange={(open) => { if (!open) answer(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Changed outside the console</AlertDialogTitle>
          <AlertDialogDescription>
            This no longer matches its backup. Saving applies your edits on top of what is in the
            cluster now, and backs up the result.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-60 overflow-y-auto rounded-md border border-border-subtle">
          {drift?.fields?.map((f) => <FieldRow key={f.path} field={f} />)}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>Keep changes and save</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
