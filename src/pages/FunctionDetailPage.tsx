import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowsClockwiseIcon, CircleNotchIcon, GitBranchIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/CopyButton'
import { DataTable, DetailCrumbs, DetailHeader, SectionSheet, rowCls } from '@/components/layout/DetailParts'
import { Sheet } from '@/components/layout/Sheet'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile, toneDot } from '@/components/layout/StatTile'
import { ConditionsSection, TileValue } from '@/components/cfunc/ConditionsSection'
import { ConfirmDeleteDialog } from '@/components/cfunc/ConfirmDeleteDialog'
import { FunctionLogsPanel } from '@/components/cfunc/FunctionLogsPanel'
import { FunctionTestPanel } from '@/components/cfunc/FunctionTestPanel'
import { useDeleteFunction, useFunction, useUpdateFunction } from '@/hooks/useCfunc'
import type { BuildStatus, FunctionResponse } from '@/types/cfunc'
import { TONE_TEXT, functionHealth, isBuilding, toFunctionRequest, triggerTone } from '@/utils/cfunc'
import { formatTimestamp, relativeTime } from '@/utils/time'
import { cn } from '@/lib/utils'

const BUILD_LABEL: Record<BuildStatus, string> = {
  '': 'Not started',
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  none: 'No build',
}

const BUILD_BADGE: Record<BuildStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  '': 'default',
  pending: 'warning',
  running: 'warning',
  succeeded: 'success',
  failed: 'danger',
  none: 'default',
}

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-text-muted">{label}</dt>
    <dd className="mt-0.5 break-all font-mono text-sm text-text">{children}</dd>
  </div>
)

const Triggers: React.FC<{ fn: FunctionResponse }> = ({ fn }) => (
  <SectionSheet title="Triggers" aside={`${fn.triggers.length}`}>
    {fn.triggers.length === 0 ? (
      <p className="text-sm text-text-muted">No trigger calls this Function. Add one in the edit page.</p>
    ) : (
      <DataTable head={['Name', 'Type', 'Target', 'Status']}>
        {fn.triggers.map((t) => {
          const tone = triggerTone(t)
          const target = t.url ?? t.fullPath
          return (
            <tr key={t.name} className={rowCls}>
              <td className="px-3 py-2 align-top font-mono text-sm text-text">{t.name}</td>
              <td className="px-3 py-2 align-top"><Badge variant="info">{t.type}</Badge></td>
              <td className="px-3 py-2 align-top">
                {t.type === 'http' ? (
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {(t.methods?.length ? t.methods : ['GET']).join(' ')}
                    </span>
                    <span className="min-w-0 break-all font-mono text-sm text-text">{target ?? '—'}</span>
                    {target && <CopyButton text={target} />}
                  </div>
                ) : (
                  <span className="font-mono text-sm text-text">{t.schedule}</span>
                )}
              </td>
              <td className="px-3 py-2 align-top">
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', toneDot[tone])} aria-hidden />
                  <span className={TONE_TEXT[tone]}>{t.status || 'Pending'}</span>
                </span>
                {t.message && <p className="mt-0.5 break-words text-xs text-text-muted">{t.message}</p>}
              </td>
            </tr>
          )
        })}
      </DataTable>
    )}
  </SectionSheet>
)

