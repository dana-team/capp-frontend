import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowsDownUpIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrashIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Sheet } from '@/components/layout/Sheet'
import { ResourceList, ResourceRow } from '@/components/layout/ResourceList'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import type { Health } from '@/utils/cfunc'

const PAGE_SIZE = 15

export interface ListColumn<T> {
  key: string
  label: string
  /** Width and breakpoint classes, shared by the header cell and the row cell. */
  className: string
  end?: boolean
  sortValue: (item: T) => string | number
  render: (item: T) => React.ReactNode
}

interface ResourceListSheetProps<T extends { name: string; namespace: string }> {
  /** Plural label, e.g. "Pools". */
  title: string
  /** Singular label, e.g. "Pool". */
  kind: string
  basePath: string
  items: T[] | undefined
  isLoading: boolean
  error: unknown
  columns: ListColumn<T>[]
  subline: (item: T) => React.ReactNode
  health: (item: T) => Health
  /** Extra text a search matches, beside name and namespace. */
  searchText?: (item: T) => string
  emptyDescription: string
  onCreate: () => void
  onDelete: (item: T) => void
}

export function ResourceListSheet<T extends { name: string; namespace: string }>({
  title, kind, basePath, items, isLoading, error, columns, subline, health,
  searchText, emptyDescription, onCreate, onDelete,
}: ResourceListSheetProps<T>) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    const filtered = (items ?? []).filter(
      (x) => !q || `${x.name} ${x.namespace} ${searchText?.(x) ?? ''}`.toLowerCase().includes(q),
    )
    const column = columns.find((c) => c.key === sortKey)
    const valueOf = (x: T) => (column ? column.sortValue(x) : x.name)
    return [...filtered].sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, debouncedSearch, searchText, columns, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const paginated = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sortButton = (key: string, label: string, className?: string, end = false) => (
    <div className={className}>
      <button
        type="button"
        onClick={() => handleSort(key)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text',
          sortKey === key && 'text-text',
          end && 'ml-auto',
        )}
      >
        {label}
        <ArrowsDownUpIcon
          size={11}
          className={cn('transition-opacity', sortKey === key ? 'text-primary opacity-100' : 'opacity-40')}
        />
      </button>
    </div>
  )

  return (
    <Sheet>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3">
        <div className="relative w-full max-w-xs">
          <MagnifyingGlassIcon
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or namespace…"
            aria-label={`Search ${title}`}
            className="h-8 border-border bg-card pl-8 text-sm"
          />
        </div>
      </div>

      {Boolean(error) && (
        <div className="p-4">
          <Alert variant="destructive">
            <WarningCircleIcon className="h-4 w-4" />
            <AlertDescription>{(error as Error).message ?? `Failed to load ${title}`}</AlertDescription>
          </Alert>
        </div>
      )}

      {(isLoading || paginated.length > 0) && (
        <>
          <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-2 pr-20">
            <span className="w-2 shrink-0" />
            <span className="flex-1">{sortButton('name', 'Name')}</span>
            {columns.map((c) => (
              <React.Fragment key={c.key}>{sortButton(c.key, c.label, c.className, c.end)}</React.Fragment>
            ))}
          </div>

          {isLoading ? (
            <ul className="divide-y divide-border-subtle" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </li>
              ))}
            </ul>
          ) : (
            <ResourceList>
              {paginated.map((item, i) => {
                const href = `${basePath}/${item.namespace}/${item.name}`
                const h = health(item)
                return (
                  <ResourceRow
                    key={`${item.namespace}/${item.name}`}
                    index={i}
                    to={href}
                    name={item.name}
                    tone={h.tone}
                    statusLabel={h.label}
                    subline={subline(item)}
                    meta={columns.map((c) => (
                      <span
                        key={c.key}
                        className={cn(c.className, c.end && 'text-right', 'truncate font-mono text-xs text-text-muted')}
                      >
                        {c.render(item)}
                      </span>
                    ))}
                    actions={
                      <>
                        <Link
                          to={`${href}/edit`}
                          aria-label={`Edit ${item.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                        >
                          <PencilSimpleIcon size={13} />
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => onDelete(item)}
                          className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </>
                    }
                  />
                )
              })}
            </ResourceList>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="border-t border-border-subtle px-4 py-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(current - 1)}
                      className={current === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 font-mono text-sm text-text-muted">{current} / {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(current + 1)}
                      className={current === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {!isLoading && !error && paginated.length === 0 && (
        <EmptyState
          title={debouncedSearch ? 'No results found' : `No ${title} yet`}
          description={debouncedSearch ? `No ${title} match "${debouncedSearch}"` : emptyDescription}
          action={
            debouncedSearch
              ? undefined
              : { label: `Create ${kind}`, onClick: onCreate, icon: <PlusIcon size={14} /> }
          }
        />
      )}
    </Sheet>
  )
}
