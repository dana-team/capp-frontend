import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Plus, Trash } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, NFSVolumeFormValue, SecretVolumeFormValue, ConfigMapVolumeFormValue } from '../CappForm';
import { useSecrets } from '@/hooks/useSecrets';
import { useConfigmaps } from '@/hooks/useConfigmaps';

interface VolumesSectionProps {
  control: Control<CappFormValues>;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
  namespace: string;
}

const capacityUnitOptions = [
  { value: 'Mi', label: 'MiB' },
  { value: 'Gi', label: 'GiB' },
  { value: 'Ti', label: 'TiB' },
];

const emptyNfsVolume = (): NFSVolumeFormValue => ({ name: '', server: '', path: '/', capacityValue: '1', capacityUnit: 'Gi' });
const emptySecretVolume = (): SecretVolumeFormValue => ({ volumeName: '', secretName: '', mountPath: '' });
const emptyConfigMapVolume = (): ConfigMapVolumeFormValue => ({ volumeName: '', configMapName: '', mountPath: '' });

export const VolumesSection: React.FC<VolumesSectionProps> = ({ control, watch, setValue, namespace }) => {
  const nfsVolumes = watch('nfsVolumes') as NFSVolumeFormValue[];
  const secretVolumes = watch('secretVolumes') as SecretVolumeFormValue[];
  const configMapVolumes = watch('configMapVolumes') as ConfigMapVolumeFormValue[];

  const { data: secrets = [] } = useSecrets(namespace);
  const { data: configMaps = [] } = useConfigmaps(namespace);

  const addNfs = () => setValue('nfsVolumes', [...nfsVolumes, emptyNfsVolume()]);
  const removeNfs = (i: number) => setValue('nfsVolumes', nfsVolumes.filter((_, idx) => idx !== i));
  const addSecret = () => setValue('secretVolumes', [...secretVolumes, emptySecretVolume()]);
  const removeSecret = (i: number) => setValue('secretVolumes', secretVolumes.filter((_, idx) => idx !== i));
  const addConfigMap = () => setValue('configMapVolumes', [...configMapVolumes, emptyConfigMapVolume()]);
  const removeConfigMap = (i: number) => setValue('configMapVolumes', configMapVolumes.filter((_, idx) => idx !== i));

  return (
    <SectionAccordion value="volumes" title="Volumes">
      <div className="flex flex-col gap-6">

        {/* NFS Volumes */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">NFS</span>
          {nfsVolumes.map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">NFS Volume {index + 1}</span>
                <button type="button" onClick={() => removeNfs(index)} aria-label="Remove NFS volume" className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors">
                  <Trash size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Controller name={`nfsVolumes.${index}.name` as keyof CappFormValues} control={control} render={({ field }) => (
                  <Input label="Name" placeholder="my-nfs-volume" hint="Must be a valid k8s name" value={field.value as string} onChange={field.onChange} />
                )} />
                <Controller name={`nfsVolumes.${index}.server` as keyof CappFormValues} control={control} render={({ field }) => (
                  <Input label="NFS Server" placeholder="nfs.example.com" value={field.value as string} onChange={field.onChange} />
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Controller name={`nfsVolumes.${index}.path` as keyof CappFormValues} control={control} render={({ field }) => (
                    <Input label="Path" placeholder="/exports/data" hint="Must start with /" value={field.value as string} onChange={field.onChange} />
                  )} />
                </div>
                <div className="flex gap-2 items-end">
                  <Controller name={`nfsVolumes.${index}.capacityValue` as keyof CappFormValues} control={control} render={({ field }) => (
                    <Input label="Capacity" type="number" placeholder="1" className="w-20" value={field.value as string} onChange={field.onChange} />
                  )} />
                  <Controller name={`nfsVolumes.${index}.capacityUnit` as keyof CappFormValues} control={control} render={({ field }) => (
                    <Select value={field.value as string} onValueChange={field.onChange}>
                      <SelectTrigger className="w-20 bg-card border-border"><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        {capacityUnitOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addNfs} icon={<Plus size={14} />}>Add NFS Volume</Button>
        </div>

        {/* Secret Volumes */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Secret Volumes</span>
          {secretVolumes.map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">Secret Volume {index + 1}</span>
                <button type="button" onClick={() => removeSecret(index)} aria-label="Remove secret volume" className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors">
                  <Trash size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Controller name={`secretVolumes.${index}.volumeName` as keyof CappFormValues} control={control} render={({ field }) => (
                  <Input label="Volume Name" placeholder="my-secret-vol" hint="K8s volume object name" value={field.value as string} onChange={field.onChange} />
                )} />
                <Controller name={`secretVolumes.${index}.secretName` as keyof CappFormValues} control={control} render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-secondary">Secret</label>
                    <Select value={field.value as string} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Select secret" /></SelectTrigger>
                      <SelectContent>
                        {secrets.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )} />
              </div>
              <Controller name={`secretVolumes.${index}.mountPath` as keyof CappFormValues} control={control} render={({ field }) => (
                <Input label="Mount Path" placeholder="/etc/secrets/my-secret" value={field.value as string} onChange={field.onChange} />
              )} />
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addSecret} icon={<Plus size={14} />}>Add Secret Volume</Button>
        </div>

        {/* ConfigMap Volumes */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">ConfigMap Volumes</span>
          {configMapVolumes.map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">ConfigMap Volume {index + 1}</span>
                <button type="button" onClick={() => removeConfigMap(index)} aria-label="Remove ConfigMap volume" className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors">
                  <Trash size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Controller name={`configMapVolumes.${index}.volumeName` as keyof CappFormValues} control={control} render={({ field }) => (
                  <Input label="Volume Name" placeholder="my-cm-vol" hint="K8s volume object name" value={field.value as string} onChange={field.onChange} />
                )} />
                <Controller name={`configMapVolumes.${index}.configMapName` as keyof CappFormValues} control={control} render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-secondary">ConfigMap</label>
                    <Select value={field.value as string} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Select configmap" /></SelectTrigger>
                      <SelectContent>
                        {configMaps.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )} />
              </div>
              <Controller name={`configMapVolumes.${index}.mountPath` as keyof CappFormValues} control={control} render={({ field }) => (
                <Input label="Mount Path" placeholder="/etc/config/my-cm" value={field.value as string} onChange={field.onChange} />
              )} />
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addConfigMap} icon={<Plus size={14} />}>Add ConfigMap Volume</Button>
        </div>

      </div>
    </SectionAccordion>
  );
};
