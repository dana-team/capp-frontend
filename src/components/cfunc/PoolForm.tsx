import React, { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { Accordion } from '@/components/ui/accordion'
import { Sheet } from '@/components/layout/Sheet'
import { AsideFacts } from '@/components/layout/FormLayout'
import { SectionAccordion } from '@/components/capps/sections/SectionAccordion'
import { useFlavors, usePoolSizes } from '@/hooks/useCfunc'
import { useSecrets } from '@/hooks/useSecrets'
import { useConfigmaps } from '@/hooks/useConfigmaps'
import type { EnvVar } from '@/types/capp'
import type { PoolRequest, PoolResponse } from '@/types/cfunc'
import {
  AddButton, DNS_LABEL, DNS_LABEL_MESSAGE, FormShell, ItemCard, optionalInt, optionalIntMessage,
} from './FormParts'

const envSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    source: z.enum(['literal', 'secretKeyRef', 'configMapKeyRef']),
    value: z.string(),
    refName: z.string(),
    refKey: z.string(),
  })
  .refine((e) => e.source === 'literal' || e.refName !== '', { path: ['refName'], message: 'Select a resource' })
  .refine((e) => e.source === 'literal' || e.refKey !== '', { path: ['refKey'], message: 'Select a key' })

const poolSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(63, 'At most 63 characters').regex(DNS_LABEL, DNS_LABEL_MESSAGE),
    flavor: z.string().min(1, 'Flavor is required'),
    size: z.string(),
    poolSize: z.string(),
    env: z.array(envSchema),
    buildImage: z.string(),
    buildCommand: z.string(),
    cpuRequest: z.string(),
    cpuLimit: z.string(),
    memoryRequest: z.string(),
    memoryLimit: z.string(),
  })
  .superRefine((v, ctx) => {
    const message = optionalIntMessage(v.poolSize, 0)
    if (message) ctx.addIssue({ code: 'custom', path: ['poolSize'], message })
  })

export type PoolFormValues = z.infer<typeof poolSchema>

const EMPTY: PoolFormValues = {
  name: '', flavor: '', size: '', poolSize: '', env: [],
  buildImage: '', buildCommand: '', cpuRequest: '', cpuLimit: '', memoryRequest: '', memoryLimit: '',
}

export function poolToFormValues(pool: PoolResponse): PoolFormValues {
  const resources = pool.advanced?.resources
  return {
    name: pool.name,
    flavor: pool.flavor,
    size: pool.size,
    poolSize: String(pool.poolSize),
    env: (pool.env ?? []).map((e) => {
      const secret = e.valueFrom?.secretKeyRef
      const configMap = e.valueFrom?.configMapKeyRef
      const ref = secret ?? configMap
      return {
        name: e.name,
        source: secret ? 'secretKeyRef' : configMap ? 'configMapKeyRef' : 'literal',
        value: e.value ?? '',
        refName: ref?.name ?? '',
        refKey: ref?.key ?? '',
      }
    }),
    buildImage: pool.advanced?.buildImage ?? '',
    buildCommand: pool.advanced?.buildCommand ?? '',
    cpuRequest: resources?.requests?.cpu ?? '',
    cpuLimit: resources?.limits?.cpu ?? '',
    memoryRequest: resources?.requests?.memory ?? '',
    memoryLimit: resources?.limits?.memory ?? '',
  }
}

const quantities = (cpu: string, memory: string) =>
  cpu || memory ? { ...(cpu && { cpu }), ...(memory && { memory }) } : undefined

export function formValuesToPoolRequest(v: PoolFormValues): PoolRequest {
  const requests = quantities(v.cpuRequest.trim(), v.memoryRequest.trim())
  const limits = quantities(v.cpuLimit.trim(), v.memoryLimit.trim())
  const resources = requests || limits ? { ...(requests && { requests }), ...(limits && { limits }) } : undefined
  const buildImage = v.buildImage.trim()
  const buildCommand = v.buildCommand.trim()
  const env: EnvVar[] = v.env.map((e) =>
    e.source === 'literal'
      ? { name: e.name, value: e.value }
      : { name: e.name, valueFrom: { [e.source]: { name: e.refName, key: e.refKey } } },
  )
  return {
    name: v.name,
    flavor: v.flavor,
    ...(v.size && { size: v.size }),
    ...(optionalInt(v.poolSize) !== undefined && { poolSize: optionalInt(v.poolSize) }),
    ...(env.length > 0 && { env }),
    ...((buildImage || buildCommand || resources) && {
      advanced: {
        ...(buildImage && { buildImage }),
        ...(buildCommand && { buildCommand }),
        ...(resources && { resources }),
      },
    }),
  }
}

const SOURCE_OPTIONS = [
  { value: 'literal', label: 'Literal' },
  { value: 'secretKeyRef', label: 'Secret Key' },
  { value: 'configMapKeyRef', label: 'ConfigMap Key' },
]

const withCurrent = (names: string[], current: string) =>
  (current && !names.includes(current) ? [...names, current] : names).map((n) => ({ value: n, label: n }))

