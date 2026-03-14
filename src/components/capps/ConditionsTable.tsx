import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Capp, FlatCondition } from '@/types/capp';
import { relativeTime } from '@/utils/time';

interface ConditionsTableProps {
  capp: Capp;
}

function flattenConditions(capp: Capp): FlatCondition[] {
  const conditions: FlatCondition[] = [];

  const addConditions = (
    source: string,
    conds: Array<{ type: string; status: 'True' | 'False' | 'Unknown'; lastTransitionTime?: string; reason?: string; message?: string }> | undefined
  ) => {
    if (!conds) return;
    for (const c of conds) {
      conditions.push({
        source,
        type: c.type,
        status: c.status,
        lastTransitionTime: c.lastTransitionTime,
        reason: c.reason,
        message: c.message,
      });
    }
  };

  addConditions('Knative', capp.status?.knativeObjectStatus?.conditions);
  addConditions('Logging', capp.status?.loggingStatus?.conditions);
  addConditions(
    'Certificate',
    capp.status?.routeStatus?.certificateObjectStatus?.conditions
  );
  addConditions(
    'DNS',
    capp.status?.routeStatus?.dnsRecordObjectStatus?.cnameRecordObjectStatus?.conditions
  );
  addConditions(
    'Domain Mapping',
    capp.status?.routeStatus?.domainMappingObjectStatus?.conditions
  );

  return conditions;
}

const PAGE_SIZE = 9;

const statusVariant = (status: string): 'success' | 'danger' | 'default' => {
  if (status === 'True') return 'success';
  if (status === 'False') return 'danger';
  return 'default';
};

export const ConditionsTable: React.FC<ConditionsTableProps> = ({ capp }) => {
  const [page, setPage] = useState(1);

  const conditions = flattenConditions(capp);

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
      <div className="grid grid-cols-3 gap-3">
        {paginated.map((cond, i) => (
          <div
            key={`${cond.source}-${cond.type}-${i}`}
            className={cn(
              'rounded-lg border p-3',
              cond.status === 'True'  ? 'border-success/20 bg-success/5' :
              cond.status === 'False' ? 'border-danger/20  bg-danger/5' :
                                        'border-border      bg-card',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                cond.status === 'True'  ? 'bg-success' :
                cond.status === 'False' ? 'bg-danger' :
                                          'bg-text-muted',
              )} />
              <span className="text-sm font-semibold text-text">{cond.type}</span>
              <Badge variant={statusVariant(cond.status)} className="ml-auto">{cond.status}</Badge>
            </div>
            <p className="text-xs text-text-muted">{cond.source}</p>
            {cond.reason && <p className="text-xs text-text-secondary mt-1">{cond.reason}</p>}
            {cond.lastTransitionTime && (
              <p className="text-xs text-text-muted mt-1">{relativeTime(cond.lastTransitionTime)}</p>
            )}
          </div>
        ))}
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
