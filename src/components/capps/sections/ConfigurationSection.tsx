import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues } from '../CappForm';

interface ConfigurationSectionProps {
  control: Control<CappFormValues>;
  errors: FieldErrors<CappFormValues>;
  watch?: (name: keyof CappFormValues) => unknown;
}

export const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  control,
  errors,
}) => {
  return (
    <SectionAccordion value="configuration" title="Configuration">
      <div className="flex flex-col gap-4">
        <Controller
          name="image"
          control={control}
          render={({ field }) => (
            <Input
              label="Container Image"
              required
              placeholder="registry.example.com/org/image:tag"
              error={errors.image?.message}
              {...field}
            />
          )}
        />
        <Controller
          name="containerName"
          control={control}
          render={({ field }) => (
            <Input
              label="Container Name"
              placeholder="my-container"
              hint="Optional. Defaults to the Capp name."
              {...field}
            />
          )}
        />
        <Controller
          name="envVars"
          control={control}
          render={({ field }) => (
            <KeyValueList
              label="Environment Variables"
              value={field.value}
              onChange={field.onChange}
              keyPlaceholder="ENV_VAR_NAME"
              valuePlaceholder="value"
            />
          )}
        />
      </div>
    </SectionAccordion>
  );
};