const EnvRow: React.FC<{
  index: number
  control: Control<PoolFormValues>
  namespace: string
  onRemove: () => void
}> = ({ index, control, namespace, onRemove }) => {
  const source = useWatch({ control, name: `env.${index}.source` })
  const refName = useWatch({ control, name: `env.${index}.refName` })
  const { data: secrets = [] } = useSecrets(namespace)
  const { data: configMaps = [] } = useConfigmaps(namespace)
  const resources = source === 'secretKeyRef' ? secrets : configMaps
  const keys = Object.keys(resources.find((r) => r.name === refName)?.data ?? {})

  return (
    <ItemCard title={`Env Var ${index + 1}`} onRemove={onRemove}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name={`env.${index}.name`}
          render={({ field, fieldState }) => (
            <Input label="Name" className="font-mono" placeholder="MY_ENV_VAR" error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={control}
          name={`env.${index}.source`}
          render={({ field }) => (
            <SimpleSelect label="Source" options={SOURCE_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      {source === 'literal' ? (
        <Controller
          control={control}
          name={`env.${index}.value`}
          render={({ field }) => <Input label="Value" className="font-mono" placeholder="my-value" {...field} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name={`env.${index}.refName`}
            render={({ field, fieldState }) => (
              <SimpleSelect
                label={source === 'secretKeyRef' ? 'Secret' : 'ConfigMap'}
                placeholder="Select…"
                options={withCurrent(resources.map((r) => r.name), field.value)}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name={`env.${index}.refKey`}
            render={({ field, fieldState }) => (
              <SimpleSelect
                label="Key"
                placeholder="Select…"
                options={withCurrent(keys, field.value)}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                disabled={!refName}
              />
            )}
          />
        </div>
      )}
    </ItemCard>
  )
}

interface PoolFormProps {
  initialValues?: PoolFormValues
  onSubmit: (values: PoolFormValues) => Promise<void>
  isLoading?: boolean
  error?: string
  submitLabel: string
  isEdit?: boolean
  onCancel: () => void
  namespace: string
}

export const PoolForm: React.FC<PoolFormProps> = ({
  initialValues, onSubmit, isLoading, error, submitLabel, isEdit, onCancel, namespace,
}) => {
  const { register, control, handleSubmit, formState: { errors } } = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: initialValues ?? EMPTY,
  })
  const env = useFieldArray({ control, name: 'env' })
  const flavor = useWatch({ control, name: 'flavor' })
  const size = useWatch({ control, name: 'size' })
  const poolSize = useWatch({ control, name: 'poolSize' })

  const { data: flavors = [], error: flavorsError } = useFlavors()
  const { data: sizes = [] } = usePoolSizes()

  const hasAdvanced = Boolean(
    initialValues &&
      (initialValues.buildImage || initialValues.buildCommand || initialValues.cpuRequest ||
        initialValues.cpuLimit || initialValues.memoryRequest || initialValues.memoryLimit),
  )
  const [openSections, setOpenSections] = useState<string[]>(
    ['environment', ...(hasAdvanced ? ['advanced'] : [])],
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormShell
        aside={
          <AsideFacts
            title="Details"
            facts={[
              ['Namespace', namespace || '-'],
              ['Flavor', flavor || '-'],
              ['Size', size || 'default'],
              ['Warm pods', poolSize || 'default'],
            ]}
            note="Warm pods of one runtime"
          />
        }
        error={error ?? (flavorsError ? `Failed to load flavors: ${(flavorsError as Error).message}` : undefined)}
        actions={
          <>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" loading={isLoading}>{submitLabel}</Button>
          </>
        }
      >
        <Sheet as="section" className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Input
            label="Name"
            required
            disabled={isEdit}
            className="font-mono"
            error={errors.name?.message}
            placeholder="python-pool"
            {...register('name')}
          />
          <Controller
            control={control}
            name="flavor"
            render={({ field }) => (
              <SimpleSelect
                label="Flavor"
                required
                placeholder="Select a runtime…"
                options={withCurrent(flavors, field.value)}
                value={field.value}
                onChange={field.onChange}
                error={errors.flavor?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="size"
            render={({ field }) => (
              <SimpleSelect
                label="Size"
                options={[{ value: '', label: 'Backend default' }, ...withCurrent(sizes, field.value)]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Warm pods"
            type="number"
            min={0}
            placeholder="3"
            error={errors.poolSize?.message}
            {...register('poolSize')}
          />
        </Sheet>

        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="flex flex-col gap-4">
          <SectionAccordion value="environment" title="Environment variables">
            <div className="flex flex-col gap-3">
              {env.fields.map((field, index) => (
                <EnvRow
                  key={field.id}
                  index={index}
                  control={control}
                  namespace={namespace}
                  onRemove={() => env.remove(index)}
                />
              ))}
              <AddButton onClick={() => env.append({ name: '', source: 'literal', value: '', refName: '', refKey: '' })}>
                Add env var
              </AddButton>
            </div>
          </SectionAccordion>

          <SectionAccordion value="advanced" title="Advanced">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Build image"
                  className="font-mono"
                  placeholder="registry.example.com/builder:tag"
                  {...register('buildImage')}
                />
                <Input
                  label="Build command"
                  className="font-mono"
                  placeholder="build"
                  {...register('buildCommand')}
                />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-text-secondary">Custom resources</span>
                <p className="-mt-2 text-xs text-text-muted">Empty keeps the size value</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="CPU Request" className="font-mono" placeholder="e.g. 100m" {...register('cpuRequest')} />
                  <Input label="CPU Limit" className="font-mono" placeholder="e.g. 500m" {...register('cpuLimit')} />
                  <Input label="Memory Request" className="font-mono" placeholder="e.g. 128Mi" {...register('memoryRequest')} />
                  <Input label="Memory Limit" className="font-mono" placeholder="e.g. 512Mi" {...register('memoryLimit')} />
                </div>
              </div>
            </div>
          </SectionAccordion>
        </Accordion>
      </FormShell>
    </form>
  )
}
