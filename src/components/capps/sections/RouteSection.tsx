import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface RouteSectionProps {
  control: Control<CappFormValues>;
  watch?: (name: keyof CappFormValues) => unknown;
}

const tlsOptions = [
  { value: '__none__', label: 'Not set' },
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
];

export const RouteSection: React.FC<RouteSectionProps> = ({ control }) => {
  return (
    <SectionAccordion value="route" title="Route">
      <div className="flex flex-col gap-4">
        <Controller
          name="hostname"
          control={control}
          render={({ field }) => (
            <Input
              label="Hostname"
              placeholder="app.example.com"
              hint="Custom domain for this Capp. Leave empty to use auto-generated."
              {...field}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="tlsEnabled"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">TLS</label>
                <Select
                  value={
                    field.value === true
                      ? 'true'
                      : field.value === false
                      ? 'false'
                      : '__none__'
                  }
                  onValueChange={(v: string) => {
                    if (v === 'true') field.onChange(true);
                    else if (v === 'false') field.onChange(false);
                    else field.onChange(undefined);
                  }}
                >
                  <SelectTrigger className="w-full bg-card border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tlsOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-text-muted">Enable HTTPS for this route</p>
              </div>
            )}
          />
          <Controller
            name="routeTimeoutSeconds"
            control={control}
            render={({ field }) => (
              <Input
                label="Route Timeout (seconds)"
                type="number"
                placeholder="60"
                hint="Request timeout in seconds"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            )}
          />
        </div>
      </div>
    </SectionAccordion>
  );
};
