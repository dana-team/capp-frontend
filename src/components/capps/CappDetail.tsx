import React from 'react'
import { Link } from 'react-router-dom'
import { PencilSimpleIcon,
  TrashIcon,
  CubeIcon,
  CircleNotchIcon,
  GitBranchIcon,
  CheckCircleIcon,
  ArrowsLeftRightIcon,
  LightningIcon,
  KeyIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/CopyButton'
import { ConditionsTable } from './ConditionsTable'
import { CappResponse, hasBackupLabel, SyncToGitResponse } from '@/types/capp'
import { relativeTime, formatTimestamp } from '@/utils/time'
import { SizeBadge } from '@/components/ui/SizeBadge'
import { cn } from '@/lib/utils'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile, toneDot } from '@/components/layout/StatTile'
import { DetailHeader, SectionSheet, DataTable, rowCls } from '@/components/layout/DetailParts'
import { cappHealth, HEALTH_LABEL, HEALTH_TEXT, HEALTH_TONE } from '@/utils/cappHealth'

interface CappDetailProps {
  capp: CappResponse
  onDelete?: () => void
  isDeleting?: boolean
  onSync?: () => void
  onDisableSync?: () => void
  isSyncing?: boolean
  syncResult?: SyncToGitResponse | null
  syncError?: string | null
  onMigrate?: () => void
}

/** Value line used inside StatTile children. */
const TileValue: React.FC<{ main: React.ReactNode; sub?: React.ReactNode; className?: string }> = ({ main, sub, className }) => (
  <div className="mt-3 min-w-0">
    <div className={cn('truncate font-display text-[28px] font-medium leading-none tabular-nums text-text', className)}>{main}</div>
    {sub && <div className="mt-2 truncate text-xs text-text-muted">{sub}</div>}
  </div>
)

