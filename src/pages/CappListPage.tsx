import React, { useState, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Plus,
  MagnifyingGlass,
  Trash,
  PencilSimple,
  ArrowsDownUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SizeBadge } from "@/components/ui/SizeBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { WarningBanner } from "@/components/capps/WarningBanner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sheet } from "@/components/layout/Sheet";
import { StatBand } from "@/components/layout/StatBand";
import { StatTile } from "@/components/layout/StatTile";
import { ResourceList, ResourceRow } from "@/components/layout/ResourceList";
import { useCapps, useDeleteCapp } from "@/hooks/useCapps";
import { Warning, WarningNavState } from "@/types/capp";
import { useDebounce } from "@/hooks/useDebounce";
import { useNamespaces } from "@/hooks/useNamespaces";
import { useNamespaceContext } from "@/context/NamespaceContext";
import { CappResponse } from "@/types/capp";
import { relativeTime } from "@/utils/time";
import { cappHealth, HEALTH_LABEL, HEALTH_TEXT, HEALTH_TONE, type CappHealth } from "@/utils/cappHealth";

type SortField = "name" | "namespace" | "state" | "metric" | "createdAt";

type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

// Shared column widths so the sort header lines up with the rows.
const COL = {
  namespace: "hidden w-36 shrink-0 truncate md:block",
  metric: "hidden w-24 shrink-0 lg:block",
  size: "hidden w-12 shrink-0 sm:block",
  age: "hidden w-20 shrink-0 text-right sm:block",
  status: "w-24 shrink-0",
};

