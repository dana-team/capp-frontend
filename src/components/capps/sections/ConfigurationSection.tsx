import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
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
import { DOCKER_CONFIG_JSON_TYPE } from '@/utils/dockerConfig';

interface ConfigurationSectionProps {
  control: Control<CappFormValues>;
  errors: FieldErrors<CappFormValues>;
  namespace: string;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
}

const NO_PULL_SECRET = '__none__';

const ImagePullSecretField: React.FC<{
  namespace: string;
  secrets: SecretResponse[];
  secretsLoaded: boolean;
  value: string[];
  onChange: (value: string[]) => void;
}> = ({ namespace, secrets, secretsLoaded, value, onChange }) => {
  const options = useMemo(
    () => secrets.filter((s) => s.type === DOCKER_CONFIG_JSON_TYPE).map((s) => s.name),
    [secrets],
  );
  // The dropdown edits the first entry; extra entries (e.g. set via kubectl) are kept
  // unless "None" is chosen, which clears the list.
  const selected = value[0] ?? '';
  const extra = value.slice(1);
  const missing = Boolean(selected) && secretsLoaded && !options.includes(selected);

  // When the namespace changes (create flow), drop references that don't exist there.
  const prevNamespace = useRef(namespace);
  useEffect(() => {
    if (prevNamespace.current === namespace || !secretsLoaded) return;
    prevNamespace.current = namespace;
    const kept = value.filter((name) => options.includes(name));
    if (kept.length !== value.length) onChange(kept);
  }, [namespace, secretsLoaded, value, options, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">Image Pull Secret</label>
      <Select
        value={selected || NO_PULL_SECRET}
        onValueChange={(v) => onChange(v === NO_PULL_SECRET ? [] : [v, ...extra])}
      >
        <SelectTrigger className={`bg-card border-border${missing ? ' border-danger' : ''}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PULL_SECRET}>None (public image)</SelectItem>
          {options.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
          {selected && !options.includes(selected) && (
            <SelectItem value={selected}>{selected}{missing ? ' (not found)' : ''}</SelectItem>
          )}
        </SelectContent>
      </Select>
      {missing ? (
        <p className="text-xs text-danger">
          No image pull secret named "{selected}" in {namespace}. Pods will fail to pull the image.
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Needed only for private registries.{' '}
          {secretsLoaded && options.length === 0 && <>No image pull secrets in {namespace}. </>}
          <Link to="/secrets/new?type=imagePull" target="_blank" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      )}
      {extra.length > 0 && (
        <p className="text-xs text-text-muted">Also uses: {extra.join(', ')}</p>
      )}
    </div>
  );
};

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

  const { data: secrets = [], isSuccess: secretsLoaded } = useSecrets(namespace);
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
          name="imagePullSecrets"
          control={control}
          render={({ field }) => (
            <ImagePullSecretField
              namespace={namespace}
              secrets={secrets}
              secretsLoaded={secretsLoaded}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
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
