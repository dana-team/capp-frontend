import React, { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { buildDockerConfigJson, DOCKER_CONFIG_JSON_KEY } from "@/utils/dockerConfig";

export type SecretKind = "generic" | "imagePull";

const secretSchema = z
  .object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(
      /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/,
      "Must be a valid DNS label (lowercase, alphanumeric, hyphens)",
    ),
    kind: z.enum(["generic", "imagePull"]),
    data: z.array(z.object({ key: z.string(), value: z.string() })),
    registry: z.object({
      server: z.string(),
      username: z.string(),
      password: z.string(),
      email: z.string(),
    }),
  })
  .superRefine((values, ctx) => {
    // Only the fields of the selected kind are validated; the other kind's
    // inputs are hidden and ignored on submit.
    if (values.kind === "imagePull") {
      const { server, username, password, email } = values.registry;
      if (!server.trim()) {
        ctx.addIssue({ code: "custom", message: "Registry server is required", path: ["registry", "server"] });
      } else if (/\s/.test(server)) {
        ctx.addIssue({ code: "custom", message: "Must not contain spaces", path: ["registry", "server"] });
      }
      if (!username.trim()) {
        ctx.addIssue({ code: "custom", message: "Username is required", path: ["registry", "username"] });
      } else if (username.includes(":")) {
        ctx.addIssue({ code: "custom", message: "Must not contain ':'", path: ["registry", "username"] });
      }
      if (!password) {
        ctx.addIssue({ code: "custom", message: "Password or token is required", path: ["registry", "password"] });
      }
      if (email && !z.email().safeParse(email).success) {
        ctx.addIssue({ code: "custom", message: "Must be a valid email", path: ["registry", "email"] });
      }
      return;
    }
    const seen = new Set<string>();
    values.data.forEach((entry, index) => {
      if (!entry.key) {
        ctx.addIssue({ code: "custom", message: "Key is required", path: ["data", index, "key"] });
      } else if (seen.has(entry.key)) {
        ctx.addIssue({ code: "custom", message: "Duplicate key", path: ["data", index, "key"] });
      }
      seen.add(entry.key);
    });
  });

export interface SecretFormValues {
  name: string;
  kind: SecretKind;
  data: { key: string; value: string }[];
  registry: { server: string; username: string; password: string; email: string };
}

export const emptyRegistry = { server: "", username: "", password: "", email: "" };

/** Converts form values to the plain-text `data` map sent to the backend. */
export function toSecretData(values: SecretFormValues): Record<string, string> {
  if (values.kind === "imagePull") {
    const { server, username, password, email } = values.registry;
    return {
      [DOCKER_CONFIG_JSON_KEY]: buildDockerConfigJson({
        server: server.trim(),
        username: username.trim(),
        password,
        email: email.trim() || undefined,
      }),
    };
  }
  return Object.fromEntries(values.data.map(({ key, value }) => [key, value]));
}

const KIND_OPTIONS: { value: SecretKind; label: string; hint: string }[] = [
  { value: "generic", label: "Generic", hint: "Opaque key/value pairs" },
  { value: "imagePull", label: "Image pull secret", hint: "Registry credentials for pulling private images" },
];

interface SecretFormProps {
  initialValues?: SecretFormValues;
  onSubmit: (values: SecretFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel: string;
  isEdit?: boolean;
  onCancel: () => void;
}

export const SecretForm: React.FC<SecretFormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
  error,
  submitLabel,
  isEdit,
  onCancel,
}) => {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SecretFormValues>({
    resolver: zodResolver(secretSchema),
    defaultValues: initialValues ?? { name: "", kind: "generic", data: [], registry: emptyRegistry },
  });
  const kind = watch("kind");
  const [showPassword, setShowPassword] = useState(false);

  const { fields, append, remove } = useFieldArray({ control, name: "data" });
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(),
  );

  const toggleReveal = (index: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Input
        label="Name"
        required
        disabled={isEdit}
        error={errors.name?.message}
        placeholder="my-secret"
        {...register("name")}
      />

      {!isEdit && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Type</label>
          <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={kind === opt.value}
                onClick={() => setValue("kind", opt.value, { shouldValidate: false })}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded border px-3 py-2 text-left transition-colors duration-150",
                  kind === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-text-muted",
                )}
              >
                <span className="text-sm font-medium text-text">{opt.label}</span>
                <span className="text-xs text-text-muted">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === "imagePull" && (
        <div className="flex flex-col gap-4">
          <Input
            label="Registry server"
            required
            error={errors.registry?.server?.message}
            hint="Hostname as used in image references, e.g. ghcr.io or registry.example.com:5000"
            placeholder="ghcr.io"
            autoComplete="off"
            {...register("registry.server")}
          />
          <Input
            label="Username"
            required
            error={errors.registry?.username?.message}
            autoComplete="off"
            {...register("registry.username")}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="registry-password" className="text-xs font-medium text-text-secondary">
              Password or token
              <span className="text-danger ml-1">*</span>
            </label>
            <div className="relative">
              <Input
                id="registry-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={cn("pr-9", errors.registry?.password && "border-danger focus:border-danger")}
                {...register("registry.password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-text-muted hover:text-text transition-colors"
              >
                {showPassword ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
            {errors.registry?.password && (
              <p className="text-xs text-danger">{errors.registry.password.message}</p>
            )}
          </div>
          <Input
            label="Email"
            error={errors.registry?.email?.message}
            placeholder="optional"
            {...register("registry.email")}
          />
        </div>
      )}

      {kind === "generic" && (
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-text-secondary">Data</label>

        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex flex-col gap-1 w-1/3 shrink-0">
                  <Controller
                    control={control}
                    name={`data.${index}.key`}
                    render={({ field: f, fieldState }) => (
                      <>
                        <input
                          {...f}
                          placeholder="Key"
                          className={cn(
                            "h-9 w-full rounded border bg-background px-3 text-sm text-text placeholder:text-text-muted",
                            "transition-colors duration-150 outline-none focus:outline-none focus:border-primary",
                            fieldState.error
                              ? "border-danger"
                              : "border-border",
                          )}
                        />
                        {fieldState.error && (
                          <p className="text-xs text-danger">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                <div className="flex-1 relative">
                  <textarea
                    {...register(`data.${index}.value`)}
                    placeholder="Value"
                    rows={3}
                    className={cn(
                      "h-9 w-full rounded border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors duration-150 outline-none focus:outline-none focus:border-primary resize-y",
                      !revealedIndices.has(index) && "text-security-disc",
                    )}
                    style={
                      !revealedIndices.has(index)
                        ? ({
                            WebkitTextSecurity: "disc",
                          } as React.CSSProperties)
                        : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(index)}
                    className="absolute top-2 right-2 text-text-muted hover:text-text transition-colors"
                  >
                    {revealedIndices.has(index) ? (
                      <EyeSlashIcon size={14} />
                    ) : (
                      <EyeIcon size={14} />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    remove(index);
                    setRevealedIndices((prev) => {
                      const next = new Set<number>();
                      prev.forEach((i) => {
                        if (i < index) next.add(i);
                        else if (i > index) next.add(i - 1);
                      });
                      return next;
                    });
                  }}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => append({ key: "", value: "" })}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors w-fit"
        >
          <PlusIcon size={14} />
          Add entry
        </button>
      </div>
      )}

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isLoading}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
