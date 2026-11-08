import React, { useEffect, useState } from 'react'
import { CheckIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRolloutAction } from '@/hooks/useCapps'
import { cn } from '@/lib/utils'
import { CappResponse, RolloutAction, RolloutPhase, RolloutStage, RolloutStatusResponse } from '@/types/capp'
import {
  allowedRolloutActions,
  candidatePercent,
  durationMs,
  formatRemaining,
  pendingRolloutAction,
  shortDuration,
  shouldShowRollout,
} from '@/utils/rollout'

const NEUTRAL = { strip: 'border-border bg-surface', badge: 'default' } as const

const PHASE_TONE: Record<RolloutPhase, { strip: string; badge: 'info' | 'warning' | 'danger' | 'default' }> = {
  Stable: NEUTRAL,
  Progressing: { strip: 'border-primary/40 bg-primary/10', badge: 'info' },
  Promoting: { strip: 'border-primary/40 bg-primary/10', badge: 'info' },
  Holding: { strip: 'border-warning/40 bg-warning/10', badge: 'warning' },
  Failed: { strip: 'border-danger/40 bg-danger/10', badge: 'danger' },
  RolledBack: { strip: 'border-danger/40 bg-danger/10', badge: 'danger' },
  Aborted: NEUTRAL,
}

const ACTION_LABEL: Record<RolloutAction, string> = { promote: 'Promote', abort: 'Abort', retry: 'Retry' }

function confirmText(action: RolloutAction, status: RolloutStatusResponse): string {
  const candidate = status.candidateRevision
  if (action === 'promote') {
    return `Send all traffic to ${candidate}? The operator applies this shortly after, and refuses it if the candidate is not Ready. A refusal is not shown here: the rollout simply stays as it is.`
  }
  if (action === 'abort') {
    return `Stop this rollout and return all traffic to ${status.stableRevision}?`
  }
  return `Run the rollout of ${candidate} again from the first stage?`
}

/** Seconds left at the current stage, or undefined when no timer is running. */
function stageRemaining(status: RolloutStatusResponse, stage: RolloutStage | undefined, now: number): number | undefined {
  if (status.phase !== 'Progressing' || !stage?.duration || !status.stageStartTime) return undefined
  return Date.parse(status.stageStartTime) + durationMs(stage.duration) - now
}

function summary(status: RolloutStatusResponse, stages: RolloutStage[], now: number): React.ReactNode {
  const candidate = status.candidateRevision
  const percent = candidatePercent(status, stages)
  const share = <><b className="font-medium text-text">{percent}%</b> on <span className="font-mono">{candidate}</span></>

  if (status.pinnedRevision) {
    return <>Traffic pinned to <span className="font-mono">{status.pinnedRevision}</span>. The strategy was removed before promotion.</>
  }
  switch (status.phase) {
    case 'Progressing': {
      const remaining = stageRemaining(status, stages[status.stageIndex], now)
      return (
        <>
          {share} · stage {status.stageIndex + 1} of {stages.length}
          {remaining !== undefined && (remaining > 0 ? ` · at least ${formatRemaining(remaining)} left` : ' · moving on shortly')}
        </>
      )
    }
    case 'Holding':
      return status.heldPercent != null
        ? <>{share} · held after a strategy change</>
        : <>{share} · waiting for you</>
    case 'Promoting':
      return <>Moving all traffic to <span className="font-mono">{candidate}</span></>
    case 'Failed':
      return <><span className="font-mono">{candidate}</span> failed · traffic stays at {percent}%</>
    case 'RolledBack':
      return <>All traffic back on <span className="font-mono">{status.stableRevision}</span> · <span className="font-mono">{candidate}</span> failed</>
    case 'Aborted':
      return <>All traffic back on <span className="font-mono">{status.stableRevision}</span> · rollout aborted</>
    default:
      return null
  }
}