export const CappDetail: React.FC<CappDetailProps> = ({
  capp, onDelete, isDeleting, onSync, onDisableSync, isSyncing, syncResult, syncError, onMigrate,
}) => {
  const namespace = capp.namespace
  const isSynced = hasBackupLabel(capp.labels)

  const health = cappHealth(capp)
  const scale = capp.scaleSpec
  const hasReplicas = scale?.minReplicas !== undefined || scale?.maxReplicas !== undefined
  const replicas = hasReplicas ? `${scale.minReplicas ?? '–'}–${scale.maxReplicas ?? '–'}` : '—'
  const req = capp.resources?.requests
  const resourceLine = [req?.cpu && `${req.cpu} cpu`, req?.memory && `${req.memory}`].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <DetailHeader
        title={capp.name}
        badges={isSynced && (
          <Badge variant="info" className="gap-1">
            <GitBranchIcon size={12} /> Git sync on
          </Badge>
        )}
        meta={
          <>
            <span className="inline-flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', toneDot[HEALTH_TONE[health]])} aria-hidden />
              <span className={cn('font-medium', HEALTH_TEXT[health])}>{HEALTH_LABEL[health].toLowerCase()}</span>
            </span>
            <Badge variant="namespace">{namespace}</Badge>
            {capp.uid && (
              <span className="font-mono text-xs text-text-muted">{capp.uid}</span>
            )}
          </>
        }
        actions={
          <>
            {onSync && !isSynced && (
              <Button variant="secondary" size="sm" onClick={onSync} disabled={isSyncing}>
                {isSyncing
                  ? <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />
                  : <GitBranchIcon size={14} className="mr-1.5" />
                }
                Enable Git sync
              </Button>
            )}
            {isSynced && onDisableSync && (
              <Button variant="danger" size="sm" onClick={onDisableSync} disabled={isSyncing}>
                Disable Git sync
              </Button>
            )}
            {onMigrate && (
              <Button variant="secondary" size="sm" onClick={onMigrate}>
                <ArrowsLeftRightIcon size={14} className="mr-1.5" /> Migrate
              </Button>
            )}
            <Link to={`/capps/${namespace}/${capp.name}/edit`}>
              <Button variant="secondary" size="sm">
                <PencilSimpleIcon size={14} className="mr-1.5" /> Edit
              </Button>
            </Link>
            {onDelete && (
              <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
                {isDeleting
                  ? <CircleNotchIcon size={14} className="mr-1.5 animate-spin" />
                  : <TrashIcon size={14} className="mr-1.5" />
                }
                Delete
              </Button>
            )}
          </>
        }
      />

      {/* Sync result banner. Deliberately says nothing about the values file
          path or the commit — those are Git internals the user does not act on. */}
      {syncResult && (
        <div className="flex items-center gap-2 rounded-[10px] border border-success/40 bg-card px-4 py-3 text-sm text-success shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]">
          <CheckCircleIcon size={16} weight="fill" />
          <span>Git sync is {syncResult.enabled ? 'on' : 'off'}.</span>
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-2 rounded-[10px] border border-danger/40 bg-card px-4 py-3 text-sm text-danger shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]">
          <span>Git sync failed: {syncError}</span>
        </div>
      )}

      {/* Key facts */}
      <StatBand className="lg:grid-cols-5">
        <StatTile index={0} label="State" tone={HEALTH_TONE[health]}>
          <TileValue
            main={<span className={HEALTH_TEXT[health]}>{HEALTH_LABEL[health]}</span>}
            sub={health === 'disabled' ? undefined : (capp.state ?? 'enabled')}
          />
        </StatTile>
        <StatTile index={1} label="Scale">
          <TileValue
            main={replicas}
            sub={
              <>
                {scale?.metric ? scale.metric : 'concurrency (default)'}
                {scale?.scaleDelaySeconds !== undefined && scale.scaleDelaySeconds > 0 && ` · ${scale.scaleDelaySeconds}s delay`}
              </>
            }
          />
        </StatTile>
        <StatTile index={2} label="Size">
          <div className="mt-3 min-w-0">
            <div className="flex items-center gap-2">
              {capp.size ? <SizeBadge size={capp.size} /> : <span className="font-display text-[28px] leading-none text-text">—</span>}
              {capp.size && <span className="font-display text-[28px] font-medium capitalize leading-none text-text">{capp.size}</span>}
            </div>
            {resourceLine && <div className="mt-2 truncate font-mono text-xs text-text-muted">{resourceLine}</div>}
          </div>
        </StatTile>
        <StatTile index={3} label="Route">
          <div className="mt-3 min-w-0">
            {capp.routeSpec?.hostname ? (
              <a
                href={`http${capp.routeSpec.tlsEnabled ? 's' : ''}://${capp.routeSpec.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium text-accent hover:underline"
              >
                {capp.routeSpec.hostname}
              </a>
            ) : (
              <span className="text-sm text-text-muted">No hostname</span>
            )}
            {capp.routeSpec && (
              <div className="mt-2">
                {capp.routeSpec.tlsEnabled
                  ? <Badge variant="success">TLS enabled</Badge>
                  : <Badge variant="default">TLS disabled</Badge>}
              </div>
            )}
          </div>
        </StatTile>
        <StatTile index={4} label="Created">
          <TileValue
            main={relativeTime(capp.createdAt)}
            sub={formatTimestamp(capp.createdAt)}
          />
        </StatTile>
      </StatBand>

      {/* Container */}
      <SectionSheet title="Container">
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-1 text-xs text-text-muted">Image</p>
            <div className="flex items-center gap-1">
              <CubeIcon size={14} weight="duotone" className="shrink-0 text-text-muted" />
              <span className="min-w-0 break-all font-mono text-sm text-text">{capp.image}</span>
              <CopyButton text={capp.image ?? ''} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-text-muted">
              {(capp.imagePullSecrets?.length ?? 0) > 1 ? 'Image Pull Secrets' : 'Image Pull Secret'}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <KeyIcon size={14} weight="duotone" className="shrink-0 text-text-muted" />
              {capp.imagePullSecrets?.length ? (
                capp.imagePullSecrets.map((secretName) => (
                  <Link
                    key={secretName}
                    to={`/secrets/${namespace}/${secretName}`}
                    className="font-mono text-sm text-primary hover:underline"
                  >
                    {secretName}
                  </Link>
                ))
              ) : (
                <span className="text-sm text-text-muted">None</span>
              )}
            </div>
          </div>

          {capp.env && capp.env.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-text-muted">
                Environment Variables ({capp.env.length})
              </p>
              <DataTable head={['Name', 'Value']}>
                {capp.env.map((env, i) => (
                  <tr key={i} className={rowCls}>
                    <td className="max-w-[40%] break-all px-3 py-2 align-top font-mono text-sm text-text">{env.name}</td>
                    <td className="break-all px-3 py-2 font-mono text-sm text-text-secondary">{env.value}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          {capp.volumeMounts && capp.volumeMounts.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-text-muted">
                Volume Mounts ({capp.volumeMounts.length})
              </p>
              <DataTable head={['Name', 'Mount Path']}>
                {capp.volumeMounts.map((vm, i) => (
                  <tr key={i} className={rowCls}>
                    <td className="px-3 py-2 font-mono text-sm text-text">{vm.name}</td>
                    <td className="break-all px-3 py-2 font-mono text-sm text-text-secondary">{vm.mountPath}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      </SectionSheet>

      {/* Status Conditions */}
      <SectionSheet title="Status conditions" aside={capp.status?.conditions?.length ? `${capp.status.conditions.length}` : undefined}>
        <div className="flex flex-col gap-5">
          <ConditionsTable capp={capp} />
          {capp.status?.eventingStatus?.eventSources && capp.status.eventingStatus.eventSources.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">Event Source Status</p>
              <DataTable head={['Name', 'Status', 'Reason']}>
                {capp.status.eventingStatus.eventSources.map((src, i) => (
                  <tr key={i} className={rowCls}>
                    <td className="px-3 py-2 font-mono text-sm text-text">{src.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={src.status === 'True' ? 'success' : src.status === 'False' ? 'danger' : 'default'}>
                        {src.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-sm text-text-secondary">{src.reason ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>
      </SectionSheet>

      {/* Log */}
      {capp.logSpec && (
        <SectionSheet title="Log">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">Log Host</dt>
              <dd className="mt-0.5 break-all font-mono text-sm text-text">{capp.logSpec.host}</dd>
            </div>
            {capp.logSpec.target && (
              <div>
                <dt className="text-xs text-text-muted">Log Target</dt>
                <dd className="mt-0.5 break-all font-mono text-sm text-text">{capp.logSpec.target}</dd>
              </div>
            )}
          </dl>
        </SectionSheet>
      )}

      {/* NFS Volumes */}
      {capp.nfsVolumes && capp.nfsVolumes.length > 0 && (
        <SectionSheet title="NFS Volumes" aside={`${capp.nfsVolumes.length}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {capp.nfsVolumes.map((vol) => (
              <div key={vol.name} className="rounded-lg border border-border-subtle p-3">
                <p className="text-sm font-medium text-text">{vol.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-text-muted">
                  {vol.server}:{vol.path} · {vol.capacity}
                </p>
              </div>
            ))}
          </div>
        </SectionSheet>
      )}

      {/* Event Sources */}
      {capp.eventSourcesSpec?.sources && capp.eventSourcesSpec.sources.length > 0 && (
        <SectionSheet
          title={<><LightningIcon size={16} className="text-text-muted" /> Event Sources</>}
          aside={`${capp.eventSourcesSpec.sources.length}`}
        >
          <div className="flex flex-col gap-2">
            {capp.eventSourcesSpec.sources.map((src) => {
              const isPing = Boolean(src.pingSourceConfiguration);
              return (
                <div key={src.name} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{src.name}</span>
                    <Badge variant="info">{isPing ? 'Ping' : 'Kafka'}</Badge>
                  </div>
                  {src.uri && (
                    <p className="break-all font-mono text-xs text-text-muted">URI: {src.uri}</p>
                  )}
                  {isPing && src.pingSourceConfiguration && (
                    <p className="font-mono text-xs text-text-muted">
                      Schedule: {src.pingSourceConfiguration.schedule}
                      {src.pingSourceConfiguration.data && ` · data: ${src.pingSourceConfiguration.data}`}
                    </p>
                  )}
                  {!isPing && src.kafkaSourceConfiguration && (
                    <p className="break-all font-mono text-xs text-text-muted">
                      Brokers: {src.kafkaSourceConfiguration.bootstrapServers.join(', ')}
                      {' · '}Topics: {src.kafkaSourceConfiguration.topics.join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionSheet>
      )}
    </div>
  )
}
