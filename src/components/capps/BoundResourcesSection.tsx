import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowsClockwiseIcon, LinkSimpleIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { SectionSheet, DataTable, rowCls } from '@/components/layout/DetailParts'
import {
  CappResponse,
  RESTART_REASON_ANNOTATION,
  RESTARTED_AT_ANNOTATION,
} from '@/types/capp'
import { BOUND_KIND_LABEL } from '@/types/bound'
import { cappBoundResources } from '@/utils/boundResources'
import { formatTimestamp, relativeTime } from '@/utils/time'

/** The Secrets and ConfigMaps a Capp uses, and whether a change to each rolls it out. */
export const BoundResourcesSection: React.FC<{ capp: CappResponse }> = ({ capp }) => {
  const refs = cappBoundResources(capp)
  const enabled = Boolean(capp.reloadOnBoundResourceChange)
  const restartedAt = capp.annotations?.[RESTARTED_AT_ANNOTATION]
  const restartReason = capp.annotations?.[RESTART_REASON_ANNOTATION]

  if (refs.length === 0 && !enabled) return null

  return (
    <SectionSheet
      title={<><LinkSimpleIcon size={16} className="text-text-muted" /> Bound resources</>}
      aside={refs.length ? `${refs.length}` : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {enabled ? (
            <Badge variant="success" className="gap-1">
              <ArrowsClockwiseIcon size={12} /> Rollout on change: on
            </Badge>
          ) : (
            <Badge variant="default">Rollout on change: off</Badge>
          )}
          <span className="text-text-secondary">
            {enabled
              ? 'Updating a Secret or ConfigMap this Capp’s pods use starts a new revision.'
              : 'Updating these leaves the running revision as it is. Turn it on in Edit.'}
          </span>
        </div>

        {restartedAt && (
          <p className="text-xs text-text-muted" title={formatTimestamp(restartedAt)}>
            Last rolled out {relativeTime(restartedAt)}
            {restartReason && <> for <span className="font-mono text-text-secondary">{restartReason}</span></>}
          </p>
        )}

        {refs.length === 0 ? (
          <p className="text-sm text-text-muted">This Capp uses no Secrets or ConfigMaps.</p>
        ) : (
          <DataTable head={['Kind', 'Name', 'Used by', 'On change']}>
            {refs.map((ref) => (
              <tr key={`${ref.kind}/${ref.name}`} className={rowCls}>
                <td className="px-3 py-2 text-sm text-text-secondary">{BOUND_KIND_LABEL[ref.kind]}</td>
                <td className="break-all px-3 py-2">
                  <Link
                    to={`/${ref.kind}s/${capp.namespace}/${ref.name}`}
                    className="font-mono text-sm text-primary hover:underline"
                  >
                    {ref.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-text-muted">{ref.via.join(', ')}</td>
                <td className="px-3 py-2">
                  {enabled && ref.inPods ? (
                    <Badge variant="warning" className="gap-1">
                      <ArrowsClockwiseIcon size={12} /> Rolls out
                    </Badge>
                  ) : (
                    <Badge
                      variant="default"
                      title={
                        ref.inPods
                          ? 'Rollout on change is off for this Capp.'
                          : 'Used for log shipping or a Kafka source, which a rollout would not refresh.'
                      }
                    >
                      No rollout
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </SectionSheet>
  )
}
