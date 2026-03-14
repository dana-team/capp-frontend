import React from 'react'
import { Link } from 'react-router-dom'
import { Edit2, Trash2, Globe, Shield, Activity, Clock, Hash, Container, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/CopyButton'
import { BorderBeam } from '@/components/ui/border-beam'
import { ConditionsTable } from './ConditionsTable'
import { Capp } from '@/types/capp'
import { relativeTime, formatTimestamp } from '@/utils/time'

interface CappDetailProps {
  capp: Capp
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
  const container = capp.spec.configurationSpec.template.spec.containers[0]
  const namespace = capp.metadata.namespace ?? ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-text">{capp.metadata.name}</h1>
            <Badge variant={capp.spec.state === 'disabled' ? 'default' : 'success'}>
              {capp.spec.state ?? 'enabled'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="violet">{namespace}</Badge>
            {capp.metadata.uid && (
              <span className="text-xs text-text-muted font-mono">
                {capp.metadata.uid.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/capps/${namespace}/${capp.metadata.name}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit2 size={14} className="mr-1.5" /> Edit
            </Button>
          </Link>
          {onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
              {isDeleting
                ? <Loader2 size={14} className="mr-1.5 animate-spin" />
                : <Trash2 size={14} className="mr-1.5" />
              }
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* 2-column card grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Overview card */}
        <Card className="relative overflow-hidden bg-surface border-border">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-text-muted">Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoRow
              icon={<Clock size={14} />}
              label="Created"
              value={
                <span title={formatTimestamp(capp.metadata.creationTimestamp)}>
                  {relativeTime(capp.metadata.creationTimestamp)}
                </span>
              }
            />
            {capp.metadata.uid && (
              <InfoRow
                icon={<Hash size={14} />}
                label="UID"
                value={
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{capp.metadata.uid}</span>
                    <CopyButton text={capp.metadata.uid} />
                  </div>
                }
              />
            )}
            <InfoRow
              icon={<Activity size={14} />}
              label="Scale Metric"
              value={
                capp.spec.scaleMetric
                  ? <Badge variant="info">{capp.spec.scaleMetric}</Badge>
                  : <span className="text-text-muted">default</span>
              }
            />
            {capp.spec.routeSpec?.hostname && (
              <InfoRow
                icon={<Globe size={14} />}
                label="Hostname"
                value={
                  <a
                    href={`http${capp.spec.routeSpec.tlsEnabled ? 's' : ''}://${capp.spec.routeSpec.hostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {capp.spec.routeSpec.hostname}
                  </a>
                }
              />
            )}
            {capp.spec.routeSpec && (
              <InfoRow
                icon={<Shield size={14} />}
                label="TLS"
                value={
                  capp.spec.routeSpec.tlsEnabled
                    ? <Badge variant="success">Enabled</Badge>
                    : <Badge variant="default">Disabled</Badge>
                }
              />
            )}
            {capp.spec.logSpec && (
              <InfoRow icon={<Activity size={14} />} label="Log Host" value={capp.spec.logSpec.host} />
            )}
          </CardContent>
          <BorderBeam size={120} duration={8} />
        </Card>

        {/* Container card */}
        <Card className="relative overflow-hidden bg-surface border-border">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-accent to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-text-muted">Container</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Container size={14} className="mt-0.5 text-text-muted shrink-0" />
              <div>
                <p className="text-xs text-text-muted">Image</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-sm font-mono text-text">{container?.image}</span>
                  <CopyButton text={container?.image ?? ''} />
                </div>
              </div>
            </div>

            {container?.env && container.env.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-text-muted">
                  Environment Variables ({container.env.length})
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
                      {container.env.map((env, i) => (
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

            {container?.volumeMounts && container.volumeMounts.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-text-muted">
                  Volume Mounts ({container.volumeMounts.length})
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
                      {container.volumeMounts.map((vm, i) => (
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
          <BorderBeam size={120} duration={8} delay={2} />
        </Card>
      </div>

      {/* Status Conditions — full width */}
      <Card className="relative overflow-hidden bg-surface border-border">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-success to-transparent" />
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-text-muted">Status Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <ConditionsTable capp={capp} />
        </CardContent>
        <BorderBeam size={200} duration={10} delay={4} />
      </Card>

      {/* Optional: NFS Volumes */}
      {capp.spec.volumesSpec?.nfsVolumes && capp.spec.volumesSpec.nfsVolumes.length > 0 && (
        <Card className="relative overflow-hidden bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-text-muted">NFS Volumes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {capp.spec.volumesSpec.nfsVolumes.map((vol) => (
                <div key={vol.name} className="rounded-lg border border-border bg-card p-3">
                  <p className="font-medium text-sm text-text">{vol.name}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {vol.server}:{vol.path} · {vol.capacity.storage}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          <BorderBeam size={120} duration={8} delay={6} />
        </Card>
      )}

      {/* Optional: Kafka Sources */}
      {capp.spec.sources && capp.spec.sources.length > 0 && (
        <Card className="relative overflow-hidden bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-text-muted">Kafka Sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {capp.spec.sources.map((src) => (
              <div key={src.name} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium text-sm text-text">{src.name}</p>
                  <Badge variant="info">kafka</Badge>
                </div>
                <p className="text-xs text-text-muted">Servers: {src.bootstrapServers.join(', ')}</p>
                <p className="text-xs text-text-muted mt-1">Topics: {src.topic.join(', ')}</p>
              </div>
            ))}
          </CardContent>
          <BorderBeam size={120} duration={8} delay={8} />
        </Card>
      )}
    </div>
  )
}
