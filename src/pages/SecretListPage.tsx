import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  PencilSimpleIcon,
  ArrowsDownUpIcon,
  WarningCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { Sheet } from "@/components/layout/Sheet";
import { StatBand } from "@/components/layout/StatBand";
import { StatTile } from "@/components/layout/StatTile";
import { ResourceList, ResourceRow } from "@/components/layout/ResourceList";
import { useDebounce } from "@/hooks/useDebounce";
import { useNamespaceContext } from "@/context/NamespaceContext";
import { relativeTime } from "@/utils/time";
import { useSecrets, useDeleteSecret } from "@/hooks/useSecrets";
import { SecretResponse } from "@/types/secret";

type SortField = "name" | "namespace" | "type" | "keys" | "createdAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

const COL = {
  namespace: "hidden w-36 shrink-0 truncate md:block",
  type: "hidden w-44 shrink-0 truncate lg:block",
  keys: "hidden w-14 shrink-0 text-right sm:block",
  age: "hidden w-20 shrink-0 text-right sm:block",
};

const keyCount = (r: { data?: Record<string, string> }) => Object.keys(r.data || {}).length;

export const SecretListPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const { data: items, isLoading, error } = useSecrets(selectedNamespace);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SecretResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { mutateAsync: deleteMut, isPending: isDeleting } = useDeleteSecret();

  const total = items?.length ?? 0;
  const namespaceStats = useMemo(() => {
    const m = new Map<string, number>();
    items?.forEach((x) => {
      if (x.namespace) m.set(x.namespace, (m.get(x.namespace) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);
  const topNamespaces = namespaceStats.slice(0, 4);
  const maxNsCount = topNamespaces[0]?.[1] ?? 1;
  const namespaceCount = namespaceStats.length;
  const isPull = (t?: string) => t === "kubernetes.io/dockerconfigjson";
  const pullCount = items?.filter((x) => isPull(x.type)).length ?? 0;
  const opaqueCount = items?.filter((x) => (x.type ?? "Opaque") === "Opaque").length ?? 0;
  const otherCount = total - pullCount - opaqueCount;

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.namespace ?? "").toLowerCase().includes(q) ||
        (s.type ?? "").toLowerCase().includes(q),
    );
  }, [items, debouncedSearch]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "namespace":
          aVal = a.namespace ?? "";
          bVal = b.namespace ?? "";
          break;
        case "type":
          aVal = a.type ?? "";
          bVal = b.type ?? "";
          break;
        case "keys":
          aVal = keyCount(a);
          bVal = keyCount(b);
          break;
        case "createdAt":
          aVal = a.createdAt ?? "";
          bVal = b.createdAt ?? "";
          break;
      }
      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
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
      await deleteMut({
        namespace: deleteTarget.namespace ?? "",
        name: deleteTarget.name,
      });
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError((e as Error).message ?? "Failed to delete Secret");
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
        <ArrowsDownUpIcon
          size={11}
          className={cn(
            "transition-opacity",
            sortField === field ? "opacity-100 text-primary" : "opacity-40",
          )}
        />
      </button>
    </div>
  );

  const loadingTile = isLoading || !items;
  const num = (n: number) => (loadingTile ? "–" : n);
  const share = (n: number) => (total ? n / total : 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Secrets"
        count={items ? total : undefined}
        description={selectedNamespace ? `Namespace ${selectedNamespace}` : "All namespaces"}
        actions={
          <Button variant="primary" onClick={() => navigate("/secrets/new")}>
            <PlusIcon size={14} />
            Create Secret
          </Button>
        }
      />

      <StatBand>
        <StatTile index={0} label="Total" value={num(total)} share={total ? 1 : 0} />
        <StatTile index={1} label="Image pull" value={num(pullCount)} share={share(pullCount)} tone="success" />
        <StatTile index={2} label="Opaque" value={num(opaqueCount)} share={share(opaqueCount)} />
        <StatTile index={3} label="Other types" value={num(otherCount)} share={share(otherCount)} />
        <StatTile
          index={4}
          label={namespaceCount === 1 ? "1 namespace" : `${namespaceCount} namespaces`}
          className="col-span-2"
        >
          <ul className="mt-3 space-y-1.5">
            {topNamespaces.length === 0 && (
              <li className="text-xs text-text-muted">{loadingTile ? "Loading…" : "No Secrets yet"}</li>
            )}
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlassIcon
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, namespace, or type…"
              aria-label="Search Secrets"
              className="h-8 border-border bg-card pl-8 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <WarningCircleIcon className="h-4 w-4" />
              <AlertDescription>
                {(error as Error).message ?? "Failed to load Secrets"}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {(isLoading || paginated.length > 0) && (
          <>
            <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-2 pr-20">
              <span className="w-2 shrink-0" />
              <span className="flex-1">{sortButton("name", "Name")}</span>
              {sortButton("namespace", "Namespace", COL.namespace)}
              {sortButton("type", "Type", COL.type)}
              {sortButton("keys", "Keys", COL.keys, true)}
              {sortButton("createdAt", "Created", COL.age, true)}
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
                {paginated.map((r, i) => {
                  const href = `/secrets/${r.namespace}/${r.name}`;
                  const keys = Object.keys(r.data || {});
                  return (
                    <ResourceRow
                      key={`${r.namespace}/${r.name}`}
                      index={i}
                      to={href}
                      name={r.name}
                      subline={
                        <>
                          {r.type ?? "Opaque"}
                          {keys.length > 0 && ` · ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", …" : ""}`}
                        </>
                      }
                      meta={
                        <>
                          <span className={cn(COL.namespace, "font-mono text-xs text-text-muted")}>{r.namespace}</span>
                          <span className={cn(COL.type, "font-mono text-xs text-text-muted")}>{r.type ?? "Opaque"}</span>
                          <span className={cn(COL.keys, "font-mono text-xs tabular-nums text-text-muted")}>{keys.length}</span>
                          <span className={cn(COL.age, "font-mono text-xs text-text-muted")}>{relativeTime(r.createdAt)}</span>
                        </>
                      }
                      actions={
                        <>
                          <Link
                            to={`${href}/edit`}
                            aria-label={`Edit ${r.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                          >
                            <PencilSimpleIcon size={13} />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete ${r.name}`}
                            onClick={() => {
                              setDeleteTarget(r);
                              setDeleteError(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-all hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                          >
                            <TrashIcon size={13} />
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
            title={debouncedSearch ? "No results found" : "No Secrets yet"}
            description={
              debouncedSearch
                ? `No Secrets match "${debouncedSearch}"`
                : "Create your first Secret to get started"
            }
            action={
              !debouncedSearch
                ? {
                    label: "Create Secret",
                    onClick: () => navigate("/secrets/new"),
                    icon: <PlusIcon size={14} />,
                  }
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
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <WarningCircleIcon className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete()}
              className="bg-danger hover:bg-danger/90 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <CircleNotchIcon className="h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
