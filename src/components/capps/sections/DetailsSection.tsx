import React from 'react';
import { Control, Controller, useWatch } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, SizingMode } from '../CappForm';
import { useSizes } from '@/hooks/useCapps';
import { parseResource } from '@/components/layout/NamespaceQuotaBar';
import { QuotaInfo } from '@/api/namespaces';
import { cn } from '@/lib/utils';

interface DetailsSectionProps {
  control: Control<CappFormValues>;
  watch?: (name: keyof CappFormValues) => unknown;
  quota?: QuotaInfo;
}

const stateOptions = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

function sizeDescription(sizes: ReturnType<typeof useSizes>['data'], size: string): string | undefined {
  if (!sizes || !size) return undefined;
  const s = sizes[size as keyof typeof sizes];
  if (!s) return undefined;
  return `CPU: ${s.requests.cpu} / ${s.limits.cpu} — Memory: ${s.requests.memory} / ${s.limits.memory}`;
}

function quotaImpact(valueCpu: string | undefined, valueMem: string | undefined, quota: QuotaInfo): { cpu: number | null; memory: number | null } {
  const cpuVal = parseResource(valueCpu);
  const cpuQuota = parseResource(quota.cpu);
  const memVal = parseResource(valueMem);
  const memQuota = parseResource(quota.memory);
  return {
    cpu: cpuVal !== null && cpuQuota !== null && cpuQuota > 0 ? Math.round((cpuVal / cpuQuota) * 100) : null,
    memory: memVal !== null && memQuota !== null && memQuota > 0 ? Math.round((memVal / memQuota) * 100) : null,
  };
}

export const DetailsSection: React.FC<DetailsSectionProps> = ({ control, quota }) => {
  const sizingMode = useWatch({ control, name: 'sizingMode' }) as SizingMode;
  const selectedSize = useWatch({ control, name: 'size' }) as string;
  const cpuLimit = useWatch({ control, name: 'cpuLimit' }) as string;
  const memoryLimit = useWatch({ control, name: 'memoryLimit' }) as string;
  const { data: sizes } = useSizes();

  const impact = (() => {
    if (!quota) return null;
    if (sizingMode === 'preset' && selectedSize && sizes) {
      const s = sizes[selectedSize as keyof typeof sizes];
      if (s) return quotaImpact(s.limits.cpu, s.limits.memory, quota);
    }
    if (sizingMode === 'custom') {
      return quotaImpact(cpuLimit, memoryLimit, quota);
    }
    return null;
  })();

  return (
    <SectionAccordion value="details" title="Details">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="scaleMetric"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Scale Metric</label>
                <Select
                  value={field.value === '' || field.value == null ? '__none__' : field.value as string}
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="w-full bg-card border-border">
                    <SelectValue placeholder="Default (concurrency)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Default (concurrency)</SelectItem>
                    <SelectItem value="concurrency">Concurrency — simultaneous requests</SelectItem>
                    <SelectItem value="cpu">CPU — CPU utilization</SelectItem>
                    <SelectItem value="memory">Memory — memory utilization</SelectItem>
                    <SelectItem value="rps">RPS — requests per second</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-text-muted">Metric used to trigger autoscaling</p>
              </div>
            )}
          />
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">State</label>
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full bg-card border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-text-muted">Enable or disable this Capp</p>
              </div>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="minReplicas"
            control={control}
            render={({ field }) => (
              <Input
                label="Min Replicas"
                type="number"
                min={0}
                placeholder="0"
                hint="Minimum number of replicas (0 = scale to zero)"
                value={field.value ?? ''}
                onChange={(e) => { const n = Number(e.target.value); field.onChange(e.target.value === '' || isNaN(n) ? undefined : n); }}
              />
            )}
          />
          <Controller
            name="maxReplicas"
            control={control}
            render={({ field }) => (
              <Input
                label="Max Replicas"
                type="number"
                min={1}
                placeholder="Unlimited"
                hint="Maximum number of replicas"
                value={field.value ?? ''}
                onChange={(e) => { const n = Number(e.target.value); field.onChange(e.target.value === '' || isNaN(n) ? undefined : n); }}
              />
            )}
          />
          <Controller
            name="scaleDelaySeconds"
            control={control}
            render={({ field }) => (
              <Input
                label="Scale Delay (seconds)"
                type="number"
                min={0}
                placeholder="0"
                hint="Delay before scaling down to zero"
                value={field.value ?? ''}
                onChange={(e) => { const n = Number(e.target.value); field.onChange(e.target.value === '' || isNaN(n) ? undefined : n); }}
              />
            )}
          />
        </div>

        {/* Resource sizing — preset or custom */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-text-secondary">Resources</label>
          <Controller
            name="sizingMode"
            control={control}
            render={({ field }) => (
              <div className="flex gap-1 rounded-lg bg-surface border border-border p-1 w-fit">
                {([
                  { value: 'preset', label: 'Preset size' },
                  { value: 'custom', label: 'Custom' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                      field.value === opt.value
                        ? 'bg-card text-text shadow-sm'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />

          {sizingMode === 'preset' ? (
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="size"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      value={field.value === '' || field.value == null ? '__none__' : field.value as string}
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="w-full bg-card border-border">
                        <SelectValue placeholder="None (no preset)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (no preset)</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-text-muted">
                      {sizeDescription(sizes, selectedSize) ?? 'Container resource preset (CPU + memory requests/limits)'}
                    </p>
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="cpuRequest"
                control={control}
                render={({ field }) => (
                  <Input label="CPU Request" placeholder="e.g. 100m" hint="Minimum CPU allocation" {...field} />
                )}
              />
              <Controller
                name="cpuLimit"
                control={control}
                render={({ field }) => (
                  <Input label="CPU Limit" placeholder="e.g. 500m" hint="Maximum CPU allocation" {...field} />
                )}
              />
              <Controller
                name="memoryRequest"
                control={control}
                render={({ field }) => (
                  <Input label="Memory Request" placeholder="e.g. 128Mi" hint="Minimum memory allocation" {...field} />
                )}
              />
              <Controller
                name="memoryLimit"
                control={control}
                render={({ field }) => (
                  <Input label="Memory Limit" placeholder="e.g. 512Mi" hint="Maximum memory allocation" {...field} />
                )}
              />
            </div>
          )}

          {impact && (impact.cpu !== null || impact.memory !== null) && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface/50 px-3 py-2 text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Quota impact:</span>
              {impact.cpu !== null && (
                <span>
                  CPU{' '}
                  <span className={cn('font-mono font-medium', impact.cpu >= 80 ? 'text-danger' : impact.cpu >= 50 ? 'text-warning' : 'text-text')}>
                    ~{impact.cpu}%
                  </span>
                </span>
              )}
              {impact.memory !== null && (
                <span>
                  Memory{' '}
                  <span className={cn('font-mono font-medium', impact.memory >= 80 ? 'text-danger' : impact.memory >= 50 ? 'text-warning' : 'text-text')}>
                    ~{impact.memory}%
                  </span>
                </span>
              )}
              <span className="text-text-muted/60">of namespace limit</span>
            </div>
          )}
        </div>
      </div>
    </SectionAccordion>
  );
};
