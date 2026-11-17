import React from 'react'
import { PlusIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet } from '@/components/layout/Sheet'
import { cn } from '@/lib/utils'

export const DNS_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
export const DNS_LABEL_MESSAGE = 'Must be a valid DNS label (lowercase, alphanumeric, hyphens)'

/**
 * Capp-style form page: a details sheet and section sheets on the left, a
 * context sheet on the right, and a floating action pill at the bottom.
 */
export const FormShell: React.FC<{
  children: React.ReactNode
  aside: React.ReactNode
  error?: string
  notice?: string
  actions: React.ReactNode
}> = ({ children, aside, error, notice, actions }) => (
  <div className="pb-24">
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      <Sheet as="aside" className="p-4 lg:sticky lg:top-4">{aside}</Sheet>
    </div>
    <div className="pointer-events-none sticky bottom-5 z-10 mt-6 flex flex-col items-center gap-2">
      {(error || notice) && (
        <div className="pointer-events-auto w-full max-w-xl rounded-[var(--radius)] bg-card shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]">
          <Alert variant={error ? 'destructive' : 'default'}>
            <WarningCircleIcon className="h-4 w-4" />
            <AlertDescription>{error ?? notice}</AlertDescription>
          </Alert>
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card/90 px-3 py-2 shadow-[0_18px_50px_-18px_hsl(var(--text)/0.45)] backdrop-blur-md">
        {actions}
      </div>
    </div>
  </div>
)

/** One removable entry of a list field, e.g. a trigger or an env var. */
export const ItemCard: React.FC<{
  title: string
  onRemove: () => void
  children: React.ReactNode
}> = ({ title, onRemove, children }) => (
  <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-text-secondary">{title}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title}`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <TrashIcon size={14} />
      </button>
    </div>
    {children}
  </div>
)

export const AddButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({
  onClick, children, disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-fit items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-primary hover:text-text disabled:pointer-events-none disabled:opacity-50"
  >
    <PlusIcon size={14} />
    {children}
  </button>
)

export const Switch: React.FC<{
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}> = ({ id, checked, onChange, label, hint }) => (
  <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-background/40 px-3.5 py-3">
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
    <div className="min-w-0">
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-text-secondary">{label}</label>
      <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
    </div>
  </div>
)

/** "" stays undefined, so an empty optional number is left to the backend default. */
export function optionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : Number.parseInt(trimmed, 10)
}

export const optionalIntMessage = (value: string, min: number, max?: number): string | undefined => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (!/^\d+$/.test(trimmed)) return 'Must be a whole number'
  const n = Number.parseInt(trimmed, 10)
  if (n < min) return `Must be at least ${min}`
  if (max !== undefined && n > max) return `Must be at most ${max}`
  return undefined
}
