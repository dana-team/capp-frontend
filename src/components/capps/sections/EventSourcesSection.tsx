import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Plus, Trash, Lightning } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, EventSourceFormEntry } from '../CappForm';
import { useSecrets } from '@/hooks/useSecrets';

interface EventSourcesSectionProps {
  control: Control<CappFormValues>;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
  namespace: string;
}

const emptyEventSource = (): EventSourceFormEntry => ({
  name: '',
  uri: '',
  sourceType: 'ping',
  pingSchedule: '',
  pingData: '',
  kafkaBootstrapServers: '',
  kafkaTopics: '',
  kafkaConsumerGroup: '',
  kafkaConsumers: undefined,
  kafkaSecretRef: '',
});

export const EventSourcesSection: React.FC<EventSourcesSectionProps> = ({ control, watch, setValue, namespace }) => {
  const eventSources = (watch('eventSources') as EventSourceFormEntry[]) ?? [];
  const { data: secrets = [] } = useSecrets(namespace);

  const add = () => setValue('eventSources', [...eventSources, emptyEventSource()]);
  const remove = (i: number) => setValue('eventSources', eventSources.filter((_, idx) => idx !== i));

  return (
    <SectionAccordion
      value="eventSources"
      title="Event Sources"
      icon={<Lightning size={14} weight="duotone" />}
    >
      <div className="flex flex-col gap-4">
        {eventSources.length === 0 && (
          <p className="text-sm text-text-muted">No event sources configured.</p>
        )}

        {eventSources.map((entry, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                Event Source {index + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Remove event source"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
              >
                <Trash size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name={`eventSources.${index}.name` as keyof CappFormValues}
                control={control}
                render={({ field }) => (
                  <Input label="Name" placeholder="my-source" required {...field} value={field.value as string} />
                )}
              />
              <Controller
                name={`eventSources.${index}.uri` as keyof CappFormValues}
                control={control}
                render={({ field }) => (
                  <Input label="URI" placeholder="/events" {...field} value={field.value as string} />
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Source Type</label>
              <Controller
                name={`eventSources.${index}.sourceType` as keyof CappFormValues}
                control={control}
                render={({ field }) => (
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 text-sm bg-background border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ping">Ping</SelectItem>
                      <SelectItem value="kafka">Kafka</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {entry.sourceType === 'ping' && (
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name={`eventSources.${index}.pingSchedule` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input label="Schedule" placeholder="*/5 * * * *" required {...field} value={field.value as string} />
                  )}
                />
                <Controller
                  name={`eventSources.${index}.pingData` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input label="Data (JSON)" placeholder='{"msg":"hello"}' {...field} value={field.value as string} />
                  )}
                />
              </div>
            )}

            {entry.sourceType === 'kafka' && (
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name={`eventSources.${index}.kafkaBootstrapServers` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input label="Bootstrap Servers" placeholder="broker1:9092,broker2:9092" required {...field} value={field.value as string} />
                  )}
                />
                <Controller
                  name={`eventSources.${index}.kafkaTopics` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input label="Topics" placeholder="topic-a,topic-b" required {...field} value={field.value as string} />
                  )}
                />
                <Controller
                  name={`eventSources.${index}.kafkaSecretRef` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Secret Ref <span className="text-danger">*</span>
                      </label>
                      <Select value={field.value as string} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 text-sm bg-background border-border">
                          <SelectValue placeholder="Select secret" />
                        </SelectTrigger>
                        <SelectContent>
                          {secrets.map((s) => (
                            <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                          ))}
                          {secrets.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-text-muted">No secrets found</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
                <Controller
                  name={`eventSources.${index}.kafkaConsumerGroup` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input label="Consumer Group" placeholder="my-group" {...field} value={field.value as string} />
                  )}
                />
                <Controller
                  name={`eventSources.${index}.kafkaConsumers` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Consumers"
                      type="number"
                      min={1}
                      placeholder="1"
                      {...field}
                      value={(field.value as number | undefined) ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  )}
                />
              </div>
            )}
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={add}
          className="w-fit"
        >
          <Plus size={13} className="mr-1.5" /> Add Event Source
        </Button>
      </div>
    </SectionAccordion>
  );
};
