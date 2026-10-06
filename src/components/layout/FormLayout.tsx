import React from 'react'
import { cn } from '@/lib/utils'
import { Sheet } from './Sheet'

/**
 * Two-column form layout over the painting: the form sheet on the left, a small
 * context sheet on the right (stacked below on narrow screens), and a sticky
 * floating action pill at the bottom. Presentation only.
 */
export const FormLayout: React.FC<{
  children: React.ReactNode
  aside?: React.ReactNode
  error?: React.ReactNode
  actions: React.ReactNode
}> = ({ children, aside, error, actions }) => (
  <div className="pb-24">
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <Sheet as="section" className="flex flex-col gap-6 p-5 sm:p-6">{children}</Sheet>
      {aside && <Sheet as="aside" className="p-4 lg:sticky lg:top-4">{aside}</Sheet>}
    </div>
    <div className="pointer-events-none sticky bottom-5 z-10 mt-6 flex flex-col items-center gap-2">
      {error && (
        <div className="pointer-events-auto w-full max-w-xl rounded-[var(--radius)] bg-card shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]">
          {error}
        </div>
      )}
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card/90 px-3 py-2 shadow-[0_18px_50px_-18px_hsl(var(--text)/0.45)] backdrop-blur-md">
        {actions}
      </div>
    </div>
  </div>
)

/** Label/value rows for the context sheet. */
export const AsideFacts: React.FC<{ title: string; facts: [string, React.ReactNode][]; note: string; className?: string }> = ({
  title, facts, note, className,
}) => (
  <div className={cn('flex flex-col gap-3', className)}>
    <h2 className="font-display text-base font-medium tracking-tight text-text">{title}</h2>
    <dl className="flex flex-col gap-2 text-sm">
      {facts.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 last:border-0">
          <dt className="text-text-muted">{k}</dt>
          <dd className="truncate font-mono text-xs text-text">{v}</dd>
        </div>
      ))}
    </dl>
    <p className="text-xs leading-relaxed text-text-muted">{note}</p>
  </div>
)
