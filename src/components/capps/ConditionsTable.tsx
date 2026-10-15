import React, { useState } from 'react';
import { InfoIcon } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CappResponse, ConditionResponse } from '@/types/capp';
import { relativeTime } from '@/utils/time';
import { statusVariant } from '@/utils/cappHealth';

interface ConditionsTableProps {
  capp: CappResponse;
}

const PAGE_SIZE = 9;

const CONDITION_INFO: Record<string, string> = {
  Ready: 'Overall health. When not ready, it points to the capability that is the root cause.',
  ServingReady: 'The app is deployed and its latest revision is running.',
  RouteReady: 'The custom hostname works: DNS record, TLS certificate (if enabled) and domain mapping.',
  VolumesReady: 'The NFS volumes are provisioned and ready to mount.',
  EventingReady: 'The event sources (Ping, Kafka) are running and delivering events.',
  LoggingReady: 'Logs are shipped to the configured logging target.',
};

// Ready first; the operator appends other conditions in no fixed order.
const readyFirst = (a: ConditionResponse, b: ConditionResponse) =>
  Number(b.type === 'Ready') - Number(a.type === 'Ready');

export const ConditionsTable: React.FC<ConditionsTableProps> = ({ capp }) => {
  const [page, setPage] = useState(1);

  const conditions = [...(capp.status?.conditions ?? [])].sort(readyFirst);
  const totalPages = Math.max(1, Math.ceil(conditions.length / PAGE_SIZE));
  const paginated = conditions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (conditions.length === 0) {
    return (
      <EmptyState
        title="No conditions"
        description="No status conditions are available for this Capp."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <ul className="divide-y divide-border-subtle">
          {paginated.map((cond, i) => (
            <li
              key={`${cond.type}-${i}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 px-3 py-2.5 hover:bg-background/40"
            >
              <span
                className={cn(
                  'mt-[7px] h-2 w-2 rounded-full',
                  cond.status === 'True'    ? 'bg-success' :
                  cond.status === 'False'   ? 'bg-danger'  :
                  cond.status === 'Unknown' ? 'bg-warning' :
                                              'bg-text-muted/60',
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="inline-flex items-center gap-1 self-center">
                    <span className="text-sm font-medium text-text">{cond.type}</span>
                    {CONDITION_INFO[cond.type] && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="rounded-sm text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`About ${cond.type}`}
                          >
                            <InfoIcon size={14} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          {CONDITION_INFO[cond.type]}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  {cond.reason && <span className="font-mono text-xs text-text-secondary">{cond.reason}</span>}
                </div>
                {cond.message && (
                  <p className="mt-0.5 break-words text-xs text-text-muted">{cond.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                {cond.lastTransitionTime && (
                  <span className="whitespace-nowrap text-xs tabular-nums text-text-muted">
                    {relativeTime(cond.lastTransitionTime)}
                  </span>
                )}
                <Badge variant={statusVariant(cond.status)} className="shrink-0">
                  {cond.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(p => p - 1)}
                className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 text-sm text-text-muted">Page {page} of {totalPages}</span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(p => p + 1)}
                className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