export const CappListPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const { data: capps, isLoading, error } = useCapps(selectedNamespace);
  const { data: namespacesData } = useNamespaces();
  const selectedNsQuota = selectedNamespace
    ? namespacesData?.items?.find((ns) => ns.name === selectedNamespace)?.quota
    : undefined;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<CappResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { mutateAsync: deleteCapp, isPending: isDeleting } = useDeleteCapp();
  // Seeded by a delete performed on the detail page, then replaced by any
  // delete done from this page.
  const [warnings, setWarnings] = useState<Warning[] | undefined>(
    (useLocation().state as WarningNavState | null)?.warnings,
  );

  const totalCapps = capps?.length ?? 0;
  const counts = useMemo(() => {
    const c: Record<CappHealth, number> = { ready: 0, progressing: 0, failed: 0, disabled: 0 };
    capps?.forEach((x) => { c[cappHealth(x)] += 1; });
    return c;
  }, [capps]);
  const namespaceStats = useMemo(() => {
    const m = new Map<string, number>();
    capps?.forEach((x) => {
      if (x.namespace) m.set(x.namespace, (m.get(x.namespace) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [capps]);
  const topNamespaces = namespaceStats.slice(0, 4);
  const maxNsCount = topNamespaces[0]?.[1] ?? 1;
  const namespaceCount = namespaceStats.length;
  const attention = counts.progressing + counts.failed;

  const filtered = useMemo(() => {
    if (!capps) return [];
    if (!debouncedSearch) return capps;
    const q = debouncedSearch.toLowerCase();
    return capps.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.namespace ?? "").toLowerCase().includes(q),
    );
  }, [capps, debouncedSearch]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortField) {
        case "name":
          aVal = a.name; bVal = b.name; break;
        case "namespace":
          aVal = a.namespace ?? ""; bVal = b.namespace ?? ""; break;
        case "state":
          aVal = a.state ?? "enabled";
          bVal = b.state ?? "enabled";
          break;
        case "metric":
          aVal = a.scaleSpec?.metric ?? "concurrency";
          bVal = b.scaleSpec?.metric ?? "concurrency";
          break;
        case "createdAt":
          aVal = a.createdAt ?? ""; bVal = b.createdAt ?? ""; break;
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await deleteCapp({
        namespace: deleteTarget.namespace ?? "",
        name: deleteTarget.name,
      });
      setWarnings(result?.warnings);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError((e as Error).message ?? "Failed to delete Capp");
    }
  };

  const sortButton = (field: SortField, label: string, className?: string, end = false) => (
    <div className={className}>
      <button
        type="button"
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text",
          sortField === field && "text-text",
          end && "ml-auto",
        )}
      >
        {label}
        <ArrowsDownUp
          size={11}
          className={cn(
            "transition-opacity",
            sortField === field ? "opacity-100 text-primary" : "opacity-40",
          )}
        />
      </button>
    </div>
  );

  const loadingTile = isLoading || !capps;
  const num = (n: number) => (loadingTile ? "–" : n);
  const share = (n: number) => (totalCapps ? n / totalCapps : 0);

  return (
    <div className="space-y-4">
      <WarningBanner warnings={warnings} />

      <PageHeader
        title="Capps"
        count={capps ? totalCapps : undefined}
        description={selectedNamespace ? `Namespace ${selectedNamespace}` : "All namespaces"}
        actions={
          <Button variant="primary" onClick={() => navigate("/capps/new")}>
            <Plus size={14} />
            New Capp
          </Button>
        }
      />

      <StatBand>
        <StatTile index={0} label="Total" value={num(totalCapps)} share={totalCapps ? 1 : 0} />
        <StatTile index={1} label="Ready" tone="success" value={num(counts.ready)} share={share(counts.ready)} />
        <StatTile
          index={2}
          label="Needs attention"
          tone={counts.failed ? "danger" : "warning"}
          value={num(attention)}
          share={share(attention)}
        />
        <StatTile index={3} label="Disabled" tone="neutral" value={num(counts.disabled)} share={share(counts.disabled)} />
        <StatTile
          index={4}
          label={namespaceCount === 1 ? "1 namespace" : `${namespaceCount} namespaces`}
          className="col-span-2"
        >
          <ul className="mt-3 space-y-1.5">
            {topNamespaces.length === 0 && <li className="text-xs text-text-muted">{loadingTile ? "Loading…" : "No Capps yet"}</li>}
            {topNamespaces.map(([ns, n]) => (
              <li key={ns} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate font-mono text-text-secondary" title={ns}>{ns}</span>
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-border-subtle">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(n / maxNsCount) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-text-muted">{n}</span>
              </li>
            ))}
          </ul>
        </StatTile>
      </StatBand>

      <Sheet>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlass
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search capps…"
              aria-label="Search capps"
              className="h-8 border-border bg-card pl-8 text-sm"
            />
          </div>
          {selectedNsQuota && (selectedNsQuota.cpu || selectedNsQuota.memory || selectedNsQuota.pods != null) && (
            <span className="ml-auto text-xs text-text-muted" title="Based on resource requests × max pods, not actual runtime usage">
              Allocated
              {selectedNsQuota.cpu && (
                <span className="ml-2">
                  CPU <span className="font-mono text-text">{selectedNsQuota.used?.cpu ?? "0"}</span>
                  <span>/</span>
                  <span className="font-mono text-text">{selectedNsQuota.cpu}</span>
                </span>
              )}
              {selectedNsQuota.memory && (
                <span className="ml-2">
                  Mem <span className="font-mono text-text">{selectedNsQuota.used?.memory ?? "0"}</span>
                  <span>/</span>
                  <span className="font-mono text-text">{selectedNsQuota.memory}</span>
                </span>
              )}
              {selectedNsQuota.pods != null && (
                <span className="ml-2">
                  Pods <span className="font-mono text-text">{selectedNsQuota.used?.pods ?? 0}</span>
                  <span>/</span>
                  <span className="font-mono text-text">{selectedNsQuota.pods}</span>
                </span>
              )}
            </span>
          )}
        </div>

        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <WarningCircle className="h-4 w-4" />
              <AlertDescription>
                {(error as Error).message ?? "Failed to load Capps"}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {(isLoading || paginated.length > 0) && (
          <>
            {/* Sort header, aligned with the row columns */}
            <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-2 pr-20">
              <span className="w-2 shrink-0" />
              <span className="flex-1">{sortButton("name", "Name")}</span>
              {sortButton("namespace", "Namespace", COL.namespace)}
              {sortButton("metric", "Metric", COL.metric)}
              <span className={cn(COL.size, "text-xs font-medium text-text-muted")}>Size</span>
              {sortButton("createdAt", "Created", COL.age, true)}
              {sortButton("state", "State", COL.status)}
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
                {paginated.map((capp, i) => {
                  const h = cappHealth(capp);
                  const href = `/capps/${capp.namespace}/${capp.name}`;
                  return (
                    <ResourceRow
                      key={`${capp.namespace}/${capp.name}`}
                      index={i}
                      to={href}
                      name={capp.name}
                      subline={capp.image}
                      tone={HEALTH_TONE[h]}
                      statusLabel={HEALTH_LABEL[h]}
                      meta={
                        <>
                          <span className={cn(COL.namespace, "font-mono text-xs text-text-muted")}>{capp.namespace}</span>
                          <span className={COL.metric}>
                            {capp.scaleSpec?.metric ? (
                              <Badge variant="info">{capp.scaleSpec.metric}</Badge>
                            ) : (
                              <span className="font-mono text-xs text-text-muted">—</span>
                            )}
                          </span>
                          <span className={COL.size}><SizeBadge size={capp.size} /></span>
                          <span className={cn(COL.age, "font-mono text-xs text-text-muted")}>{relativeTime(capp.createdAt)}</span>
                          <span className={cn(COL.status, "text-xs font-medium", HEALTH_TEXT[h])}>
                            {capp.state === "disabled" ? "disabled" : HEALTH_LABEL[h].toLowerCase()}
                          </span>
                        </>
                      }
                      actions={
                        <>
                          <Link
                            to={`${href}/edit`}
                            aria-label={`Edit ${capp.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                          >
                            <PencilSimple size={13} />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete ${capp.name}`}
                            onClick={() => {
                              setDeleteTarget(capp);
                              setDeleteError(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                          >
                            <Trash size={13} />
                          </button>
                        </>
                      }
                    />
                  );
                })}
              </ResourceList>
            )}

            {!isLoading && totalPages > 1 && (
              <div className="border-t border-border-subtle px-4 py-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(page - 1)}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 font-mono text-sm text-text-muted">
                        {page} / {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(page + 1)}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
            title={debouncedSearch ? "No results found" : "No Capps yet"}
            description={
              debouncedSearch
                ? `No Capps match "${debouncedSearch}"`
                : "Create your first Capp to get started"
            }
            action={
              !debouncedSearch
                ? { label: "Create Capp", onClick: () => navigate("/capps/new"), icon: <Plus size={14} /> }
                : undefined
            }
          />
        )}
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && isDeleting) return;
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Capp</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <WarningCircle className="h-4 w-4" />
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
