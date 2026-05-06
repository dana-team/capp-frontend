import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import yaml from "js-yaml";
import { WarningCircle, FileText, Code } from "@phosphor-icons/react";
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
import { SourcesSection } from "./sections/SourcesSection";
import { buildCappResource, cappToYaml } from "@/utils/cappBuilder";
import type { KeyValuePair } from "@/components/ui/KeyValueList";
import { ScaleMetric, CappState } from "@/types/capp";
import { CappYamlEditor } from "./CappYamlEditor";

export interface NFSVolumeFormValue {
  name: string;
  server: string;
  path: string;
  capacityValue: string;
  capacityUnit: "Mi" | "Gi" | "Ti";
}

export interface KafkaSourceFormValue {
  name: string;
  bootstrapServers: string[];
  topics: string[];
}

export type LogType = "elastic" | "elastic-datastream";

export interface CappFormValues {
  name: string;
  scaleMetric: ScaleMetric | "";
  state: CappState;
  image: string;
  containerName: string;
  envVars: KeyValuePair[];
  hostname: string;
  tlsEnabled?: boolean;
  routeTimeoutSeconds?: number;
  logType: LogType | "";
  logHost: string;
  logIndex: string;
  logUser: string;
  logPasswordSecret: string;
  nfsVolumes: NFSVolumeFormValue[];
  kafkaSources: KafkaSourceFormValue[];
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
  scaleMetric: z.string().optional(),
  state: z.enum(["enabled", "disabled"]).default("enabled"),
  image: z.string().min(1, "Container image is required"),
  containerName: z.string().optional(),
  envVars: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .default([]),
  hostname: z.string().optional(),
  tlsEnabled: z.boolean().optional(),
  routeTimeoutSeconds: z.number().optional(),
  logType: z.enum(["", "elastic", "elastic-datastream"]).optional(),
  logHost: z.string().optional(),
  logIndex: z.string().optional(),
  logUser: z.string().optional(),
  logPasswordSecret: z.string().optional(),
  nfsVolumes: z
    .array(
      z.object({
        name: z.string(),
        server: z.string(),
        path: z.string(),
        capacityValue: z.string(),
        capacityUnit: z.enum(["Mi", "Gi", "Ti"]),
      }),
    )
    .default([]),
  kafkaSources: z
    .array(
      z.object({
        name: z.string(),
        bootstrapServers: z.array(z.string()),
        topics: z.array(z.string()),
      }),
    )
    .default([]),
});

const defaultValues: CappFormValues = {
  name: "",
  scaleMetric: "",
  state: "enabled",
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
  nfsVolumes: [],
  kafkaSources: [],
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
}

export type Tab = "form" | "yaml";

export const CappForm: React.FC<CappFormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
  error,
  submitLabel = "Create Capp",
  isEdit = false,
  namespace = "default",
  onCancel,
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
          const sources =
            (spec.sources as Array<Record<string, unknown>>) ?? [];

          const meta = parsed.metadata as Record<string, unknown> | undefined;

          reset({
            name: (meta?.name as string) ?? "",
            scaleMetric: (spec.scaleMetric as ScaleMetric) ?? "",
            state: (spec.state as CappState) ?? "enabled",
            image: (container.image as string) ?? "",
            containerName: (container.name as string) ?? "",
            envVars: (
              (container.env as Array<{ name: string; value: string }>) ?? []
            ).map((e) => ({ key: e.name, value: e.value })),
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
            kafkaSources: sources.map((s) => ({
              name: s.name as string,
              bootstrapServers: (s.bootstrapServers as string[]) ?? [],
              topics: (s.topic as string[]) ?? [],
            })),
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
      className="flex flex-col gap-4"
    >
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface border border-border p-1 w-fit">
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
            {tab === "form" ? <FileText size={14} /> : <Code size={14} />}
            {tab === "form" ? "Form" : "YAML"}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              />
              <ConfigurationSection
                control={control}
                errors={errors}
                watch={watch as (name: keyof CappFormValues) => unknown}
              />
              <RouteSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
              />
              <LogSection control={control} />
              <VolumesSection
                control={control}
                errors={errors}
                watch={watch as (name: keyof CappFormValues) => unknown}
                setValue={
                  setValue as (
                    name: keyof CappFormValues,
                    value: unknown,
                  ) => void
                }
              />
              <SourcesSection
                control={control}
                watch={watch as (name: keyof CappFormValues) => unknown}
                setValue={
                  setValue as (
                    name: keyof CappFormValues,
                    value: unknown,
                  ) => void
                }
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
