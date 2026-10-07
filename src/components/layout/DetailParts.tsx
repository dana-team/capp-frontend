import React from 'react'
import { Link } from 'react-router-dom'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Sheet } from './Sheet'

/** Breadcrumb that stays legible when it sits directly on the painting. */
export const DetailCrumbs: React.FC<{ to: string; parent: string; name: string }> = ({ to, parent, name }) => (
  <nav className="mb-4 inline-flex max-w-full items-center gap-1 rounded-full bg-background/70 px-3 py-1 text-sm backdrop-blur-md">
    <Link to={to} className="text-text-secondary transition-colors hover:text-text">
      {parent}
    </Link>
    <CaretRightIcon size={13} className="shrink-0 text-text-muted" />
    <span className="truncate text-text">{name}</span>
  </nav>
)

/** Header band: serif name, quiet meta line, actions on the right. */
export const DetailHeader: React.FC<{
  title: string
  meta?: React.ReactNode
  badges?: React.ReactNode
  actions?: React.ReactNode
}> = ({ title, meta, badges, actions }) => (
  <Sheet as="header" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 py-4">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="break-all font-display text-[34px] font-medium leading-none tracking-tight text-text">
          {title}
        </h1>
        {badges}
      </div>
      {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">{meta}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </Sheet>
)

/** A titled sheet for one section of a detail page. */
export const SectionSheet: React.FC<{
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}> = ({ title, aside, className, children }) => (
  <Sheet as="section" className={cn('overflow-hidden', className)}>
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle px-5 py-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium tracking-tight text-text">{title}</h2>
      {aside && <span className="text-xs tabular-nums text-text-muted">{aside}</span>}
    </div>
    <div className="p-5">{children}</div>
  </Sheet>
)

/** Compact table used for key/value style data inside a SectionSheet. */
export const DataTable: React.FC<{
  head: React.ReactNode[]
  children: React.ReactNode
  className?: string
}> = ({ head, children, className }) => (
  <div className={cn('overflow-x-auto rounded-lg border border-border-subtle', className)}>
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-border-subtle bg-background/40">
          {/* Index key on purpose: header cells are identified by column position,
              and headers are arbitrary nodes that need not be unique strings. */}
          {head.map((h, i) => (
            <th key={i} className="px-3 py-2 text-xs font-medium text-text-muted">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

export const rowCls = 'border-b border-border-subtle last:border-0 hover:bg-background/40'
