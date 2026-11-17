import React, { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { usePools } from '@/hooks/useCfunc'
import { useSecrets } from '@/hooks/useSecrets'
import { useConfigmaps } from '@/hooks/useConfigmaps'
import { HTTP_METHODS, type FunctionRequest, type FunctionResponse } from '@/types/cfunc'
import { cn } from '@/lib/utils'
import {
  AddButton, DNS_LABEL, DNS_LABEL_MESSAGE, FormShell, ItemCard, Switch, optionalInt, optionalIntMessage,
} from './FormParts'

const MAX_TRIGGERS = 10
const MAX_OBJECT_NAME = 63

const triggerSchema = z.object({
  name: z.string().min(1, 'Name is required').regex(DNS_LABEL, DNS_LABEL_MESSAGE),
  type: z.enum(['http', 'cron']),
  path: z.string(),
  methods: z.array(z.string()),
  schedule: z.string(),
})

const INT_FIELDS = [
  ['timeoutSeconds', 1, 300],
  ['concurrency', 1, undefined],
  ['requestsPerPod', 1, 1000],
  ['idleTimeoutSeconds', 0, undefined],
  ['retainPods', 0, undefined],
  ['specializationTimeoutSeconds', 1, undefined],
] as const

const functionSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(MAX_OBJECT_NAME, 'At most 63 characters').regex(DNS_LABEL, DNS_LABEL_MESSAGE),
    pool: z.string().min(1, 'Pool is required'),
    sourceUrl: z.string().min(1, 'Repository URL is required').regex(/^https:\/\/\S+$/, 'Must be an https URL'),
    sourceRef: z.string(),
    sourcePath: z.string(),
    build: z.enum(['auto', 'true', 'false']),
    entrypoint: z.string(),
    timeoutSeconds: z.string(),
    secretVolumes: z.array(z.object({ secretName: z.string().min(1, 'Select a Secret') })),
    configMapVolumes: z.array(z.object({ configMapName: z.string().min(1, 'Select a ConfigMap') })),
    triggers: z.array(triggerSchema).max(MAX_TRIGGERS, `At most ${MAX_TRIGGERS} triggers`),
    concurrency: z.string(),
    requestsPerPod: z.string(),
    idleTimeoutSeconds: z.string(),
    onceOnly: z.boolean(),
    retainPods: z.string(),
    specializationTimeoutSeconds: z.string(),
    buildCommand: z.string(),
  })
  .superRefine((v, ctx) => {
    for (const [field, min, max] of INT_FIELDS) {
      const message = optionalIntMessage(v[field], min, max)
      if (message) ctx.addIssue({ code: 'custom', path: [field], message })
    }
    const names = new Set<string>()
    const routes = new Set<string>()
    v.triggers.forEach((t, i) => {
      if (names.has(t.name)) ctx.addIssue({ code: 'custom', path: ['triggers', i, 'name'], message: 'Trigger names must be unique' })
      names.add(t.name)
      if (t.name && `${v.name}-${t.name}`.length > MAX_OBJECT_NAME) {
        ctx.addIssue({
          code: 'custom', path: ['triggers', i, 'name'],
          message: `"${v.name}-${t.name}" is longer than ${MAX_OBJECT_NAME} characters`,
        })
      }
      if (t.type === 'cron' && !t.schedule.trim()) {
        ctx.addIssue({ code: 'custom', path: ['triggers', i, 'schedule'], message: 'Schedule is required' })
      }
      if (t.type !== 'http') return
      const path = t.path.trim()
      if (path && !path.startsWith('/')) {
        ctx.addIssue({ code: 'custom', path: ['triggers', i, 'path'], message: 'Must start with /' })
      }
      for (const method of t.methods.length ? t.methods : ['GET']) {
        const route = `${method} ${path}`
        if (routes.has(route)) {
          ctx.addIssue({
            code: 'custom', path: ['triggers', i, 'path'],
            message: `Another trigger already serves ${method} on this path`,
          })
        }
        routes.add(route)
      }
    })
  })

export type FunctionFormValues = z.infer<typeof functionSchema>

/** Handed from the create page to the edit page when a create saved only part of the function. */
export interface PartialSaveNavState {
  partialSave: string
  values: FunctionFormValues
}

const EMPTY: FunctionFormValues = {
  name: '', pool: '', sourceUrl: '', sourceRef: '', sourcePath: '', build: 'auto', entrypoint: '',
  timeoutSeconds: '', secretVolumes: [], configMapVolumes: [], triggers: [],
  concurrency: '', requestsPerPod: '', idleTimeoutSeconds: '', onceOnly: false, retainPods: '',
  specializationTimeoutSeconds: '', buildCommand: '',
}

const text = (n: number | undefined) => (n === undefined ? '' : String(n))

