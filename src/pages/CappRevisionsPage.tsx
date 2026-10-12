import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DiffEditor } from '@monaco-editor/react'
import {
  ArrowArcLeftIcon, ArrowLeftIcon, CircleNotchIcon, ClockCounterClockwiseIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DetailCrumbs, DetailHeader } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { defineInkThemes } from '@/components/capps/CappYamlEditor'
import { useCapp, useCappRevisions, useRollbackCapp } from '@/hooks/useCapps'
import { useThemeStore } from '@/store/theme'
import { CappRevisionResponse, hasBackupLabel, WarningNavState } from '@/types/capp'
import { changedFields, rollbackResult, templateYaml } from '@/utils/cappRevisions'
import { formatTimestamp, relativeTime } from '@/utils/time'
import { cn } from '@/lib/utils'

type CompareTo = 'current' | 'previous'

export const CappRevisionsPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const dark = useThemeStore((s) => s.dark)

  const { data: capp, isLoading: cappLoading, error: cappError } = useCapp(namespace, name)
  const { data: revisions, isLoading: revsLoading, error: revsError } = useCappRevisions(namespace, name)
  const { mutateAsync: rollback, isPending: isRollingBack } = useRollbackCapp()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rollbackError, setRollbackError] = useState<string | null>(null)

  const cappPath = `/capps/${namespace}/${name}`

  // A revision "matches current" when rolling back to it would change nothing.
  const matchesCurrent = useMemo(() => {
    const set = new Set<number>()
    if (!capp || !revisions) return set
    for (const r of revisions) {
      if (changedFields(rollbackResult(r, capp), capp).length === 0) set.add(r.revisionNumber)
    }
    return set
  }, [capp, revisions])

  // Only the newest revision is "current"; an older one can match it after a rollback.
  const currentRev = revisions?.[0] && matchesCurrent.has(revisions[0].revisionNumber)
    ? revisions[0].revisionNumber
    : undefined

  // Default selection: the newest revision that differs from the live Capp.
  const requested = Number(params.get('rev'))
  const selectedIndex = (() => {
    if (!revisions?.length) return -1
    const i = revisions.findIndex((r) => r.revisionNumber === requested)
    if (i >= 0) return i
    const j = revisions.findIndex((r) => !matchesCurrent.has(r.revisionNumber))
    return j >= 0 ? j : 0
  })()
  const selected = revisions?.[selectedIndex]
  const previous = revisions?.[selectedIndex + 1]
  const compareTo: CompareTo = params.get('compare') === 'previous' && previous ? 'previous' : 'current'

  const select = (rev: number) => {
    const next = new URLSearchParams(params)
    next.set('rev', String(rev))
    setParams(next, { replace: true })
  }
  const setCompare = (c: CompareTo) => {
    const next = new URLSearchParams(params)
    if (c === 'current') next.delete('compare')
    else next.set('compare', c)
    setParams(next, { replace: true })
  }

  // Right side is always the "after" state, so the diff reads as a change.
  const diff = useMemo(() => {
    if (!selected || !capp) return null
    return compareTo === 'previous' && previous
      ? { original: templateYaml(previous), modified: templateYaml(selected), left: `#${previous.revisionNumber}`, right: `#${selected.revisionNumber}` }
      : { original: templateYaml(capp), modified: templateYaml(rollbackResult(selected, capp)), left: 'Current', right: `After rollback to #${selected.revisionNumber}` }
  }, [selected, previous, capp, compareTo])

  const canRollback = selected && !matchesCurrent.has(selected.revisionNumber)

  const handleRollback = async () => {
    if (!selected) return
    setRollbackError(null)
    try {
      const updated = await rollback({ namespace, name, revision: selected.revisionNumber })
      // Warnings mean the Git backup is stale; the detail page reports them.
      navigate(cappPath, {
        state: updated?.warnings?.length ? ({ warnings: updated.warnings } satisfies WarningNavState) : undefined,
      })
    } catch (e) {
      setRollbackError((e as Error).message ?? 'Rollback failed')
    }
  }

  const error = cappError ?? revsError
  const isLoading = cappLoading || revsLoading

  return (
    <div>
      <DetailCrumbs to="/capps" parent="Capps" via={{ to: cappPath, name }} name="Revisions" />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotchIcon className="animate-spin h-8 w-8 text-text-muted" />
        </Sheet>
      )}

      {error && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load revisions'}</AlertDescription>
        </Alert>
      )}

      {capp && revisions && (
        <div className="flex flex-col gap-4">
          <DetailHeader
            title={name}
            meta={
              <>
                <span>Revision history</span>
                <Badge variant="namespace">{namespace}</Badge>
                <span className="tabular-nums text-text-muted">
                  {revisions.length} {revisions.length === 1 ? 'revision' : 'revisions'}
                </span>
              </>
            }
            actions={
              <Link to={cappPath}>
                <Button variant="secondary" size="sm">
                  <ArrowLeftIcon size={14} className="mr-1.5" /> Back to Capp
                </Button>
              </Link>
            }
          />

          {revisions.length === 0 ? (
            <Sheet>
              <EmptyState
                icon={<ClockCounterClockwiseIcon size={28} weight="light" className="text-text-secondary" />}
                title="No revisions yet"
                description="The operator records a revision each time this Capp's spec, labels or annotations change."
              />
            </Sheet>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <RevisionList
                revisions={revisions}
                selected={selected?.revisionNumber}
                current={currentRev}
                onSelect={select}
              />

              {selected && diff && (
                <Sheet as="section" className="flex min-w-0 flex-col overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
                    <div className="flex min-w-0 flex-col">
                      <h2 className="font-display text-lg font-medium tracking-tight text-text">
                        Revision #{selected.revisionNumber}
                      </h2>
                      <span className="text-xs text-text-muted" title={formatTimestamp(selected.createdAt)}>
                        Recorded {relativeTime(selected.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div role="group" aria-label="Compare with" className="inline-flex rounded border border-border p-0.5">
                        {(['current', 'previous'] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCompare(c)}
                            disabled={c === 'previous' && !previous}
                            aria-pressed={compareTo === c}
                            className={cn(
                              'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                              compareTo === c ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text',
                            )}
                          >
                            {c === 'current' ? 'vs current' : 'vs previous'}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!canRollback || isRollingBack}
                        onClick={() => { setRollbackError(null); setConfirmOpen(true) }}
                        title={canRollback ? undefined : 'The Capp already matches this revision'}
                      >
                        <ArrowArcLeftIcon size={14} className="mr-1.5" /> Roll back to #{selected.revisionNumber}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-border-subtle bg-background/40 text-xs font-medium text-text-muted">
                    <span className="truncate px-5 py-1.5">{diff.left}</span>
                    <span className="truncate px-5 py-1.5">{diff.right}</span>
                  </div>
                  {diff.original === diff.modified && (
                    <p className="border-b border-border-subtle px-5 py-2 text-xs text-text-muted">No differences.</p>
                  )}
                  <DiffEditor
                    height="min(70vh, 720px)"
                    language="yaml"
                    original={diff.original}
                    modified={diff.modified}
                    // Disposing models on unmount races the diff widget ("TextModel got
                    // disposed before DiffEditorWidget model got reset"). Keep them, under
                    // fixed paths so each mount reuses the same two models.
                    originalModelPath="inmemory://capp-revisions/original.yaml"
                    modifiedModelPath="inmemory://capp-revisions/modified.yaml"
                    keepCurrentOriginalModel
                    keepCurrentModifiedModel
                    beforeMount={defineInkThemes}
                    theme={dark ? 'ink-night' : 'rice-paper'}
                    options={{
                      readOnly: true,
                      originalEditable: false,
                      renderSideBySide: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      overviewRulerBorder: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'on',
                    }}
                  />
                </Sheet>
              )}
            </div>
          )}

          <AlertDialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (!open && isRollingBack) return
              setConfirmOpen(open)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Roll back to revision #{selected?.revisionNumber}</AlertDialogTitle>
                <AlertDialogDescription>
                  The spec, labels and annotations of &quot;{name}&quot; will be replaced with those
                  recorded in revision #{selected?.revisionNumber}, and the result is recorded as a new
                  revision. Its Git sync setting is kept as it is now
                  {hasBackupLabel(capp.labels) ? ', and the new state is pushed to Git.' : '.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {rollbackError && (
                <Alert variant="destructive">
                  <WarningCircleIcon className="h-4 w-4" />
                  <AlertDescription>{rollbackError}</AlertDescription>
                </Alert>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); void handleRollback() }}
                  disabled={isRollingBack}
                >
                  {isRollingBack && <CircleNotchIcon className="h-4 w-4 animate-spin" />}
                  Roll back
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}

const RevisionList: React.FC<{
  revisions: CappRevisionResponse[]
  selected?: number
  current?: number
  onSelect: (rev: number) => void
}> = ({ revisions, selected, current, onSelect }) => (
  <Sheet as="nav" aria-label="Revisions" className="h-fit overflow-hidden">
    <ol className="flex flex-col">
      {revisions.map((rev, i) => {
        const older = revisions[i + 1]
        const changes = older ? changedFields(older, rev) : null
        const active = rev.revisionNumber === selected
        return (
          <li key={rev.revisionNumber} className="border-b border-border-subtle last:border-0">
            <button
              type="button"
              onClick={() => onSelect(rev.revisionNumber)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors',
                active ? 'border-l-primary bg-surface' : 'border-l-transparent hover:bg-background/40',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium tabular-nums text-text">#{rev.revisionNumber}</span>
                {rev.revisionNumber === current && <Badge variant="success">current</Badge>}
                <span className="ml-auto text-xs text-text-muted" title={formatTimestamp(rev.createdAt)}>
                  {relativeTime(rev.createdAt)}
                </span>
              </span>
              <span className="truncate font-mono text-xs text-text-secondary">
                {changes === null
                  ? rev.revisionNumber === 1 ? 'created' : 'oldest kept'
                  : changes.length ? changes.join(' · ') : 'no changes'}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  </Sheet>
)
