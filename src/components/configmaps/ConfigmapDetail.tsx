import React from 'react'
import { Link } from 'react-router-dom'
import { PencilSimple, Trash, CircleNotch } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatBand } from '@/components/layout/StatBand'
import { StatTile } from '@/components/layout/StatTile'
import { DetailHeader, SectionSheet, DataTable, rowCls } from '@/components/layout/DetailParts'
import { ConfigMapResponse } from '@/types/configmap'
import { formatTimestamp, relativeTime } from '@/utils/time'

interface ConfigMapDetailProps {
  configMap: ConfigMapResponse
  onDelete?: () => void
  isDeleting?: boolean
}

export const ConfigMapDetail: React.FC<ConfigMapDetailProps> = ({ configMap, onDelete, isDeleting }) => {
  const namespace = configMap.namespace
  const entries = Object.entries(configMap.data ?? {})

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={configMap.name}
        meta={
          <>
            <Badge variant="namespace">{namespace}</Badge>
            {configMap.uid && (
              <span className="font-mono text-xs text-text-muted">
                {configMap.uid.slice(0, 8)}…
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link to={`/configmaps/${namespace}/${configMap.name}/edit`}>
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

      <StatBand className="lg:grid-cols-4">
        <StatTile index={0} label="Keys" value={entries.length} />
        <StatTile index={1} label="Created" className="col-span-2">
          <div className="mt-3 font-display text-[28px] font-medium leading-none text-text" title={formatTimestamp(configMap.createdAt)}>
            {relativeTime(configMap.createdAt)}
          </div>
        </StatTile>
      </StatBand>

      <SectionSheet title="Data" aside={`${entries.length}`}>
        {entries.length === 0 ? (
          <p className="text-sm text-text-muted">No data entries.</p>
        ) : (
          <DataTable head={['Key', 'Value']}>
            {entries.map(([key, value]) => (
              <tr key={key} className={rowCls}>
                <td className="w-1/3 break-all px-3 py-2 align-top font-mono text-sm text-text">{key}</td>
                <td className="whitespace-pre-wrap break-all px-3 py-2 font-mono text-sm text-text-secondary">{value}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionSheet>
    </div>
  )
}