export function functionToFormValues(fn: FunctionResponse): FunctionFormValues {
  const advanced = fn.advanced
  return {
    name: fn.name,
    pool: fn.pool,
    sourceUrl: fn.source.url,
    sourceRef: fn.source.ref ?? '',
    sourcePath: fn.source.path ?? '',
    build: fn.source.build === undefined ? 'auto' : fn.source.build ? 'true' : 'false',
    entrypoint: fn.entrypoint ?? '',
    timeoutSeconds: text(fn.timeoutSeconds),
    secretVolumes: (fn.secretVolumes ?? []).map((v) => ({ secretName: v.secretName })),
    configMapVolumes: (fn.configMapVolumes ?? []).map((v) => ({ configMapName: v.configMapName })),
    triggers: (fn.triggers ?? []).map((t) => ({
      name: t.name,
      type: t.type,
      path: t.path ?? '',
      methods: t.methods ?? [],
      schedule: t.schedule ?? '',
    })),
    concurrency: text(advanced?.concurrency),
    requestsPerPod: text(advanced?.requestsPerPod),
    idleTimeoutSeconds: text(advanced?.idleTimeoutSeconds),
    onceOnly: advanced?.onceOnly ?? false,
    retainPods: text(advanced?.retainPods),
    specializationTimeoutSeconds: text(advanced?.specializationTimeoutSeconds),
    buildCommand: advanced?.buildCommand ?? '',
  }
}

/** The whole object: PUT replaces a function, so a field left out goes back to its default. */
export function formValuesToFunctionRequest(v: FunctionFormValues): FunctionRequest {
  const advanced = {
    concurrency: optionalInt(v.concurrency),
    requestsPerPod: optionalInt(v.requestsPerPod),
    idleTimeoutSeconds: optionalInt(v.idleTimeoutSeconds),
    onceOnly: v.onceOnly || undefined,
    retainPods: optionalInt(v.retainPods),
    specializationTimeoutSeconds: optionalInt(v.specializationTimeoutSeconds),
    buildCommand: v.buildCommand.trim() || undefined,
  }
  const hasAdvanced = Object.values(advanced).some((x) => x !== undefined)
  return {
    name: v.name,
    pool: v.pool,
    source: {
      url: v.sourceUrl.trim(),
      ref: v.sourceRef.trim() || undefined,
      path: v.sourcePath.trim() || undefined,
      build: v.build === 'auto' ? undefined : v.build === 'true',
    },
    entrypoint: v.entrypoint.trim() || undefined,
    timeoutSeconds: optionalInt(v.timeoutSeconds),
    secretVolumes: v.secretVolumes.length ? v.secretVolumes : undefined,
    configMapVolumes: v.configMapVolumes.length ? v.configMapVolumes : undefined,
    triggers: v.triggers.map((t) =>
      t.type === 'http'
        ? {
            name: t.name,
            type: t.type,
            path: t.path.trim() || undefined,
            methods: t.methods.length ? t.methods : undefined,
          }
        : { name: t.name, type: t.type, schedule: t.schedule.trim() },
    ),
    advanced: hasAdvanced ? advanced : undefined,
  }
}

const BUILD_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'true', label: 'Build' },
  { value: 'false', label: 'No build' },
]

const TRIGGER_TYPES = [
  { value: 'http', label: 'HTTP' },
  { value: 'cron', label: 'Cron' },
]

const withCurrent = (names: string[], current: string, missingNote = ' (not found)') => [
  ...names.map((n) => ({ value: n, label: n })),
  ...(current && !names.includes(current) ? [{ value: current, label: `${current}${missingNote}` }] : []),
]

