import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface DetailsSectionProps {
  control: Control<CappFormValues>;
  watch?: (name: keyof CappFormValues) => unknown;
}

const stateOptions = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

export const DetailsSection: React.FC<DetailsSectionProps> = ({ control }) => {
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
      </div>
    </SectionAccordion>
  );
};
