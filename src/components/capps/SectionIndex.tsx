import React from 'react'
import { cn } from '@/lib/utils'
import { Sheet } from '@/components/layout/Sheet'

export interface SectionIndexItem {
  id: string
  label: string
  hasError: boolean
}

interface SectionIndexProps {
  items: SectionIndexItem[]
  active: string
  onSelect: (id: string) => void
}

/** Floating table of contents for the form sections; presentation only. */
export const SectionIndex: React.FC<SectionIndexProps> = ({ items, active, onSelect }) => (
  <Sheet as="nav" aria-label="Form sections" className="p-2">
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <li key={item.id}>
            <a
              href={`#section-${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                onSelect(item.id)
              }}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-subtle text-primary'
                  : 'text-text-secondary hover:bg-background/60 hover:text-text'
              )}
            >
              {item.label}
              {item.hasError && (
                <span
                  role="img"
                  aria-label="Has errors"
                  className="h-2 w-2 shrink-0 rounded-full bg-danger"
                />
              )}
            </a>
          </li>
        )
      })}
    </ul>
  </Sheet>
)
