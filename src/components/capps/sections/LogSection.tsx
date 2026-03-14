import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface LogSectionProps {
  control: Control<CappFormValues>;
  watch?: (name: keyof CappFormValues) => unknown;
}

const logTypeOptions = [{ value: 'elastic', label: 'Elasticsearch' }];

export const LogSection: React.FC<LogSectionProps> = ({ control }) => {
  return (
    <SectionAccordion value="log" title="Logging">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Log Type</label>
          <Select value="elastic" onValueChange={() => {}} disabled>
            <SelectTrigger className="w-full bg-card border-border">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {logTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-text-muted">Currently only Elasticsearch is supported</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="logHost"
            control={control}
            render={({ field }) => (
              <Input
                label="Elasticsearch Host"
                placeholder="https://elastic.example.com:9200"
                {...field}
              />
            )}
          />
          <Controller
            name="logIndex"
            control={control}
            render={({ field }) => (
              <Input
                label="Index"
                placeholder="app-logs"
                {...field}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="logUser"
            control={control}
            render={({ field }) => (
              <Input
                label="User"
                placeholder="elastic"
                {...field}
              />
            )}
          />
          <Controller
            name="logPasswordSecret"
            control={control}
            render={({ field }) => (
              <Input
                label="Password Secret Name"
                placeholder="elastic-credentials"
                hint="Name of the Kubernetes Secret containing the password"
                {...field}
              />
            )}
          />
        </div>
      </div>
    </SectionAccordion>
  );
};
