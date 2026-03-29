import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { Plus, Trash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, NFSVolumeFormValue } from '../CappForm';

interface VolumesSectionProps {
  control: Control<CappFormValues>;
  errors: FieldErrors<CappFormValues>;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
}

const capacityUnitOptions = [
  { value: 'Mi', label: 'MiB' },
  { value: 'Gi', label: 'GiB' },
  { value: 'Ti', label: 'TiB' },
];

const emptyVolume = (): NFSVolumeFormValue => ({
  name: '',
  server: '',
  path: '/',
  capacityValue: '1',
  capacityUnit: 'Gi',
});

export const VolumesSection: React.FC<VolumesSectionProps> = ({
  control,
  errors,
  watch,
  setValue,
}) => {
  const volumes = watch('nfsVolumes') as NFSVolumeFormValue[];

  const addVolume = () => {
    setValue('nfsVolumes', [...volumes, emptyVolume()]);
  };

  const removeVolume = (index: number) => {
    setValue(
      'nfsVolumes',
      volumes.filter((_, i) => i !== index)
    );
  };

  return (
    <SectionAccordion value="volumes" title="Volumes">
      <div className="flex flex-col gap-4">
        {volumes.map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                NFS Volume {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeVolume(index)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
              >
                <Trash size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name={`nfsVolumes.${index}.name` as keyof CappFormValues}
                control={control}
                render={({ field }) => (
                  <Input
                    label="Name"
                    placeholder="my-nfs-volume"
                    hint="Must be a valid k8s name"
                    value={field.value as string}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name={`nfsVolumes.${index}.server` as keyof CappFormValues}
                control={control}
                render={({ field }) => (
                  <Input
                    label="NFS Server"
                    placeholder="nfs.example.com"
                    value={field.value as string}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Controller
                  name={`nfsVolumes.${index}.path` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Path"
                      placeholder="/exports/data"
                      hint="Must start with /"
                      value={field.value as string}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <div className="flex gap-2 items-end">
                <Controller
                  name={`nfsVolumes.${index}.capacityValue` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Capacity"
                      type="number"
                      placeholder="1"
                      className="w-20"
                      value={field.value as string}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name={`nfsVolumes.${index}.capacityUnit` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value as string} onValueChange={field.onChange}>
                      <SelectTrigger className="w-20 bg-card border-border">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {capacityUnitOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addVolume}
          icon={<Plus size={14} />}
        >
          Add NFS Volume
        </Button>
      </div>
    </SectionAccordion>
  );
};
