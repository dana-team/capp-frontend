import React from 'react';
import { Control, Controller, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface LogSectionProps {
  control: Control<CappFormValues>;
}

const logTypeOptions = [
  { value: 'elastic', label: 'Elasticsearch' },
  { value: 'elastic-datastream', label: 'Elasticsearch Data Stream' },
];

export const LogSection: React.FC<LogSectionProps> = ({ control }) => {
  const logType = useWatch({ control, name: 'logType' });

  return (
    <SectionAccordion value="log" title="Logging">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Log Type</label>
          <Controller
            name="logType"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger className="w-full bg-card border-border">
                  <SelectValue placeholder="Select log type..." />
                </SelectTrigger>
                <SelectContent>
                  {logTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="logHost"
            control={control}
            render={({ field }) => (
              <Input
                label="Host"
                placeholder="elastic.example.com"
                hint="Hostname only, without scheme or port"
                {...field}
              />
            )}
          />
          <Controller
            name="logTarget"
            control={control}
            render={({ field }) => (
              <Input
                label="Target"
                placeholder="app-logs"
                hint={
                  logType === 'elastic-datastream'
                    ? 'Name of the data stream to write logs to'
                    : 'Name of the index to write logs to'
                }
                {...field}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="logPasswordKey"
            control={control}
            render={({ field }) => (
              <Input
                label="Password Secret Key"
                placeholder="password"
                hint="Key within the Secret holding the password"
                {...field}
              />
            )}
          />
        </div>
      </div>
    </SectionAccordion>
  );
};