const TrafficBar: React.FC<{ status: RolloutStatusResponse }> = ({ status }) => {
  const traffic = status.traffic?.filter((t) => t.percent > 0) ?? []
  if (traffic.length === 0) return null
  return (
    <div>
      <div className="flex h-6 overflow-hidden rounded-md text-xs font-medium">
        {traffic.map((t) => (
          <div
            key={t.revisionName}
            title={`${t.revisionName}: ${t.percent}%`}
            style={{ width: `${t.percent}%` }}
            className={cn(
              'flex items-center justify-center truncate',
              t.tag === 'candidate' ? 'bg-primary text-primary-foreground' : 'bg-border text-text',
            )}
          >
            {t.percent >= 15 && `${t.tag} ${t.percent}%`}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-3 font-mono text-xs text-text-muted">
        <span className="truncate">{status.stableRevision}</span>
        <span className="truncate">{status.candidateRevision}</span>
      </div>
    </div>
  )
}

const StageTrack: React.FC<{ status: RolloutStatusResponse; stages: RolloutStage[] }> = ({ status, stages }) => {
  const promoting = status.phase === 'Promoting'
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
      {stages.map((stage, i) => {
        const done = i < status.stageIndex || promoting
        const current = i === status.stageIndex && !promoting
        return (
          <li
            key={i}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'rounded-md border px-3 py-2',
              done && 'border-success/40 text-success',
              current && 'border-primary bg-primary/10',
              !done && !current && 'border-border-subtle',
            )}
          >
            <span className="block font-display text-base font-medium tabular-nums">{stage.percent}%</span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              {done && <CheckIcon size={12} />}
              {stage.duration ? shortDuration(stage.duration) : 'final'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** The live state of a rollout, above the Capp's key facts. Absent when nothing is rolling out. */
export const RolloutStrip: React.FC<{ capp: CappResponse }> = ({ capp }) => {
  const status = capp.status?.rollout
  const { mutateAsync, isPending } = useRolloutAction()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState<RolloutAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const running = status?.phase === 'Progressing'
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  if (!shouldShowRollout(status)) return null

  const stages = capp.routeSpec?.rolloutStrategy?.stages ?? []
  const pending = pendingRolloutAction(capp)
  const actions = allowedRolloutActions(capp)
  const tone = (status.phase && PHASE_TONE[status.phase]) ?? NEUTRAL

  const confirm = async () => {
    if (!confirming || !status.candidateRevision) return
    setActionError(null)
    try {
      await mutateAsync({
        namespace: capp.namespace,
        name: capp.name,
        req: { action: confirming, revision: status.candidateRevision },
      })
      setConfirming(null)
    } catch (e) {
      setActionError((e as Error).message ?? 'Rollout action failed')
    }
  }

  return (
    <section aria-label="Rollout" className={cn('rounded-[10px] border px-4 py-3', tone.strip)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          {status.phase && <Badge variant={tone.badge}>{status.phase}</Badge>}
          {pending
            ? <span>{pending.action.charAt(0).toUpperCase() + pending.action.slice(1)} requested for <span className="font-mono">{pending.revision}</span>. Waiting for the operator…</span>
            : <span className="min-w-0">{summary(status, stages, now)}</span>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === 'promote' ? 'primary' : action === 'abort' ? 'danger' : 'secondary'}
              onClick={() => { setActionError(null); setConfirming(action) }}
            >
              {ACTION_LABEL[action]}
            </Button>
          ))}
          <Button size="sm" variant="secondary" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide details' : 'Details'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          <TrafficBar status={status} />
          {stages.length > 0 && !status.pinnedRevision && <StageTrack status={status} stages={stages} />}
          {status.message && <p className="text-xs text-text-muted">Operator: {status.message}</p>}
          {status.candidateRevision && status.candidateReadyOnce === false && (
            <p className="text-xs text-text-muted">The candidate has not been Ready yet.</p>
          )}
        </div>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open && !isPending) setConfirming(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && `${ACTION_LABEL[confirming]} rollout`}</AlertDialogTitle>
            <AlertDialogDescription>{confirming && confirmText(confirming, status)}</AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <Alert variant="destructive">
              <WarningCircleIcon className="h-4 w-4" />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => { e.preventDefault(); void confirm() }}
              className={confirming === 'abort' ? 'bg-danger hover:bg-danger/90 text-white' : undefined}
            >
              {isPending && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
              {confirming && ACTION_LABEL[confirming]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
