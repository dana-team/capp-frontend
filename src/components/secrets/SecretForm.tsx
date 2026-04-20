import React, { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash,
  WarningCircle,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const secretSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(
      /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/,
      "Must be a valid DNS label (lowercase, alphanumeric, hyphens)",
    ),
  data: z
    .array(
      z.object({
        key: z.string().min(1, "Key is required"),
        value: z.string(),
      }),
    )
    .superRefine((entries, ctx) => {
      const seen = new Set<string>();
      entries.forEach((entry, index) => {
        if (entry.key && seen.has(entry.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate key",
            path: [index, "key"],
          });
        }
        seen.add(entry.key);
      });
    }),
});

export interface SecretFormValues {
  name: string;
  data: { key: string; value: string }[];
}

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
    formState: { errors },
  } = useForm<SecretFormValues>({
    resolver: zodResolver(secretSchema),
    defaultValues: initialValues ?? { name: "", data: [] },
  });

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
                      <EyeSlash size={14} />
                    ) : (
                      <Eye size={14} />
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
                  <Trash size={14} />
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
          <Plus size={14} />
          Add entry
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
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
