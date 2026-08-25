import React, { useState } from 'react';
import { InfoIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { QuotaInfo } from '@/api/namespaces';

interface NamespaceQuotaBarProps {
  quota: QuotaInfo;
}

/** Parse a K8s resource quantity string into a comparable number. CPU → cores, memory → MiB. */
export function parseResource(value: string | undefined): number | null {
  if (!value) return null;
  const str = value.trim();
  if (str.endsWith('m')) return parseFloat(str) / 1000;
  if (str.endsWith('Mi')) return parseFloat(str);
  if (str.endsWith('Gi')) return parseFloat(str) * 1024;
  if (str.endsWith('Ki')) return parseFloat(str) / 1024;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

export function quotaPercentage(used: string | undefined, limit: string | undefined): number | null {
  const u = parseResource(used);
  const l = parseResource(limit);
  if (u === null || l === null || l === 0) return null;
  return Math.min(Math.round((u / l) * 100), 100);
}

const QUOTA_TOOLTIP = 'Based on resource requests × max pods, not actual runtime usage.';

function barColor(pct: number): string {
  if (pct >= 90) return 'bg-danger';
  if (pct >= 70) return 'bg-warning';
  return 'bg-primary';
}

interface QuotaRowProps {
  label: string;
  used: string | undefined;
  limit: string | undefined;
  pct: number | null;
}

const QuotaRow: React.FC<QuotaRowProps> = ({ label, used, limit, pct }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-muted">{label}</span>
      <span className="text-[10px] font-mono text-text-secondary">
        {used ?? '0'} / {limit}
      </span>
    </div>
    <div className="h-1 w-full rounded-full bg-border/50 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', pct !== null ? barColor(pct) : 'bg-border')}
        style={{ width: `${pct ?? 0}%` }}
      />
    </div>
  </div>
);

const PodsQuotaRow: React.FC<{ used: number | null | undefined; limit: number | undefined }> = ({ used, limit }) => {
  const u = used ?? 0;
  const pct = limit && limit > 0 ? Math.min(Math.round((u / limit) * 100), 100) : null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">Pods</span>
        <span className="text-[10px] font-mono text-text-secondary">
          {u} / {limit}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-border/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', pct !== null ? barColor(pct) : 'bg-border')}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
};

export const NamespaceQuotaBar: React.FC<NamespaceQuotaBarProps> = ({ quota }) => {
  const hasCpu = Boolean(quota.cpu);
  const hasMemory = Boolean(quota.memory);
  const hasPods = quota.pods != null;

  if (!hasCpu && !hasMemory && !hasPods) return null;

  const cpuPct = quotaPercentage(quota.used?.cpu, quota.cpu);
  const memPct = quotaPercentage(quota.used?.memory, quota.memory);
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 mt-1.5 px-0.5">
      <div className="flex items-center gap-1 relative">
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">
          Allocated
        </span>
        <button
          type="button"
          className="text-text-muted hover:text-text transition-colors"
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          aria-label="Quota info"
        >
          <InfoIcon size={10} />
        </button>
        {showTip && (
          <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded border border-border bg-card px-2 py-1.5 text-[10px] text-text-muted shadow-lg">
            {QUOTA_TOOLTIP}
          </div>
        )}
      </div>
      {hasCpu && (
        <QuotaRow label="CPU" used={quota.used?.cpu} limit={quota.cpu} pct={cpuPct} />
      )}
      {hasMemory && (
        <QuotaRow label="Memory" used={quota.used?.memory} limit={quota.memory} pct={memPct} />
      )}
      {hasPods && (
        <PodsQuotaRow used={quota.used?.pods} limit={quota.pods!} />
      )}
    </div>
  );
};
