import React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { FormLayout, AsideFacts } from "@/components/layout/FormLayout";

const configMapSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(
      /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/,
      "Must be a valid DNS label (lowercase, alphanumeric, hyphens)",
    ),
  data: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      value: z.string(),
    }),
  ),
});

export interface ConfigMapFormValues {
  name: string;
  data: { key: string; value: string }[];
}

interface ConfigMapFormProps {
  initialValues?: ConfigMapFormValues;
  onSubmit: (values: ConfigMapFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel: string;
  isEdit?: boolean;
  onCancel: () => void;
  /** Display only: namespace shown in the context panel. */
  namespace?: string;
}

export const ConfigMapForm: React.FC<ConfigMapFormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
  error,
  submitLabel,
  isEdit,
  onCancel,
  namespace,
}) => {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfigMapFormValues>({
    resolver: zodResolver(configMapSchema),
    defaultValues: initialValues ?? { name: "", data: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "data" });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormLayout
        aside={
          <AsideFacts
            title="Details"
            facts={[
              ["Namespace", namespace ?? "-"],
              ["Entries", String(fields.length)],
            ]}
            note="Values are stored as plain text in a Kubernetes ConfigMap. Use a Secret for anything sensitive."
          />
        }
        error={
          error ? (
            <Alert variant="destructive">
              <WarningCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : undefined
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              {submitLabel}
            </Button>
          </>
        }
      >
      {/* Name */}
      <Input
        label="Name"
        required
        disabled={isEdit}
        error={errors.name?.message}
        placeholder="my-configmap"
        {...register("name")}
      />

      {/* Data */}
      <div className="flex flex-col gap-3">
        <label className="font-sans text-sm font-medium text-text-secondary">Data</label>

        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                {/* Key */}
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
                            "h-9 w-full rounded border bg-background px-3 font-mono text-[13px] text-text placeholder:text-text-muted",
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

                {/* Value (textarea for multi-line support) */}
                <div className="flex-1">
                  <textarea
                    {...register(`data.${index}.value`)}
                    placeholder="Value"
                    rows={3}
                    className="h-9 w-full rounded border border-border bg-background px-3 py-2 font-mono text-[13px] text-text placeholder:text-text-muted transition-colors duration-150 outline-none focus:outline-none focus:border-primary resize-y"
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => append({ key: "", value: "" })}
          className="flex w-fit items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-primary hover:text-text"
        >
          <Plus size={14} />
          Add entry
        </button>
      </div>


      </FormLayout>
    </form>
  );
};
