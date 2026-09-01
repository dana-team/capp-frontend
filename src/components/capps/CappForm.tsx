import React, { useState, useEffect } from "react";
import { useForm, Controller, useWatch, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import yaml from "js-yaml";
import { WarningCircleIcon, FileTextIcon, CodeIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { DetailsSection } from "./sections/DetailsSection";
import { ConfigurationSection } from "./sections/ConfigurationSection";
import { RouteSection } from "./sections/RouteSection";
import { LogSection } from "./sections/LogSection";
import { VolumesSection } from "./sections/VolumesSection";
import { EventSourcesSection } from "./sections/EventSourcesSection";
import { buildCappResource, cappToYaml } from "@/utils/cappBuilder";
import { ScaleMetric, CappState, CappSize } from "@/types/capp";
import { CappYamlEditor } from "./CappYamlEditor";
import { useSizes } from "@/hooks/useCapps";
import { parseResource } from "@/components/layout/NamespaceQuotaBar";

export interface NFSVolumeFormValue {
  name: string;
  server: string;
  path: string;
  capacityValue: string;
  capacityUnit: "Mi" | "Gi" | "Ti";
}

export type EnvVarSource = 'literal' | 'secretKeyRef' | 'configMapKeyRef';

export interface EnvVarFormEntry {
  name: string;
  source: EnvVarSource;
  value: string;       // used when source === 'literal'
  refName: string;     // secret or configmap name
  refKey: string;      // key within that secret/configmap
}

export interface SecretVolumeFormValue {
  volumeName: string;
  secretName: string;
  mountPath: string;
}

export interface VolumeMountFormValue {
  volumeName: string;
  mountPath: string;
}

export interface ConfigMapVolumeFormValue {
  volumeName: string;
  configMapName: string;
  mountPath: string;
}

export type LogType = "elastic" | "elastic-datastream";

export type EventSourceType = 'ping' | 'kafka';

export interface EventSourceFormEntry {
  name: string;
  uri: string;
  sourceType: EventSourceType;
  pingSchedule: string;
  pingData: string;
  kafkaBootstrapServers: string;
  kafkaTopics: string;
  kafkaConsumerGroup: string;
  kafkaConsumers?: number;
  kafkaSecretRef: string;
}

export type SizingMode = 'preset' | 'custom';

export interface CappFormValues {
  name: string;
  scaleMetric: ScaleMetric | "";
  minReplicas?: number;
  maxReplicas?: number;
  scaleDelaySeconds?: number;
  state: CappState;
  sizingMode: SizingMode;
  size: CappSize | '';
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  image: string;
  containerName: string;
  envVars: EnvVarFormEntry[];
  hostname: string;
  tlsEnabled?: boolean;
  routeTimeoutSeconds?: number;
  logType: LogType | "";
  logHost: string;
  logIndex: string;
  logUser: string;
  logPasswordSecret: string;
  logPasswordKey: string;
  nfsVolumes: NFSVolumeFormValue[];
  secretVolumes: SecretVolumeFormValue[];
  configMapVolumes: ConfigMapVolumeFormValue[];
  volumeMounts: VolumeMountFormValue[];
  eventSources: EventSourceFormEntry[];
}

const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

const schema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(63, "Name must be 63 characters or less")
    .regex(
      k8sNameRegex,
      "Name must consist of lowercase alphanumeric characters or hyphens, and start/end with an alphanumeric",
    ),
  scaleMetric: z.enum(['concurrency', 'cpu', 'memory', 'rps', '']).optional(),
  minReplicas: z.number().int().min(0).optional(),
  maxReplicas: z.number().int().min(1).optional(),
  scaleDelaySeconds: z.number().int().min(0).optional(),
  state: z.enum(["enabled", "disabled"]).default("enabled"),
  sizingMode: z.enum(['preset', 'custom']).default('preset'),
  size: z.enum(['small', 'medium', 'large', '']).optional(),
  cpuRequest: z.string().optional().default(''),
  cpuLimit: z.string().optional().default(''),
  memoryRequest: z.string().optional().default(''),
  memoryLimit: z.string().optional().default(''),
  image: z.string().min(1, "Container image is required"),
  containerName: z.string().optional(),
  envVars: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    source: z.enum(['literal', 'secretKeyRef', 'configMapKeyRef']),
    value: z.string(),
    refName: z.string(),
    refKey: z.string(),
  }).superRefine((row, ctx) => {
    if (row.source !== 'literal') {
      if (!row.refName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a resource', path: ['refName'] });
      }
      if (!row.refKey) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a key', path: ['refKey'] });
      }
    }
  })).default([]),
  hostname: z.string().optional(),
  tlsEnabled: z.boolean().optional(),
  routeTimeoutSeconds: z.number().optional(),
  logType: z.enum(["", "elastic", "elastic-datastream"]).optional(),
  logHost: z.string().optional(),
  logIndex: z.string().optional(),
  logUser: z.string().optional(),
  logPasswordSecret: z.string().optional(),
  logPasswordKey: z.string().optional(),
  nfsVolumes: z
    .array(
      z.object({
        name: z.string().min(1, "Name is required"),
        server: z.string().min(1, "Server is required"),
        path: z.string().min(1, "Path is required").regex(/^\//, "Path must start with /"),
        capacityValue: z.string().regex(/^\d+$/, "Capacity must be a number"),
        capacityUnit: z.enum(["Mi", "Gi", "Ti"]),
      }),
    )
    .default([]),
  secretVolumes: z.array(z.object({
    volumeName: z.string().min(1, "Name is required"),
    secretName: z.string().min(1, "Secret is required"),
    mountPath: z.string().min(1, "Mount path is required"),
  })).default([]),
  configMapVolumes: z.array(z.object({
    volumeName: z.string().min(1, "Name is required"),
    configMapName: z.string().min(1, "ConfigMap is required"),
    mountPath: z.string().min(1, "Mount path is required"),
  })).default([]),
  volumeMounts: z.array(z.object({
    volumeName: z.string().min(1, "Name is required"),
    mountPath: z.string().min(1, "Mount path is required"),
  })).default([]),
  eventSources: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    uri: z.string(),
    sourceType: z.enum(['ping', 'kafka']),
    pingSchedule: z.string(),
    pingData: z.string(),
    kafkaBootstrapServers: z.string(),
    kafkaTopics: z.string(),
    kafkaConsumerGroup: z.string(),
    kafkaConsumers: z.number().int().min(1).optional(),
    kafkaSecretRef: z.string(),
  }).superRefine((row, ctx) => {
    if (row.sourceType === 'ping' && !row.pingSchedule) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Schedule is required', path: ['pingSchedule'] });
    }
    if (row.sourceType === 'kafka') {
      if (!row.kafkaBootstrapServers) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bootstrap servers required', path: ['kafkaBootstrapServers'] });
      }
      if (!row.kafkaTopics) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Topics required', path: ['kafkaTopics'] });
      }
      if (!row.kafkaSecretRef) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Secret ref required', path: ['kafkaSecretRef'] });
      }
    }
  })).default([]),
}).superRefine((values, ctx) => {
  if (values.sizingMode === 'custom') {
    if (!values.cpuRequest && !values.cpuLimit && !values.memoryRequest && !values.memoryLimit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one resource field is required', path: ['cpuRequest'] });
    }
  }
  if (values.tlsEnabled && !values.hostname) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Hostname required when TLS enabled', path: ['hostname'] });
  }
  if (values.logType) {
    if (!values.logHost) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Host is required', path: ['logHost'] });
    }
    if (!values.logUser) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'User is required', path: ['logUser'] });
    }
    if (!values.logPasswordSecret) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password secret is required', path: ['logPasswordSecret'] });
    }
    if (!values.logPasswordKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password secret key is required', path: ['logPasswordKey'] });
    }
    if (values.logType === 'elastic' && !values.logIndex) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Index is required for elastic', path: ['logIndex'] });
    }
  }
  // Operator webhook requires every NFS volume to be mounted by a volumeMount.
  const mountedNames = new Set(values.volumeMounts.map((m) => m.volumeName));
  values.nfsVolumes.forEach((v, i) => {
    if (v.name && !mountedNames.has(v.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `NFS volume "${v.name}" must be mounted (add a Volume Mount)`,
        path: ['nfsVolumes', i, 'name'],
      });
    }
  });
});

