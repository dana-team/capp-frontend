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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useNamespaceContext } from "@/context/NamespaceContext";
import { relativeTime } from "@/utils/time";
import { useSecrets, useDeleteSecret } from "@/hooks/useSecrets";
import { SecretResponse } from "@/types/secret";

type SortField = "name" | "namespace" | "type" | "keys" | "createdAt";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

export const SecretListPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNamespace } = useNamespaceContext();
  const { data: secrets, isLoading, error } = useSecrets(selectedNamespace);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SecretResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { mutateAsync: deleteSecretMut, isPending: isDeleting } =
    useDeleteSecret();

  const totalSecrets = secrets?.length ?? 0;

  const filtered = useMemo(() => {
    if (!secrets) return [];
    if (!debouncedSearch) return secrets;
    const q = debouncedSearch.toLowerCase();
    return secrets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.namespace ?? "").toLowerCase().includes(q) ||
        (s.type ?? "").toLowerCase().includes(q),
    );
  }, [secrets, debouncedSearch]);

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
          aVal = Object.keys(a.data || {}).length;
          bVal = Object.keys(b.data || {}).length;
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
      await deleteSecretMut({
        namespace: deleteTarget.namespace ?? "",
        name: deleteTarget.name,
      });
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError((e as Error).message ?? "Failed to delete Secret");
    }
  };

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({
    field,
    label,
  }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-text-muted hover:text-text transition-colors"
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
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Secrets</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {totalSecrets} resource{totalSecrets !== 1 ? "s" : ""}
            {selectedNamespace
              ? ` in ${selectedNamespace}`
              : " across all namespaces"}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate("/secrets/new")}>
          <PlusIcon size={15} className="mr-1.5" />
          Create Secret
        </Button>
      </div>

      {!isLoading && (
        <div className="flex items-center gap-4 text-sm pb-3 border-b border-border">
          <span>
            <span className="font-semibold text-text">{totalSecrets}</span>
            <span className="text-text-muted ml-1">total</span>
          </span>
        </div>
      )}

      <div className="relative max-w-sm">
        <MagnifyingGlassIcon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, namespace, or type…"
          className="pl-9 bg-card border-border"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="h-4 w-4" />
          <AlertDescription>
            {(error as Error).message ?? "Failed to load Secrets"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <CircleNotchIcon className="animate-spin h-8 w-8 text-text-muted" />
        </div>
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

      {!isLoading && paginated.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-card hover:bg-card border-border">
                  <TableHead className="w-2 p-0" />
                  <TableHead className="text-[11px] uppercase tracking-[0.8px] text-text-muted font-medium">
                    <SortHeader field="name" label="Name" />
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.8px] text-text-muted font-medium">
                    <SortHeader field="namespace" label="Namespace" />
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.8px] text-text-muted font-medium">
                    <SortHeader field="type" label="Type" />
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.8px] text-text-muted font-medium">
                    <SortHeader field="keys" label="Keys" />
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.8px] text-text-muted font-medium">
                    <SortHeader field="createdAt" label="Created" />
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((secret) => (
                  <TableRow
                    key={`${secret.namespace}/${secret.name}`}
                    className="group border-b border-border/50 hover:bg-primary/[0.06] cursor-pointer transition-colors"
                    onClick={() =>
                      navigate(`/secrets/${secret.namespace}/${secret.name}`)
                    }
                  >
                    <TableCell className="w-2 p-0" />
                    <TableCell className="font-semibold text-text text-sm">
                      <Link
                        to={`/secrets/${secret.namespace}/${secret.name}`}
                        className="font-mono font-medium text-sm text-text hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {secret.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {secret.namespace}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {secret.type ?? "Opaque"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {Object.keys(secret.data || {}).length}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted flex">
                      {relativeTime(secret.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Link
                          to={`/secrets/${secret.namespace}/${secret.name}/edit`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PencilSimpleIcon size={13} />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(secret);
                            setDeleteError(null);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <TrashIcon size={13} />
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
                  className={
                    page === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
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
                  className={
                    page === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

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
