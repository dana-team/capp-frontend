import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit2, ArrowUpDown, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { NumberTicker } from '@/components/ui/number-ticker'
import { BlurFade } from '@/components/ui/blur-fade'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { useCapps, useDeleteCapp } from '@/hooks/useCapps'
import { useDebounce } from '@/hooks/useDebounce'
import { useNamespaceContext } from '@/context/NamespaceContext'
import { Capp } from '@/types/capp'
import { relativeTime } from '@/utils/time'

type SortField = 'name' | 'namespace' | 'state' | 'scaleMetric' | 'creationTimestamp'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 15

export const CappListPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const { data: capps, isLoading, error } = useCapps(selectedNamespace)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Capp | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp()

  // Stats
  const totalCapps = capps?.length ?? 0
  const enabledCapps = capps?.filter((c) => (c.spec.state ?? 'enabled') === 'enabled').length ?? 0
  const namespaceCount = capps
    ? new Set(capps.map((c) => c.metadata.namespace).filter(Boolean)).size
    : 0

  const filtered = useMemo(() => {
    if (!capps) return []
    if (!debouncedSearch) return capps
    const q = debouncedSearch.toLowerCase()
    return capps.filter(
      (c) =>
        c.metadata.name.toLowerCase().includes(q) ||
        (c.metadata.namespace ?? '').toLowerCase().includes(q)
    )
  }, [capps, debouncedSearch])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = ''
      let bVal = ''
      switch (sortField) {
        case 'name':              aVal = a.metadata.name;              bVal = b.metadata.name;              break
        case 'namespace':         aVal = a.metadata.namespace ?? '';   bVal = b.metadata.namespace ?? '';   break
        case 'state':             aVal = a.spec.state ?? 'enabled';    bVal = b.spec.state ?? 'enabled';    break
        case 'scaleMetric':       aVal = a.spec.scaleMetric ?? '';     bVal = b.spec.scaleMetric ?? '';     break
        case 'creationTimestamp': aVal = a.metadata.creationTimestamp ?? ''; bVal = b.metadata.creationTimestamp ?? ''; break
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCapp({ namespace: deleteTarget.metadata.namespace ?? '', name: deleteTarget.metadata.name })
      setDeleteTarget(null)
    } catch (e) {
      setDeleteError((e as Error).message ?? 'Failed to delete Capp')
    }
  }

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-text-muted hover:text-text transition-colors"
    >
      {label}
      <ArrowUpDown
        size={11}
        className={cn('transition-opacity', sortField === field ? 'opacity-100 text-primary' : 'opacity-40')}
      />
    </button>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">Capps</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {totalCapps} resource{totalCapps !== 1 ? 's' : ''}
              {selectedNamespace ? ` in ${selectedNamespace}` : ' across all namespaces'}
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/capps/new')}>
            <Plus size={15} className="mr-1.5" />
            Create Capp
          </Button>
        </div>
      </BlurFade>

      {/* Stat cards */}
      {!isLoading && (
        <BlurFade delay={0.05}>
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-surface border-border relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs uppercase tracking-wide text-text-muted mb-1.5">Total Capps</p>
                <p className="text-3xl font-bold text-primary leading-none">
                  {totalCapps > 0 ? <NumberTicker value={totalCapps} /> : '0'}
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-transparent" />
            </Card>
            <Card className="bg-surface border-border relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs uppercase tracking-wide text-text-muted mb-1.5">Enabled</p>
                <p className="text-3xl font-bold text-success leading-none">
                  {enabledCapps > 0 ? <NumberTicker value={enabledCapps} /> : '0'}
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-success to-transparent" />
            </Card>
            <Card className="bg-surface border-border relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs uppercase tracking-wide text-text-muted mb-1.5">Namespaces</p>
                <p className="text-3xl font-bold text-accent leading-none">
                  {namespaceCount > 0 ? <NumberTicker value={namespaceCount} /> : '0'}
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-transparent" />
            </Card>
          </div>
        </BlurFade>
      )}

      {/* Search */}
      <BlurFade delay={0.1}>
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or namespace…"
            className="pl-9 bg-card border-border"
          />
        </div>
      </BlurFade>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message ?? 'Failed to load Capps'}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-text-muted" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && paginated.length === 0 && (
        <EmptyState
          title={debouncedSearch ? 'No results found' : 'No Capps yet'}
          description={
            debouncedSearch
              ? `No Capps match "${debouncedSearch}"`
              : 'Create your first Capp to get started'
          }
          action={
            !debouncedSearch
              ? { label: 'Create Capp', onClick: () => navigate('/capps/new'), icon: <Plus size={14} /> }
              : undefined
          }
        />
      )}

      {/* Table */}
      {!isLoading && paginated.length > 0 && (
        <BlurFade delay={0.15}>
          <div className="space-y-3">
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card hover:bg-card border-border">
                    <TableHead className="w-2 p-0" />
                    <TableHead><SortHeader field="name" label="Name" /></TableHead>
                    <TableHead><SortHeader field="namespace" label="Namespace" /></TableHead>
                    <TableHead><SortHeader field="state" label="State" /></TableHead>
                    <TableHead><SortHeader field="scaleMetric" label="Scale Metric" /></TableHead>
                    <TableHead><SortHeader field="creationTimestamp" label="Created" /></TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((capp) => (
                    <TableRow
                      key={`${capp.metadata.namespace}/${capp.metadata.name}`}
                      className="group border-border/50 hover:bg-surface/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary"
                    >
                      <TableCell className="w-2 p-0" />
                      <TableCell>
                        <Link
                          to={`/capps/${capp.metadata.namespace}/${capp.metadata.name}`}
                          className="font-medium text-text hover:text-primary transition-colors"
                        >
                          {capp.metadata.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="violet">{capp.metadata.namespace}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={capp.spec.state === 'disabled' ? 'default' : 'success'}>
                          {capp.spec.state ?? 'enabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {capp.spec.scaleMetric
                          ? <Badge variant="info">{capp.spec.scaleMetric}</Badge>
                          : <span className="text-sm text-text-muted">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-text-muted">
                        {relativeTime(capp.metadata.creationTimestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/capps/${capp.metadata.namespace}/${capp.metadata.name}/edit`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Edit2 size={13} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(capp); setDeleteError(null) }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(page - 1)}
                    className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-text-muted">
                    Page {page} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(page + 1)}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </BlurFade>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => {
        if (!open && isDeleting) return
        if (!open) setDeleteTarget(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capp</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.metadata.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete()}
              className="bg-danger hover:bg-danger/90 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