const defaultValues: CappFormValues = {
  name: "",
  scaleMetric: "",
  minReplicas: undefined,
  maxReplicas: undefined,
  scaleDelaySeconds: undefined,
  state: "enabled",
  sizingMode: 'preset',
  size: '',
  cpuRequest: '',
  cpuLimit: '',
  memoryRequest: '',
  memoryLimit: '',
  image: "",
  containerName: "",
  envVars: [],
  hostname: "",
  tlsEnabled: undefined,
  routeTimeoutSeconds: undefined,
  logType: "",
  logHost: "",
  logIndex: "",
  logUser: "",
  logPasswordSecret: "",
  logPasswordKey: "",
  nfsVolumes: [],
  secretVolumes: [],
  configMapVolumes: [],
  volumeMounts: [],
  eventSources: [],
};

interface CappFormProps {
  initialValues?: Partial<CappFormValues>;
  onSubmit: (values: CappFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
  isEdit?: boolean;
  namespace?: string;
  onCancel?: () => void;
  quota?: import('@/api/namespaces').QuotaInfo;
}

export type Tab = "form" | "yaml";

function computeImpactPct(value: string | undefined, quotaLimit: string | undefined): number | null {
  const v = parseResource(value);
  const q = parseResource(quotaLimit);
  if (v === null || q === null || q === 0) return null;
  return Math.round((v / q) * 100);
}

const QuotaBanner: React.FC<{ quota?: import('@/api/namespaces').QuotaInfo; control: Control<CappFormValues> }> = ({ quota, control }) => {
  const sizingMode = useWatch({ control, name: 'sizingMode' }) as SizingMode;
  const selectedSize = useWatch({ control, name: 'size' }) as string;
  const cpuLimit = useWatch({ control, name: 'cpuLimit' }) as string;
  const memoryLimit = useWatch({ control, name: 'memoryLimit' }) as string;
  const { data: sizes } = useSizes();

  if (!quota || (!quota.cpu && !quota.memory && quota.pods == null)) return null;

  let cpuPct: number | null = null;
  let memPct: number | null = null;

  if (sizingMode === 'preset' && selectedSize && sizes) {
    const s = sizes[selectedSize as keyof typeof sizes];
    if (s) {
      cpuPct = computeImpactPct(s.limits.cpu, quota.cpu);
      memPct = computeImpactPct(s.limits.memory, quota.memory);
    }
  } else if (sizingMode === 'custom') {
    cpuPct = computeImpactPct(cpuLimit, quota.cpu);
    memPct = computeImpactPct(memoryLimit, quota.memory);
  }

  const hasImpact = cpuPct !== null || memPct !== null;

  return (
    <div className="flex items-center gap-4 text-xs text-text-muted rounded-lg border border-border bg-surface px-3 py-2" title="Based on resource requests × max pods, not actual runtime usage">
      <span className="font-medium text-text-secondary">Allocated:</span>
      {quota.cpu && (
        <span>
          CPU{' '}
          <span className="font-mono text-text">{quota.used?.cpu ?? '0'}</span>
          <span className="text-text-muted"> / </span>
          <span className="font-mono text-text">{quota.cpu}</span>
        </span>
      )}
      {quota.memory && (
        <span>
          Memory{' '}
          <span className="font-mono text-text">{quota.used?.memory ?? '0'}</span>
          <span className="text-text-muted"> / </span>
          <span className="font-mono text-text">{quota.memory}</span>
        </span>
      )}
      {quota.pods != null && (
        <span>
          Pods{' '}
          <span className="font-mono text-text">{quota.used?.pods ?? 0}</span>
          <span className="text-text-muted"> / </span>
          <span className="font-mono text-text">{quota.pods}</span>
        </span>
      )}
      {hasImpact && (
        <>
          <span className="text-border">|</span>
          <span className="font-medium text-text-secondary">This Capp:</span>
          {cpuPct !== null && (
            <span>
              CPU{' '}
              <span className={cn('font-mono font-medium', cpuPct >= 80 ? 'text-danger' : cpuPct >= 50 ? 'text-warning' : 'text-text')}>
                ~{cpuPct}%
              </span>
            </span>
          )}
          {memPct !== null && (
            <span>
              Memory{' '}
              <span className={cn('font-mono font-medium', memPct >= 80 ? 'text-danger' : memPct >= 50 ? 'text-warning' : 'text-text')}>
                ~{memPct}%
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
};

export const CappForm: React.FC<CappFormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
  error,
  submitLabel = "Create Capp",
  isEdit = false,
  namespace = "default",
  onCancel,
  quota,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("form");
  const [yamlContent, setYamlContent] = useState("");
  const [yamlError, setYamlError] = useState("");

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<CappFormValues>({
    resolver: zodResolver(schema) as ReturnType<typeof zodResolver>,
    defaultValues: { ...defaultValues, ...initialValues },
  });

  // Sync form -> yaml when switching to yaml tab
  const handleTabChange = (tab: Tab) => {
    if (tab === "yaml") {
      const values = getValues();
      try {
        const capp = buildCappResource(namespace, values);
        setYamlContent(cappToYaml(capp));
        setYamlError("");
      } catch {
        setYamlContent("");
      }
    }
    setActiveTab(tab);
  };

  // Update yaml preview when form changes (if on yaml tab)
  const formValues = watch();
  useEffect(() => {
    if (activeTab === "yaml") {
      try {
        const capp = buildCappResource(namespace, formValues);
        setYamlContent(cappToYaml(capp));
        setYamlError("");
      } catch {
        // ignore
      }
    }
  }, [activeTab, namespace, JSON.stringify(formValues)]);

  const handleYamlChange = (value: string) => {
    setYamlContent(value);
    try {
      const parsed = yaml.load(value) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        // Extract form values from parsed YAML
        const spec = parsed.spec as Record<string, unknown> | undefined;
        if (spec) {
          const containers = (
            (spec.configurationSpec as Record<string, unknown>)
              ?.template as Record<string, unknown>
          )?.spec as Record<string, unknown>;
          const containerList =
            (containers?.containers as Array<Record<string, unknown>>) ?? [];
          const container = containerList[0] ?? {};

          const route = spec.routeSpec as Record<string, unknown> | undefined;
          const log = spec.logSpec as Record<string, unknown> | undefined;
          const volumes = spec.volumesSpec as
            | Record<string, unknown>
            | undefined;
          const scaleSpec = spec.scaleSpec as Record<string, unknown> | undefined;

          const meta = parsed.metadata as Record<string, unknown> | undefined;

          reset({
            name: (meta?.name as string) ?? "",
            scaleMetric: (scaleSpec?.metric as ScaleMetric) ?? "",
            minReplicas: scaleSpec?.minReplicas as number | undefined,
            maxReplicas: scaleSpec?.maxReplicas as number | undefined,
            scaleDelaySeconds: scaleSpec?.scaleDelaySeconds as number | undefined,
            state: (spec.state as CappState) ?? "enabled",
            image: (container.image as string) ?? "",
            containerName: (container.name as string) ?? "",
            envVars: (
              (container.env as Array<{
                name: string;
                value?: string;
                valueFrom?: { secretKeyRef?: { name: string; key: string }; configMapKeyRef?: { name: string; key: string } };
              }>) ?? []
            ).map((e): EnvVarFormEntry => {
              if (e.valueFrom?.secretKeyRef) {
                return { name: e.name, source: 'secretKeyRef', value: '', refName: e.valueFrom.secretKeyRef.name, refKey: e.valueFrom.secretKeyRef.key };
              }
              if (e.valueFrom?.configMapKeyRef) {
                return { name: e.name, source: 'configMapKeyRef', value: '', refName: e.valueFrom.configMapKeyRef.name, refKey: e.valueFrom.configMapKeyRef.key };
              }
              return { name: e.name, source: 'literal', value: e.value ?? '', refName: '', refKey: '' };
            }),
            hostname: (route?.hostname as string) ?? "",
            tlsEnabled: route?.tlsEnabled as boolean | undefined,
            routeTimeoutSeconds: route?.routeTimeoutSeconds as
              | number
              | undefined,
            logType:
              log?.type === "elastic" || log?.type === "elastic-datastream"
                ? log.type
                : "",
            logHost: (log?.host as string) ?? "",
            logIndex: (log?.index as string) ?? "",
            logUser: (log?.user as string) ?? "",
            logPasswordSecret: (log?.passwordSecret as string) ?? "",
            logPasswordKey: (log?.passwordKey as string) ?? "",
            nfsVolumes: (
              (volumes?.nfsVolumes as Array<Record<string, unknown>>) ?? []
            ).map((v) => {
              const storage =
                (v.capacity as Record<string, string>)?.storage ?? "1Gi";
              const match = storage.match(/^(\d+)(Mi|Gi|Ti)$/);
              return {
                name: v.name as string,
                server: v.server as string,
                path: v.path as string,
                capacityValue: match ? match[1] : "1",
                capacityUnit: (match ? match[2] : "Gi") as "Mi" | "Gi" | "Ti",
              };
            }),
            secretVolumes: (
              (volumes?.secretVolumes as Array<{ name: string; secretName: string; mountPath: string }>) ?? []
            ).map((v): SecretVolumeFormValue => ({
              volumeName: v.name,
              secretName: v.secretName,
              mountPath: v.mountPath,
            })),
            configMapVolumes: (
              (volumes?.configMapVolumes as Array<{ name: string; configMapName: string; mountPath: string }>) ?? []
            ).map((v): ConfigMapVolumeFormValue => ({
              volumeName: v.name,
              configMapName: v.configMapName,
              mountPath: v.mountPath,
            })),
            volumeMounts: (
              (container.volumeMounts as Array<{ name: string; mountPath: string }>) ?? []
            ).map((v): VolumeMountFormValue => ({
              volumeName: v.name,
              mountPath: v.mountPath,
            })),
            sizingMode: spec.size ? 'preset' : (container.resources ? 'custom' : 'preset'),
            size: (spec.size as CappSize | '') ?? '',
            cpuRequest: ((container.resources as Record<string, Record<string, string>> | undefined)?.requests?.cpu) ?? '',
            cpuLimit: ((container.resources as Record<string, Record<string, string>> | undefined)?.limits?.cpu) ?? '',
            memoryRequest: ((container.resources as Record<string, Record<string, string>> | undefined)?.requests?.memory) ?? '',
            memoryLimit: ((container.resources as Record<string, Record<string, string>> | undefined)?.limits?.memory) ?? '',
            eventSources: [],
          });
        }
        setYamlError("");
      }
    } catch (e) {
      setYamlError((e as Error).message);
    }
  };

  const handleFormSubmit = async () => {
    const values = getValues();
    await onSubmit(values);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="flex flex-col gap-4 overflow-y-scroll"
    >
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface border border-border p-1 w-fit overflow-y-scroll">
        {(["form", "yaml"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-card text-text shadow-sm"
                : "text-text-muted hover:text-text",
            )}
          >
            {tab === "form" ? <FileTextIcon size={14} /> : <CodeIcon size={14} />}
            {tab === "form" ? "Form" : "YAML"}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <QuotaBanner quota={quota} control={control} />

      {activeTab === "form" ? (
        <>
          <div className="flex flex-col gap-3">
            {/* Name field */}
            <div className="rounded-xl border border-border bg-card p-5">
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Name"
                    required
                    placeholder="my-capp"
                    error={errors.name?.message}
                    hint="Lowercase alphanumeric and hyphens only, max 63 characters"
                    disabled={isEdit}
                    {...field}
                  />
                )}
              />
            </div>

            <Accordion
              type="multiple"
              defaultValue={["details", "configuration"]}
              className="flex flex-col gap-3"
            >
              <DetailsSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
                quota={quota}
              />
              <ConfigurationSection
                control={control}
                errors={errors}
                namespace={namespace}
                watch={watch as (name: keyof CappFormValues) => unknown}
                setValue={setValue as (name: keyof CappFormValues, value: unknown) => void}
              />
              <RouteSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
              />
              <LogSection control={control} />
              <VolumesSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
                setValue={setValue as (name: keyof CappFormValues, value: unknown) => void}
                namespace={namespace}
              />
              <EventSourcesSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
                setValue={setValue as (name: keyof CappFormValues, value: unknown) => void}
                namespace={namespace}
              />
            </Accordion>
          </div>
          <div className="flex items-center gap-3 justify-end pt-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" loading={isLoading}>
              {submitLabel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <CappYamlEditor
            handleYamlChange={handleYamlChange}
            yamlContent={yamlContent}
            yamlError={yamlError}
          />

          <div className="flex items-center gap-3 justify-end pt-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              loading={isLoading}
              onClick={async () => handleFormSubmit()}
            >
              {submitLabel}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};
