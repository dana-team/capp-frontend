import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CircleNotchIcon, CubeIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon,
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
import { useCfuncFeatures, useDeletePool, useFunctions, usePool } from '@/hooks/useCfunc'
import type { EnvVar } from '@/types/capp'
import type { PoolResponse } from '@/types/cfunc'
import { TONE_TEXT, functionHealth, poolHealth } from '@/utils/cfunc'
import { formatTimestamp, relativeTime } from '@/utils/time'
import { cn } from '@/lib/utils'

function envValue(env: EnvVar): string {
  const secret = env.valueFrom?.secretKeyRef
  const configMap = env.valueFrom?.configMapKeyRef
  if (secret) return `secret ${secret.name} / ${secret.key}`
  if (configMap) return `configmap ${configMap.name} / ${configMap.key}`
  return env.value ?? ''
}

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-text-muted">{label}</dt>
    <dd className="mt-0.5 break-all font-mono text-sm text-text">{children}</dd>
  </div>
)

const PoolFunctions: React.FC<{ pool: PoolResponse }> = ({ pool }) => {
  const { data: functions, error } = useFunctions(pool.namespace)
  const using = (functions ?? []).filter((f) => f.pool === pool.name)
  return (
    <SectionSheet title="Functions" aside={functions ? `${using.length}` : undefined}>
      {error ? (
        <p className="text-sm text-danger">{(error as Error).message}</p>
      ) : using.length === 0 ? (
        <p className="text-sm text-text-muted">{functions ? 'No Function runs in this Pool.' : 'Loading…'}</p>
      ) : (
        <DataTable head={['Name', 'State', 'Triggers']}>
          {using.map((f) => {
            const health = functionHealth(f)
            return (
              <tr key={f.name} className={rowCls}>
                <td className="px-3 py-2">
                  <Link to={`/functions/${f.namespace}/${f.name}`} className="font-mono text-sm text-primary hover:underline">
                    {f.name}
                  </Link>
                </td>
                <td className={cn('px-3 py-2 text-sm', TONE_TEXT[health.tone])}>{health.label}</td>
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {f.triggers.map((t) => `${t.type}:${t.name}`).join(', ') || '—'}
                </td>
              </tr>
            )
          })}
        </DataTable>
      )}
    </SectionSheet>
  )
}

export const PoolDetailPage: React.FC = () => {
  const { namespace = '', name = '' } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const features = useCfuncFeatures()
  const { data: pool, isLoading, error } = usePool(namespace, name)
  const { mutateAsync: deletePool, isPending: isDeleting } = useDeletePool()
  const [showDelete, setShowDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      await deletePool({ namespace, name })
      navigate('/pools')
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Pool')
    }
  }

  const health = pool ? poolHealth(pool) : undefined
  const requests = pool?.resources?.requests
  const limits = pool?.resources?.limits

  return (
    <div>
      <DetailCrumbs to="/pools" parent="Pools" name={name} />

      {isLoading && (
        <Sheet className="flex items-center justify-center py-16">
          <CircleNotchIcon className="h-8 w-8 animate-spin text-text-muted" />
        </Sheet>
      )}

      {error && (
        <Alert variant="destructive" className="bg-card">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Pool'}</AlertDescription>
        </Alert>
      )}

      {pool && health && (
        <div className="flex flex-col gap-4">
          <DetailHeader
            title={pool.name}
            badges={
              <>
                <Badge variant="info">{pool.flavor || 'custom runtime'}</Badge>
                {pool.advanced && <Badge variant="default">custom settings</Badge>}
              </>
            }
            meta={
              <>
                <span className="inline-flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', toneDot[health.tone])} aria-hidden />
                  <span className={cn('font-medium', TONE_TEXT[health.tone])}>{health.label.toLowerCase()}</span>
                </span>
                <Badge variant="namespace">{pool.namespace}</Badge>
                {pool.uid && <span className="font-mono text-xs text-text-muted">{pool.uid}</span>}
              </>
            }
            actions={
              <>
                <Link to={`/pools/${namespace}/${name}/edit`}>
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

          <StatBand className="lg:grid-cols-5">
            <StatTile index={0} label="State" tone={health.tone}>
              <TileValue main={<span className={TONE_TEXT[health.tone]}>{health.label}</span>} sub={health.detail} />
            </StatTile>
            <StatTile index={1} label="Flavor">
              <TileValue main={pool.flavor || '—'} sub={pool.flavor ? undefined : 'The image matches no configured flavor'} />
            </StatTile>
            <StatTile index={2} label="Size">
              <TileValue
                main={pool.size || 'custom'}
                sub={[requests?.cpu && `${requests.cpu} cpu`, requests?.memory].filter(Boolean).join(' · ') || undefined}
              />
            </StatTile>
            <StatTile index={3} label="Warm pods" value={pool.poolSize} />
            <StatTile index={4} label="Created">
              <TileValue main={relativeTime(pool.createdAt)} sub={formatTimestamp(pool.createdAt)} />
            </StatTile>
          </StatBand>

          <SectionSheet title="Runtime">
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-1 text-xs text-text-muted">Image</p>
                <div className="flex items-center gap-1">
                  <CubeIcon size={14} weight="duotone" className="shrink-0 text-text-muted" />
                  <span className="min-w-0 break-all font-mono text-sm text-text">{pool.image}</span>
                  <CopyButton text={pool.image} />
                </div>
              </div>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <Fact label="Build image">{pool.builder?.image || 'None (no source build)'}</Fact>
                <Fact label="Build command">{pool.builder?.command || '—'}</Fact>
                <Fact label="Requests">{[requests?.cpu, requests?.memory].filter(Boolean).join(' / ') || '—'}</Fact>
                <Fact label="Limits">{[limits?.cpu, limits?.memory].filter(Boolean).join(' / ') || '—'}</Fact>
                <Fact label="Grace period">{pool.terminationGracePeriodSeconds}s</Fact>
                <Fact label="Environment version">{pool.version}</Fact>
              </dl>

              {pool.env && pool.env.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-text-muted">Environment Variables ({pool.env.length})</p>
                  <DataTable head={['Name', 'Value']}>
                    {pool.env.map((env) => (
                      <tr key={env.name} className={rowCls}>
                        <td className="max-w-[40%] break-all px-3 py-2 align-top font-mono text-sm text-text">{env.name}</td>
                        <td className="break-all px-3 py-2 font-mono text-sm text-text-secondary">{envValue(env)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
              )}
            </div>
          </SectionSheet>

          {features.functions && <PoolFunctions pool={pool} />}

          <ConditionsSection conditions={pool.status?.conditions} />

          <ConfirmDeleteDialog
            kind="Pool"
            name={showDelete ? name : null}
            note="The backend refuses the delete while a Function of the namespace uses the Pool."
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
