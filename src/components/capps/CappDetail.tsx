import React from 'react'
import { Link } from 'react-router-dom'
import { PencilSimple, Trash, Globe, ShieldCheck, Pulse, Clock, Cube, CircleNotch, ArrowSquareOut, HardDrives } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/CopyButton'
import { ConditionsTable } from './ConditionsTable'
import { CappResponse } from '@/types/capp'
import { relativeTime, formatTimestamp } from '@/utils/time'

interface CappDetailProps {
  capp: CappResponse
  onDelete?: () => void
  isDeleting?: boolean
}

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
  icon, label, value,
}) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-text-muted">{icon}</div>
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-text">{value}</div>
    </div>
  </div>
)

export const CappDetail: React.FC<CappDetailProps> = ({ capp, onDelete, isDeleting }) => {
  const namespace = capp.namespace

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-text">{capp.name}</h1>
            <Badge variant={capp.state === 'disabled' ? 'default' : 'success'}>
              {capp.state ?? 'enabled'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="namespace">{namespace}</Badge>
            {capp.uid && (
              <span className="text-xs text-text-muted font-mono">
                {capp.uid.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/capps/${namespace}/${capp.name}/edit`}>
            <Button variant="secondary" size="sm">
              <PencilSimple size={14} className="mr-1.5" /> Edit
            </Button>
          </Link>
          {onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
              {isDeleting
                ? <CircleNotch size={14} className="mr-1.5 animate-spin" />
                : <Trash size={14} className="mr-1.5" />
              }
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* 2-column card grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Overview card */}
        <Card className="bg-surface border-border border-l-2 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoRow
              icon={<Clock size={14} />}
              label="Created"
              value={
                <span title={formatTimestamp(capp.createdAt)}>
                  {relativeTime(capp.createdAt)}
                </span>
              }
            />
            <InfoRow
              icon={<Pulse size={14} />}
              label="Scale Metric"
              value={
                capp.scaleSpec?.metric
                  ? <Badge variant="info">{capp.scaleSpec.metric}</Badge>
                  : <span className="text-text-muted">concurrency (default)</span>
              }
            />
            {capp.scaleSpec?.minReplicas !== undefined && (
              <InfoRow
                icon={<Pulse size={14} />}
                label="Min Replicas"
                value={<span className="font-mono">{capp.scaleSpec.minReplicas}</span>}
              />
            )}
            {capp.scaleSpec?.scaleDelaySeconds !== undefined && capp.scaleSpec.scaleDelaySeconds > 0 && (
              <InfoRow
                icon={<Clock size={14} />}
                label="Scale Delay"
                value={<span className="font-mono">{capp.scaleSpec.scaleDelaySeconds}s</span>}
              />
            )}
            {capp.routeSpec?.hostname && (
              <InfoRow
                icon={<Globe size={14} />}
                label="Hostname"
                value={
                  <a
                    href={`http${capp.routeSpec.tlsEnabled ? 's' : ''}://${capp.routeSpec.hostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {capp.routeSpec.hostname}
                  </a>
                }
              />
            )}
            {capp.routeSpec && (
              <InfoRow
                icon={<ShieldCheck size={14} />}
                label="TLS"
                value={
                  capp.routeSpec.tlsEnabled
                    ? <Badge variant="success">Enabled</Badge>
                    : <Badge variant="default">Disabled</Badge>
                }
              />
            )}
            {capp.logSpec && (
              <InfoRow icon={<HardDrives size={14} />} label="Log Host" value={capp.logSpec.host} />
            )}
            {capp.status?.applicationLinks?.site && (
              <InfoRow
                icon={<ArrowSquareOut size={14} />}
                label="Site"
                value={
                  <a
                    href={capp.status.applicationLinks.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline truncate"
                  >
                    {capp.status.applicationLinks.site}
                  </a>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Container card */}
        <Card className="bg-surface border-border border-l-2 border-l-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">Container</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Cube size={14} weight="duotone" className="mt-0.5 text-text-muted shrink-0" />
              <div>
                <p className="text-xs text-text-muted">Image</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-sm font-mono text-text">{capp.image}</span>
                  <CopyButton text={capp.image ?? ''} />
                </div>
              </div>
            </div>

            {capp.env && capp.env.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-text-muted">
                  Environment Variables ({capp.env.length})
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capp.env.map((env, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                          <td className="px-3 py-2 text-sm font-mono text-text">{env.name}</td>
                          <td className="px-3 py-2 text-sm text-text-secondary font-mono">{env.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {capp.volumeMounts && capp.volumeMounts.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-text-muted">
                  Volume Mounts ({capp.volumeMounts.length})
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Mount Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capp.volumeMounts.map((vm, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                          <td className="px-3 py-2 text-sm font-mono text-text">{vm.name}</td>
                          <td className="px-3 py-2 text-sm text-text-secondary font-mono">{vm.mountPath}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Conditions */}
      <Card className="bg-surface border-border border-l-2 border-l-success">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">Status Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <ConditionsTable capp={capp} />
        </CardContent>
      </Card>

      {/* NFS Volumes */}
      {capp.nfsVolumes && capp.nfsVolumes.length > 0 && (
        <Card className="bg-surface border-border border-l-2 border-l-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">NFS Volumes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {capp.nfsVolumes.map((vol) => (
                <div key={vol.name} className="rounded-lg border border-border bg-card p-3">
                  <p className="font-medium text-sm text-text">{vol.name}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {vol.server}:{vol.path} · {vol.capacity}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
