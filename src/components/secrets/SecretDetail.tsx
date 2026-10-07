import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { PencilSimple, Trash, CircleNotch, Eye, EyeSlash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile } from '@/components/layout/StatTile'
import { DetailHeader, SectionSheet, DataTable, rowCls } from '@/components/layout/DetailParts'
import { SecretResponse } from '@/types/secret'
import { formatTimestamp, relativeTime } from '@/utils/time'
import { DOCKER_CONFIG_JSON_KEY, DOCKER_CONFIG_JSON_TYPE, parseDockerConfigJson } from '@/utils/dockerConfig'

interface SecretDetailProps {
  secret: SecretResponse
  onDelete?: () => void
  isDeleting?: boolean
}

export const SecretDetail: React.FC<SecretDetailProps> = ({ secret, onDelete, isDeleting }) => {
  const namespace = secret.namespace
  const entries = Object.entries(secret.data ?? {})
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const isImagePull = secret.type === DOCKER_CONFIG_JSON_TYPE
  const registry = isImagePull ? parseDockerConfigJson(secret.data?.[DOCKER_CONFIG_JSON_KEY]) : null

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={secret.name}
        meta={
          <>
            <Badge variant="namespace">{namespace}</Badge>
            {secret.type && (
              <Badge variant="outline" title={secret.type}>
                {isImagePull ? 'Image pull secret' : secret.type}
              </Badge>
            )}
            {secret.uid && (
              <span className="font-mono text-xs text-text-muted">
                {secret.uid.slice(0, 8)}…
              </span>
            )}
          </>
        }
        actions={
          <>
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
          </>
        }
      />

      <StatBand className={registry ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}>
        <StatTile index={0} label="Type">
          <div className="mt-3 truncate font-mono text-sm text-text" title={secret.type}>
            {isImagePull ? 'Image pull secret' : (secret.type ?? 'Opaque')}
          </div>
        </StatTile>
        <StatTile index={1} label="Keys" value={entries.length} />
        {registry && (
          <>
            <StatTile index={2} label="Registry">
              <div className="mt-3 truncate font-mono text-sm text-text" title={registry.server}>{registry.server}</div>
            </StatTile>
            <StatTile index={3} label="Username">
              <div className="mt-3 truncate font-mono text-sm text-text" title={registry.username}>{registry.username}</div>
            </StatTile>
          </>
        )}
        <StatTile index={registry ? 4 : 2} label="Created" className={registry ? undefined : 'col-span-2'}>
          <div className="mt-3 font-display text-[28px] font-medium leading-none text-text" title={formatTimestamp(secret.createdAt)}>
            {relativeTime(secret.createdAt)}
          </div>
        </StatTile>
      </StatBand>

      <SectionSheet title="Data" aside={`${entries.length}`}>
        {entries.length === 0 ? (
          <p className="text-sm text-text-muted">No data entries.</p>
        ) : (
          <DataTable head={['Key', 'Value', '']}>
            {entries.map(([key, value]) => (
              <tr key={key} className={rowCls}>
                <td className="w-1/3 break-all px-3 py-2 align-top font-mono text-sm text-text">{key}</td>
                <td className="whitespace-pre-wrap break-all px-3 py-2 font-mono text-sm text-text-secondary">
                  {revealedKeys.has(key) ? value : '••••••••'}
                </td>
                <td className="w-10 px-3 py-2 text-center align-top">
                  <button
                    type="button"
                    onClick={() => toggleReveal(key)}
                    className="text-text-muted transition-colors hover:text-text"
                  >
                    {revealedKeys.has(key) ? <EyeSlash size={14} /> : <Eye size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionSheet>
    </div>
  )
}
