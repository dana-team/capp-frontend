import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleNotchIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { SectionSheet } from '@/components/layout/DetailParts'
import { WarningBanner } from '@/components/capps/WarningBanner'
import { useRemoveRolloutStrategy } from '@/hooks/useCapps'
import { CappResponse, Warning } from '@/types/capp'
import { shortDuration } from '@/utils/rollout'

/** The configured rollout plan. Absent when the Capp has no strategy. */
export const RolloutStrategySection: React.FC<{ capp: CappResponse }> = ({ capp }) => {
  const { mutateAsync, isPending } = useRemoveRolloutStrategy()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Warning[] | undefined>()

  const strategy = capp.routeSpec?.rolloutStrategy
  // Stays until dismissed by navigating away, even once the section below has gone.
  if (!strategy) return warnings?.length ? <WarningBanner warnings={warnings} /> : null

  const remove = async () => {
    setError(null)
    try {
      const updated = await mutateAsync({ namespace: capp.namespace, name: capp.name })
      setWarnings(updated.warnings)
      setConfirming(false)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to remove the strategy')
    }
  }

  return (
    <SectionSheet title="Rollout strategy">
      <div className="flex flex-col gap-3">
        <WarningBanner warnings={warnings} />
        <ol className="flex flex-wrap items-center gap-2">
          {strategy.stages.map((stage, i) => (
            <li key={i} className="rounded-md border border-border-subtle px-3 py-1.5 text-sm tabular-nums text-text">
              {stage.percent}%{stage.duration && <span className="text-text-muted"> · {shortDuration(stage.duration)}</span>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-text-muted">
          Auto-rollback {strategy.autoRollback ? 'on' : 'off'}
          {strategy.progressDeadline && ` · progress deadline ${shortDuration(strategy.progressDeadline)}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/capps/${capp.namespace}/${capp.name}/edit#rollout`}>
            <Button variant="secondary" size="sm">
              <PencilSimpleIcon size={14} className="mr-1.5" /> Edit
            </Button>
          </Link>
          <Button variant="danger" size="sm" onClick={() => { setError(null); setConfirming(true) }}>
            <TrashIcon size={14} className="mr-1.5" /> Remove strategy
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={(open) => { if (!open && !isPending) setConfirming(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove rollout strategy</AlertDialogTitle>
            <AlertDialogDescription>
              This moves live traffic if a rollout is running: a Ready candidate is promoted, otherwise
              traffic is pinned to the stable revision. New revisions then get all traffic right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <WarningCircleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => { e.preventDefault(); void remove() }}
              className="bg-danger hover:bg-danger/90 text-white"
            >
              {isPending && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionSheet>
  )
}
