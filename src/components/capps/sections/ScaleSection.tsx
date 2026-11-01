import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface ScaleSectionProps {
  control: Control<CappFormValues>;
}

export const ScaleSection: React.FC<ScaleSectionProps> = ({ control }) => (
  <SectionAccordion value="scale" title="Scale">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>
  </SectionAccordion>
);
