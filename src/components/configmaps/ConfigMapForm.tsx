import React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const configMapSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/, 'Must be a valid DNS label (lowercase, alphanumeric, hyphens)'),
  data: z.array(
    z.object({
      key: z.string().min(1, 'Key is required'),
      value: z.string(),
    })
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
}

export const ConfigMapForm: React.FC<ConfigMapFormProps> = ({
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
  } = useForm<ConfigMapFormValues>({
    resolver: zodResolver(configMapSchema),
    defaultValues: initialValues ?? { name: '', data: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'data' });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Name */}
      <Input
        label="Name"
        required
        disabled={isEdit}
        error={errors.name?.message}
        placeholder="my-configmap"
        {...register('name')}
      />

      {/* Data */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-text-secondary">Data</label>

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
                            'h-9 w-full rounded border bg-background px-3 text-sm text-text placeholder:text-text-muted',
                            'transition-colors duration-150 outline-none focus:outline-none focus:border-primary',
                            fieldState.error ? 'border-danger' : 'border-border'
                          )}
                        />
                        {fieldState.error && (
                          <p className="text-xs text-danger">{fieldState.error.message}</p>
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
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors duration-150 outline-none focus:outline-none focus:border-primary resize-y"
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
          onClick={() => append({ key: '', value: '' })}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors w-fit"
        >
          <Plus size={14} />
          Add entry
        </button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
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