export const FunctionDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const { data: fn, isLoading, error } = useFunction(namespace, name)
  const { mutateAsync: deleteFunction, isPending: isDeleting } = useDeleteFunction()
  const { mutate: redeploy, isPending: isRedeploying, error: redeployError } = useUpdateFunction()
  const [showDelete, setShowDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deleteFunction({ namespace, name })
      navigate('/functions')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Function')
    }
  }

  const health = fn ? functionHealth(fn) : undefined
  const buildStatus = fn?.build?.status ?? ''
  const volumes = fn
    ? [
        ...(fn.secretVolumes ?? []).map((v) => ({ kind: 'Secret', to: `/secrets/${namespace}/${v.secretName}`, name: v.secretName, mountPath: v.mountPath })),
        ...(fn.configMapVolumes ?? []).map((v) => ({ kind: 'ConfigMap', to: `/configmaps/${namespace}/${v.configMapName}`, name: v.configMapName, mountPath: v.mountPath })),
      ]
    : []

  return (
    <div>
      <DetailCrumbs to="/functions" parent="Functions" name={name} />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotchIcon className="h-8 w-8 animate-spin text-text-muted" />
        </Sheet>
      )}

      {error && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Function'}</AlertDescription>
        </Alert>
      )}

      {fn && health && (
        <div className="flex flex-col gap-4">
          <DetailHeader
            title={fn.name}
            badges={
              <Badge variant={BUILD_BADGE[buildStatus]} className="gap-1">
                {isBuilding(fn) && <CircleNotchIcon size={12} className="animate-spin" />}
                Build: {BUILD_LABEL[buildStatus].toLowerCase()}
              </Badge>
            }
            meta={
              <>
                <span className="inline-flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', toneDot[health.tone])} aria-hidden />
                  <span className={cn('font-medium', TONE_TEXT[health.tone])}>{health.label.toLowerCase()}</span>
                </span>
                <Badge variant="namespace">{fn.namespace}</Badge>
                {fn.uid && <span className="font-mono text-xs text-text-muted">{fn.uid}</span>}
              </>
            }
            actions={
              <>
                <Button
                  variant="secondary" size="sm" disabled={isRedeploying}
                  title="Clone the repository again and deploy the code"
                  onClick={() => redeploy({ namespace, name, req: toFunctionRequest(fn) })}
                >
                  {isRedeploying
                    ? <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />
                    : <ArrowsClockwiseIcon size={14} className="mr-1.5" />}
                  {isRedeploying ? 'Redeploying…' : 'Redeploy'}
                </Button>
                <Link to={`/functions/${namespace}/${name}/edit`}>
                  <Button variant="secondary" size="sm">
                    <PencilSimpleIcon size={14} className="mr-1.5" /> Edit
                  </Button>
                </Link>
                <Button
                  variant="danger" size="sm" disabled={isDeleting}
                  onClick={() => { setDeleteError(null); setShowDelete(true) }}
                >
                  <TrashIcon size={14} className="mr-1.5" /> Delete
                </Button>
              </>
            }
          />

          {redeployError && (
            <Alert variant="destructive" className="bg-card">
              <WarningCircleIcon className="h-4 w-4" />
              <AlertDescription>Redeploy failed: {redeployError.message}</AlertDescription>
            </Alert>
          )}

          <StatBand className="lg:grid-cols-5">
            <StatTile index={0} label="State" tone={health.tone}>
              <TileValue main={<span className={TONE_TEXT[health.tone]}>{health.label}</span>} sub={health.detail} />
            </StatTile>
            <StatTile index={1} label="Pool">
              <div className="mt-3 min-w-0">
                <Link
                  to={`/pools/${namespace}/${fn.pool}`}
                  className="block truncate font-display text-[28px] font-medium leading-[1.2] text-text hover:text-primary"
                >
                  {fn.pool}
                </Link>
                <div className="mt-2 text-xs text-text-muted">timeout {fn.timeoutSeconds}s</div>
              </div>
            </StatTile>
            <StatTile index={2} label="Triggers">
              <TileValue
                main={fn.triggers.length}
                sub={fn.triggers.map((t) => t.type).join(' · ') || 'none'}
              />
            </StatTile>
            <StatTile index={3} label="Commit">
              <TileValue
                main={<span className="font-mono text-[22px]">{fn.source.commit?.slice(0, 8) ?? '—'}</span>}
                sub={fn.source.ref || 'default branch'}
              />
            </StatTile>
            <StatTile index={4} label="Created">
              <TileValue main={relativeTime(fn.createdAt)} sub={formatTimestamp(fn.createdAt)} />
            </StatTile>
          </StatBand>

          <SectionSheet title={<><GitBranchIcon size={16} className="text-text-muted" /> Source</>}>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-4">
                <Fact label="Repository">
                  <span className="inline-flex items-center gap-1">
                    {fn.source.url}
                    <CopyButton text={fn.source.url} />
                  </span>
                </Fact>
              </div>
              <Fact label="Ref">{fn.source.ref || 'default branch'}</Fact>
              <Fact label="Path">{fn.source.path || '/'}</Fact>
              <Fact label="Commit">{fn.source.commit || '—'}</Fact>
              <Fact label="Entrypoint">{fn.entrypoint || '—'}</Fact>
            </dl>
          </SectionSheet>

          <Triggers fn={fn} />

          <FunctionTestPanel fn={fn} />

          <SectionSheet title="Build" aside={BUILD_LABEL[buildStatus]}>
            {isBuilding(fn) && (
              <p className="mb-3 text-sm text-text-muted">
                A Function that already serves calls keeps its previous code until this build succeeds.
              </p>
            )}
            {buildStatus === 'failed' && (
              <p className="mb-3 text-sm text-danger">
                The Function does not serve calls until a build succeeds. Correct the code or the settings, then
                redeploy.
              </p>
            )}
            {fn.build?.log ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border-subtle bg-background/40 p-3 font-mono text-xs leading-relaxed text-text">
                {fn.build.log}
              </pre>
            ) : (
              <p className="text-sm text-text-muted">
                {buildStatus === 'none'
                  ? 'The code runs as it is. It needs no build.'
                  : isBuilding(fn)
                    ? 'The build has no output yet. This page updates automatically.'
                    : 'The build has no log.'}
              </p>
            )}
          </SectionSheet>

          <FunctionLogsPanel namespace={namespace} name={name} />

          {volumes.length > 0 && (
            <SectionSheet title="Secrets and ConfigMaps" aside={`${volumes.length}`}>
              <DataTable head={['Kind', 'Name', 'Mount path']}>
                {volumes.map((v) => (
                  <tr key={`${v.kind}/${v.name}`} className={rowCls}>
                    <td className="px-3 py-2 text-sm text-text-secondary">{v.kind}</td>
                    <td className="px-3 py-2">
                      <Link to={v.to} className="font-mono text-sm text-primary hover:underline">{v.name}</Link>
                    </td>
                    <td className="break-all px-3 py-2 font-mono text-sm text-text-secondary">{v.mountPath ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
            </SectionSheet>
          )}

          {fn.advanced && (
            <SectionSheet title="Advanced">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                {fn.advanced.concurrency !== undefined && <Fact label="Concurrency">{fn.advanced.concurrency}</Fact>}
                {fn.advanced.requestsPerPod !== undefined && <Fact label="Requests per pod">{fn.advanced.requestsPerPod}</Fact>}
                {fn.advanced.idleTimeoutSeconds !== undefined && <Fact label="Idle timeout">{fn.advanced.idleTimeoutSeconds}s</Fact>}
                {fn.advanced.retainPods !== undefined && <Fact label="Retain pods">{fn.advanced.retainPods}</Fact>}
                {fn.advanced.specializationTimeoutSeconds !== undefined && (
                  <Fact label="Specialization timeout">{fn.advanced.specializationTimeoutSeconds}s</Fact>
                )}
                {fn.advanced.onceOnly && <Fact label="One request per pod">yes</Fact>}
                {fn.advanced.buildCommand && <Fact label="Build command">{fn.advanced.buildCommand}</Fact>}
              </dl>
            </SectionSheet>
          )}

          <ConditionsSection conditions={fn.status?.conditions} />

          <ConfirmDeleteDialog
            kind="Function"
            name={showDelete ? name : null}
            note="Its triggers are deleted with it."
            onClose={() => setShowDelete(false)}
            onConfirm={handleDelete}
            isDeleting={isDeleting}
            error={deleteError}
          />
        </div>
      )}
    </div>
  )
}
