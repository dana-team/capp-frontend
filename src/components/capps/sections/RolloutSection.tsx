import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { PlusIcon, TrashIcon, TrafficSignalIcon } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SectionAccordion } from './SectionAccordion';
import { CappFormValues, RolloutStageFormValue } from '../CappForm';

interface RolloutSectionProps {
  control: Control<CappFormValues>;
  errors: FieldErrors<CappFormValues>;
  watch: (name: keyof CappFormValues) => unknown;
  setValue: (name: keyof CappFormValues, value: unknown) => void;
  /** Saving cannot remove an existing strategy, so the form must not offer to. */
  hasExistingStrategy: boolean;
}

const PATTERNS: Array<{ label: string; stages: RolloutStageFormValue[] }> = [
  {
    label: 'Canary',
    stages: [
      { percent: 10, duration: '5m' },
      { percent: 50, duration: '10m' },
      { percent: 100, duration: '' },
    ],
  },
  { label: 'Steady split', stages: [{ percent: 50, duration: '' }] },
  { label: 'Blue-green', stages: [{ percent: 0, duration: '' }] },
];

/** The last stage has no duration, so whatever its row still holds does not count. */
const sameStages = (a: RolloutStageFormValue[], b: RolloutStageFormValue[]) =>
  a.length === b.length &&
  a.every((s, i) => s.percent === b[i].percent && (i === a.length - 1 || s.duration === b[i].duration));

const PatternButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'rounded-md border px-3 py-1.5 text-sm transition-colors',
      active ? 'border-primary bg-primary/10 text-text' : 'border-border text-text-secondary hover:text-text',
    )}
  >
    {children}
  </button>
);

export const RolloutSection: React.FC<RolloutSectionProps> = ({ control, errors, watch, setValue, hasExistingStrategy }) => {
  const stages = (watch('rolloutStages') as RolloutStageFormValue[]) ?? [];
  const setStages = (next: RolloutStageFormValue[]) => setValue('rolloutStages', next);

  return (
    <SectionAccordion value="rollout" title="Rollout" icon={<TrafficSignalIcon size={14} weight="duotone" />}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs text-text-muted">
            Move traffic to each new revision in stages. Pick a pattern to start, then adjust the stages.
          </p>
          <div className="flex flex-wrap gap-2">
            {!hasExistingStrategy && (
              <PatternButton active={stages.length === 0} onClick={() => setStages([])}>None</PatternButton>
            )}
            {PATTERNS.map((pattern) => (
              <PatternButton
                key={pattern.label}
                active={sameStages(stages, pattern.stages)}
                onClick={() => setStages(pattern.stages.map((s) => ({ ...s })))}
              >
                {pattern.label}
              </PatternButton>
            ))}
          </div>
        </div>

        {stages.map((_, index) => {
          const isLast = index === stages.length - 1;
          const rowErrors = errors.rolloutStages?.[index];
          return (
            <div key={index} className="flex items-start gap-3">
              <span className="w-16 shrink-0 pt-2 text-sm text-text-secondary">Stage {index + 1}</span>
              <div className="w-28 shrink-0">
                <Controller
                  name={`rolloutStages.${index}.percent` as keyof CappFormValues}
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="%"
                      aria-label={`Stage ${index + 1} percent`}
                      error={rowErrors?.percent?.message}
                      value={(field.value as number | undefined) ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  )}
                />
              </div>
              {isLast ? (
                <span className="pt-2 text-xs text-text-muted">No duration on the last stage</span>
              ) : (
                <div className="w-28 shrink-0">
                  <Controller
                    name={`rolloutStages.${index}.duration` as keyof CappFormValues}
                    control={control}
                    render={({ field }) => (
                      <Input
                        className="font-mono"
                        placeholder="5m"
                        aria-label={`Stage ${index + 1} duration`}
                        error={rowErrors?.duration?.message}
                        {...field}
                        value={field.value as string}
                      />
                    )}
                  />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove stage ${index + 1}`}
                disabled={hasExistingStrategy && stages.length === 1}
                onClick={() => setStages(stages.filter((_, i) => i !== index))}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-40"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          );
        })}

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setStages([...stages, { percent: undefined, duration: '' }])}>
            <PlusIcon size={14} className="mr-1.5" /> Add stage
          </Button>
        </div>

        {stages.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <Controller
              name="rolloutAutoRollback"
              control={control}
              render={({ field }) => (
                <label className="flex items-start gap-2 pt-1 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[hsl(var(--primary))]"
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                  <span>
                    Auto-rollback
                    <span className="block text-xs text-text-muted">Return traffic to the stable revision if the new one fails</span>
                  </span>
                </label>
              )}
            />
            <Controller
              name="rolloutProgressDeadline"
              control={control}
              render={({ field }) => (
                <Input
                  label="Progress deadline"
                  className="font-mono"
                  placeholder="10m"
                  hint="How long a new revision may take to become Ready"
                  error={errors.rolloutProgressDeadline?.message}
                  {...field}
                />
              )}
            />
          </div>
        )}

        {hasExistingStrategy && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Changing stages during a running rollout can pause it. To remove the strategy, use Remove strategy on the Capp page.
          </p>
        )}
      </div>
    </SectionAccordion>
  );
};
