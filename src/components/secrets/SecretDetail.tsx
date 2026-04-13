import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { PencilSimple, Trash, Clock, CircleNotch, Eye, EyeSlash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SecretResponse } from '@/types/secret'
import { formatTimestamp, relativeTime } from '@/utils/time'

interface SecretDetailProps {
  secret: SecretResponse
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

export const SecretDetail: React.FC<SecretDetailProps> = ({ secret, onDelete, isDeleting }) => {
  const namespace = secret.namespace
  const entries = Object.entries(secret.data ?? {})
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-text">{secret.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="namespace">{namespace}</Badge>
            {secret.type && (
              <Badge variant="outline">{secret.type}</Badge>
            )}
            {secret.uid && (
              <span className="text-xs text-text-muted font-mono">
                {secret.uid.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/secrets/${namespace}/${secret.name}/edit`}>
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

      <Card className="bg-surface border-border border-l-2 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <InfoRow
            icon={<Clock size={14} />}
            label="Created"
            value={
              <span title={formatTimestamp(secret.createdAt)}>
                {relativeTime(secret.createdAt)}
              </span>
            }
          />
        </CardContent>
      </Card>

      <Card className="bg-surface border-border border-l-2 border-l-accent">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest font-mono text-text-muted">
            Data ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-text-muted">No data entries.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-1/3">Key</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Value</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([key, value]) => (
                    <tr key={key} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                      <td className="px-3 py-2 text-sm font-mono text-text align-top">{key}</td>
                      <td className="px-3 py-2 text-sm font-mono text-text-secondary whitespace-pre-wrap break-all">
                        {revealedKeys.has(key) ? value : '••••••••'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleReveal(key)}
                          className="text-text-muted hover:text-text transition-colors"
                        >
                          {revealedKeys.has(key) ? <EyeSlash size={14} /> : <Eye size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