const TriggerCard: React.FC<{
  index: number
  control: Control<FunctionFormValues>
  namespace: string
  functionName: string
  onRemove: () => void
}> = ({ index, control, namespace, functionName, onRemove }) => {
  const type = useWatch({ control, name: `triggers.${index}.type` })
  const path = useWatch({ control, name: `triggers.${index}.path` })
  return (
    <ItemCard title={`Trigger ${index + 1}`} onRemove={onRemove}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name={`triggers.${index}.name`}
          render={({ field, fieldState }) => (
            <Input label="Name" className="font-mono" placeholder="api" error={fieldState.error?.message} {...field} />
          )}
        />
        <Controller
          control={control}
          name={`triggers.${index}.type`}
          render={({ field }) => (
            <SimpleSelect label="Type" options={TRIGGER_TYPES} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      {type === 'http' ? (
        <>
          <Controller
            control={control}
            name={`triggers.${index}.path`}
            render={({ field, fieldState }) => (
              <Input
                label="Path"
                className="font-mono"
                placeholder="/items"
                error={fieldState.error?.message}
                hint={`Served at /${namespace}/${functionName || '<function>'}${path.trim()}`}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name={`triggers.${index}.methods`}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-secondary">Methods</span>
                <div className="flex flex-wrap gap-1.5">
                  {HTTP_METHODS.map((method) => {
                    const on = field.value.includes(method)
                    return (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          field.onChange(on ? field.value.filter((m) => m !== method) : [...field.value, method])
                        }
                        className={cn(
                          'rounded border px-2 py-1 font-mono text-xs transition-colors',
                          on
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-text-muted hover:border-text/40 hover:text-text',
                        )}
                      >
                        {method}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          />
        </>
      ) : (
        <Controller
          control={control}
          name={`triggers.${index}.schedule`}
          render={({ field, fieldState }) => (
            <Input
              label="Schedule"
              className="font-mono"
              placeholder="*/5 * * * *"
              error={fieldState.error?.message}
              hint="Cron line or @every 5m"
              {...field}
            />
          )}
        />
      )}
    </ItemCard>
  )
}

interface FunctionFormProps {
  initialValues?: FunctionFormValues
  onSubmit: (values: FunctionFormValues) => Promise<void>
  isLoading?: boolean
  error?: string
  notice?: string
  submitLabel: string
  isEdit?: boolean
  onCancel: () => void
  namespace: string
}

export const FunctionForm: React.FC<FunctionFormProps> = ({
  initialValues, onSubmit, isLoading, error, notice, submitLabel, isEdit, onCancel, namespace,
}) => {
  const { register, control, handleSubmit, formState: { errors } } = useForm<FunctionFormValues>({
    resolver: zodResolver(functionSchema),
    defaultValues: initialValues ?? EMPTY,
  })
  const triggers = useFieldArray({ control, name: 'triggers' })
  const secretVolumes = useFieldArray({ control, name: 'secretVolumes' })
  const configMapVolumes = useFieldArray({ control, name: 'configMapVolumes' })
  const name = useWatch({ control, name: 'name' })
  const pool = useWatch({ control, name: 'pool' })

  const { data: pools, error: poolsError } = usePools(namespace)
  const { data: secrets = [] } = useSecrets(namespace)
  const { data: configMaps = [] } = useConfigmaps(namespace)
  const selectedPool = pools?.find((p) => p.name === pool)
  const noPools = pools !== undefined && pools.length === 0

  const hasAdvanced = Boolean(
    initialValues &&
      (initialValues.concurrency || initialValues.requestsPerPod || initialValues.idleTimeoutSeconds ||
        initialValues.onceOnly || initialValues.retainPods || initialValues.specializationTimeoutSeconds ||
        initialValues.buildCommand),
  )
  const [openSections, setOpenSections] = useState<string[]>([
    'source', 'triggers',
    ...(initialValues?.secretVolumes.length || initialValues?.configMapVolumes.length ? ['volumes'] : []),
    ...(hasAdvanced ? ['advanced'] : []),
  ])
  const openInvalid = () =>
    setOpenSections((open) => [...new Set([...open, 'source', 'triggers', 'volumes', 'advanced'])])

  const loadError = poolsError ? `Failed to load Pools: ${(poolsError as Error).message}` : undefined

  return (
    <form onSubmit={handleSubmit(onSubmit, openInvalid)}>
      <FormShell
        aside={
          <AsideFacts
            title="Details"
            facts={[
              ['Namespace', namespace || '-'],
              ['Pool', pool || '-'],
              ['Flavor', selectedPool?.flavor || '-'],
              ['Triggers', String(triggers.fields.length)],
            ]}
            note="Save can take one minute"
          />
        }
        error={error ?? loadError}
        notice={notice}
        actions={
          <>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
            <Button type="submit" loading={isLoading}>{isLoading ? 'Cloning and saving…' : submitLabel}</Button>
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
            placeholder="hello"
            {...register('name')}
          />
          <Controller
            control={control}
            name="pool"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <SimpleSelect
                  label="Pool"
                  required
                  placeholder="Select a Pool…"
                  options={withCurrent((pools ?? []).map((p) => p.name), field.value)}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pool?.message}
                />
                {noPools && (
                  <p className="text-xs text-warning">
                    No Pool in this namespace.{' '}
                    <Link to="/pools/new" className="text-primary hover:underline">Create one</Link>
                  </p>
                )}
              </div>
            )}
          />
          <Input
            label="Entrypoint"
            className="font-mono"
            placeholder="main"
            {...register('entrypoint')}
          />
          <Input
            label="Timeout (seconds)"
            type="number"
            min={1}
            placeholder="60"
            error={errors.timeoutSeconds?.message}
            {...register('timeoutSeconds')}
          />
        </Sheet>

        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="flex flex-col gap-4">
          <SectionAccordion value="source" title="Source">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Repository URL"
                  required
                  className="font-mono"
                  placeholder="https://git.example.com/team/functions"
                  error={errors.sourceUrl?.message}
                  {...register('sourceUrl')}
                />
              </div>
              <Input
                label="Ref"
                className="font-mono"
                placeholder="main"
                hint="Branch, tag or commit"
                {...register('sourceRef')}
              />
              <Input
                label="Path"
                className="font-mono"
                placeholder="functions/hello"
                hint="Folder or file path"
                {...register('sourcePath')}
              />
              <Controller
                control={control}
                name="build"
                render={({ field }) => (
                  <SimpleSelect
                    label="Build"
                    options={BUILD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </SectionAccordion>

          <SectionAccordion value="triggers" title="Triggers">
            <div className="flex flex-col gap-3">
              {triggers.fields.map((field, index) => (
                <TriggerCard
                  key={field.id}
                  index={index}
                  control={control}
                  namespace={namespace}
                  functionName={name}
                  onRemove={() => triggers.remove(index)}
                />
              ))}
              {errors.triggers?.root?.message && <p className="text-xs text-danger">{errors.triggers.root.message}</p>}
              <div className="flex flex-wrap gap-2">
                <AddButton
                  disabled={triggers.fields.length >= MAX_TRIGGERS}
                  onClick={() => triggers.append({ name: '', type: 'http', path: '', methods: ['GET'], schedule: '' })}
                >
                  Add HTTP trigger
                </AddButton>
                <AddButton
                  disabled={triggers.fields.length >= MAX_TRIGGERS}
                  onClick={() => triggers.append({ name: '', type: 'cron', path: '', methods: [], schedule: '' })}
                >
                  Add cron trigger
                </AddButton>
              </div>
            </div>
          </SectionAccordion>

          <SectionAccordion value="volumes" title="Secrets and ConfigMaps">
            <div className="flex flex-col gap-6">
              <p className="text-xs text-text-muted">
                Mounted under /secrets and /configs
              </p>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Secrets</span>
                {secretVolumes.fields.map((field, index) => (
                  <ItemCard key={field.id} title={`Secret ${index + 1}`} onRemove={() => secretVolumes.remove(index)}>
                    <Controller
                      control={control}
                      name={`secretVolumes.${index}.secretName`}
                      render={({ field: f, fieldState }) => (
                        <SimpleSelect
                          placeholder="Select a Secret…"
                          options={withCurrent(secrets.map((s) => s.name), f.value)}
                          value={f.value}
                          onChange={f.onChange}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  </ItemCard>
                ))}
                <AddButton onClick={() => secretVolumes.append({ secretName: '' })}>Add Secret</AddButton>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">ConfigMaps</span>
                {configMapVolumes.fields.map((field, index) => (
                  <ItemCard key={field.id} title={`ConfigMap ${index + 1}`} onRemove={() => configMapVolumes.remove(index)}>
                    <Controller
                      control={control}
                      name={`configMapVolumes.${index}.configMapName`}
                      render={({ field: f, fieldState }) => (
                        <SimpleSelect
                          placeholder="Select a ConfigMap…"
                          options={withCurrent(configMaps.map((c) => c.name), f.value)}
                          value={f.value}
                          onChange={f.onChange}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  </ItemCard>
                ))}
                <AddButton onClick={() => configMapVolumes.append({ configMapName: '' })}>Add ConfigMap</AddButton>
              </div>
            </div>
          </SectionAccordion>

          <SectionAccordion value="advanced" title="Advanced">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Concurrency" type="number" min={1} placeholder="500"
                error={errors.concurrency?.message}
                {...register('concurrency')}
              />
              <Input
                label="Requests per pod" type="number" min={1} placeholder="1"
                error={errors.requestsPerPod?.message}
                {...register('requestsPerPod')}
              />
              <Input
                label="Idle timeout (seconds)" type="number" min={0} placeholder="120"
                error={errors.idleTimeoutSeconds?.message}
                {...register('idleTimeoutSeconds')}
              />
              <Input
                label="Retain pods" type="number" min={0} placeholder="0"
                error={errors.retainPods?.message}
                {...register('retainPods')}
              />
              <Input
                label="Specialization timeout (seconds)" type="number" min={1} placeholder="120"
                error={errors.specializationTimeoutSeconds?.message}
                {...register('specializationTimeoutSeconds')}
              />
              <Input
                label="Build command"
                className="font-mono"
                placeholder="build"
                {...register('buildCommand')}
              />
              <div className="sm:col-span-2">
                <Controller
                  control={control}
                  name="onceOnly"
                  render={({ field }) => (
                    <Switch
                      id="once-only"
                      checked={field.value}
                      onChange={field.onChange}
                      label="One request per pod"
                      hint="One request, then stops"
                    />
                  )}
                />
              </div>
            </div>
          </SectionAccordion>
        </Accordion>
      </FormShell>
    </form>
  )
}
