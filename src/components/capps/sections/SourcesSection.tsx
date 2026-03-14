import React from 'react';
import { Control, Controller } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ArrayInput } from '@/components/ui/ArrayInput';
import { Button } from '@/components/ui/button';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, KafkaSourceFormValue } from '../CappForm';

interface SourcesSectionProps {
  control: Control<CappFormValues>;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
}

const emptySource = (): KafkaSourceFormValue => ({
  name: '',
  bootstrapServers: [],
  topics: [],
});

export const SourcesSection: React.FC<SourcesSectionProps> = ({
  control,
  watch,
  setValue,
}) => {
  const sources = watch('kafkaSources') as KafkaSourceFormValue[];

  const addSource = () => {
    setValue('kafkaSources', [...sources, emptySource()]);
  };

  const removeSource = (index: number) => {
    setValue(
      'kafkaSources',
      sources.filter((_, i) => i !== index)
    );
  };

  return (
    <SectionAccordion value="sources" title="Sources">
      <div className="flex flex-col gap-4">
        {sources.map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-surface p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-secondary">
                  Kafka Source {index + 1}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary-subtle text-primary border border-primary/20">
                  kafka
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeSource(index)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <Controller
              name={`kafkaSources.${index}.name` as keyof CappFormValues}
              control={control}
              render={({ field }) => (
                <Input
                  label="Name"
                  placeholder="my-kafka-source"
                  value={field.value as string}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name={`kafkaSources.${index}.bootstrapServers` as keyof CappFormValues}
              control={control}
              render={({ field }) => (
                <ArrayInput
                  label="Bootstrap Servers"
                  value={field.value as unknown as string[]}
                  onChange={field.onChange}
                  placeholder="kafka.example.com:9092"
                />
              )}
            />
            <Controller
              name={`kafkaSources.${index}.topics` as keyof CappFormValues}
              control={control}
              render={({ field }) => (
                <ArrayInput
                  label="Topics"
                  value={field.value as unknown as string[]}
                  onChange={field.onChange}
                  placeholder="my-topic"
                />
              )}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addSource}
          icon={<Plus size={14} />}
        >
          Add Kafka Source
        </Button>
      </div>
    </SectionAccordion>
  );
};
