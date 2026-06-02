import React from 'react';
import { Control, Controller, FieldErrors, useWatch } from 'react-hook-form';
import { Plus, Trash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, EnvVarFormEntry, EnvVarSource } from '../CappForm';
import { useSecrets } from '@/hooks/useSecrets';
import { useConfigmaps } from '@/hooks/useConfigmaps';
import type { SecretResponse } from '@/types/secret';
import type { ConfigMapResponse } from '@/types/configmap';

interface ConfigurationSectionProps {
  control: Control<CappFormValues>;
  errors: FieldErrors<CappFormValues>;
  namespace: string;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
}

const emptyEnvVar = (): EnvVarFormEntry => ({
  name: '',
  source: 'literal',
  value: '',
  refName: '',
  refKey: '',
});

const EnvVarRow: React.FC<{
  index: number;
  control: Control<CappFormValues>;
  secrets: SecretResponse[];
  configMaps: ConfigMapResponse[];
  nameError?: string;
  refNameError?: string;
  refKeyError?: string;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
  onRemove: () => void;
}> = ({ index, control, secrets, configMaps, nameError, refNameError, refKeyError, setValue, onRemove }) => {
  const source = useWatch({ control, name: `envVars.${index}.source` as keyof CappFormValues }) as EnvVarSource;
  const refName = useWatch({ control, name: `envVars.${index}.refName` as keyof CappFormValues }) as string;

  const resourceNames = source === 'secretKeyRef'
    ? secrets.map((s) => s.name)
    : configMaps.map((c) => c.name);

  const resourceKeys = source === 'secretKeyRef'
    ? Object.keys(secrets.find((s) => s.name === refName)?.data ?? {})
    : Object.keys(configMaps.find((c) => c.name === refName)?.data ?? {});

  const handleSourceChange = (newSource: string, onChange: (v: string) => void) => {
    onChange(newSource);
    setValue(`envVars.${index}.refName` as keyof CappFormValues, '');
    setValue(`envVars.${index}.refKey` as keyof CappFormValues, '');
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Env Var {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove env var"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
        >
          <Trash size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Controller
          name={`envVars.${index}.name` as keyof CappFormValues}
          control={control}
          render={({ field }) => (
            <Input
              label="Name"
              placeholder="MY_ENV_VAR"
              error={nameError}
              value={field.value as string}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name={`envVars.${index}.source` as keyof CappFormValues}
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Source</label>
              <Select value={field.value as string} onValueChange={(v) => handleSourceChange(v, field.onChange)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="literal">Literal</SelectItem>
                  <SelectItem value="secretKeyRef">Secret Key</SelectItem>
                  <SelectItem value="configMapKeyRef">ConfigMap Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      {source === 'literal' && (
        <Controller
          name={`envVars.${index}.value` as keyof CappFormValues}
          control={control}
          render={({ field }) => (
            <Input
              label="Value"
              placeholder="my-value"
              value={field.value as string}
              onChange={field.onChange}
            />
          )}
        />
      )}

      {(source === 'secretKeyRef' || source === 'configMapKeyRef') && (
        <div className="grid grid-cols-2 gap-2">
          <Controller
            name={`envVars.${index}.refName` as keyof CappFormValues}
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">
                  {source === 'secretKeyRef' ? 'Secret' : 'ConfigMap'}
                </label>
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <SelectTrigger className={`bg-card border-border${refNameError ? ' border-danger' : ''}`}>
                    <SelectValue placeholder={`Select ${source === 'secretKeyRef' ? 'secret' : 'configmap'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {refNameError && <p className="text-xs text-danger">{refNameError}</p>}
              </div>
            )}
          />
          <Controller
            name={`envVars.${index}.refKey` as keyof CappFormValues}
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Key</label>
                <Select value={field.value as string} onValueChange={field.onChange} disabled={!refName}>
                  <SelectTrigger className={`bg-card border-border${refKeyError ? ' border-danger' : ''}`}>
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceKeys.map((key) => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {refKeyError && <p className="text-xs text-danger">{refKeyError}</p>}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
};

export const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  control,
  errors,
  namespace,
  watch,
  setValue,
}) => {
  const envVars = watch('envVars') as EnvVarFormEntry[];

  const { data: secrets = [] } = useSecrets(namespace);
  const { data: configMaps = [] } = useConfigmaps(namespace);

  const addEnvVar = () => setValue('envVars', [...envVars, emptyEnvVar()]);
  const removeEnvVar = (i: number) => setValue('envVars', envVars.filter((_, idx) => idx !== i));

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

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-secondary">Environment Variables</label>
          {envVars.map((_, index) => (
            <EnvVarRow
              key={index}
              index={index}
              control={control}
              secrets={secrets}
              configMaps={configMaps}
              nameError={(errors.envVars as Array<{ name?: { message?: string }; refName?: { message?: string }; refKey?: { message?: string } }> | undefined)?.[index]?.name?.message}
              refNameError={(errors.envVars as Array<{ name?: { message?: string }; refName?: { message?: string }; refKey?: { message?: string } }> | undefined)?.[index]?.refName?.message}
              refKeyError={(errors.envVars as Array<{ name?: { message?: string }; refName?: { message?: string }; refKey?: { message?: string } }> | undefined)?.[index]?.refKey?.message}
              setValue={setValue}
              onRemove={() => removeEnvVar(index)}
            />
          ))}
          <button
            type="button"
            onClick={addEnvVar}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors w-fit"
          >
            <Plus size={14} />
            Add env var
          </button>
        </div>
      </div>
    </SectionAccordion>
  );
};
