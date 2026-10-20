import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useCanListAllNamespaces, useNamespaces } from '@/hooks/useNamespaces';
import { useAuthStore } from '@/store/auth';
import { ALL_NAMESPACES, useLastLocationStore } from '@/store/lastLocation';
import { getBackendUrl } from '@/lib/config';

interface NamespaceContextValue {
  selectedNamespace: string | undefined;
  setSelectedNamespace: (ns: string | undefined) => void;
  /** Whether the user may view all namespaces at once; undefined while checking. */
  canListAll: boolean | undefined;
  /** Whether cluster-wide ("All Namespaces") list queries may run yet. */
  allNamespacesEnabled: boolean;
}

const NamespaceContext = createContext<NamespaceContextValue>({
  selectedNamespace: undefined,
  setSelectedNamespace: () => {},
  canListAll: true,
  allNamespacesEnabled: true,
});

export const NamespaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const cluster = useAuthStore((s) => s.cluster);
  const backendUrl = getBackendUrl();
  const rememberCluster = useLastLocationStore((s) => s.setCluster);
  const rememberNamespace = useLastLocationStore((s) => s.setNamespace);

  const [selected, setSelected] = useState<string | undefined>(undefined);
  // The cluster whose remembered namespace has been restored into `selected`.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const restored = restoredFor === cluster;

  const access = useCanListAllNamespaces();
  const {
    data: namespaces,
    isError: namespacesFailed,
    isFetching: namespacesFetching,
  } = useNamespaces();
  // If the check itself fails for another reason, keep the old behaviour.
  const canListAll = access.isError ? true : access.data;
  const firstNamespace = namespaces?.items?.[0]?.name;

  useEffect(() => {
    if (cluster) rememberCluster(backendUrl, cluster);
  }, [backendUrl, cluster, rememberCluster]);

  // Once access and a fresh namespace list are known for this cluster, start
  // where the user left off, if they can still see it. Otherwise: "All
  // Namespaces" for users with cluster-wide access, the first namespace for
  // everyone else. If the list cannot be loaded, trust the saved namespace
  // rather than wait forever; the check below corrects it once the list loads.
  useEffect(() => {
    if (restored || canListAll === undefined || namespacesFetching) return;
    if (!namespaces && !namespacesFailed) return;
    const saved = useLastLocationStore.getState().byBackend[backendUrl]?.namespaces[cluster];
    const visible = namespaces
      ? namespaces.items.some((ns) => ns.name === saved)
      : namespacesFailed;
    let next: string | undefined;
    if (saved && saved !== ALL_NAMESPACES && visible) next = saved;
    else if (canListAll) next = undefined;
    else next = firstNamespace;
    setSelected(next);
    setRestoredFor(cluster);
  }, [
    restored,
    canListAll,
    namespaces,
    namespacesFailed,
    namespacesFetching,
    backendUrl,
    cluster,
    firstNamespace,
  ]);

  // Keep the selection valid as the namespace list refreshes: if its namespace
  // is gone (e.g. deleted), fall back. Users without cluster-wide access cannot
  // view "All Namespaces", so they fall back to the first namespace.
  useEffect(() => {
    if (!restored || !namespaces) return;
    const visible = namespaces.items.some((ns) => ns.name === selected);
    if (selected !== undefined && !visible) {
      setSelected(canListAll === false ? firstNamespace : undefined);
    } else if (selected === undefined && canListAll === false && firstNamespace) {
      setSelected(firstNamespace);
    }
  }, [restored, namespaces, canListAll, selected, firstNamespace]);

  const setSelectedNamespace = useCallback(
    (ns: string | undefined) => {
      setSelected(ns);
      if (cluster) rememberNamespace(backendUrl, cluster, ns);
    },
    [backendUrl, cluster, rememberNamespace]
  );

  // Until restored (first load, or right after a cluster switch) expose no
  // selection and hold cluster-wide queries, so nothing is fetched for a
  // namespace or scope the user is about to leave.
  const selectedNamespace = restored ? selected : undefined;

  // Hold cluster-wide queries until access is known, so a restricted user never
  // sees the 403 they would return. With no namespaces at all, or no list to
  // pick from, let them run and show the error rather than load forever.
  const allNamespacesEnabled =
    restored &&
    (canListAll === true ||
      (canListAll === false && (namespacesFailed || (namespaces !== undefined && !firstNamespace))));

  return (
    <NamespaceContext.Provider
      value={{ selectedNamespace, setSelectedNamespace, canListAll, allNamespacesEnabled }}
    >
      {children}
    </NamespaceContext.Provider>
  );
};

export function useNamespaceContext() {
  return useContext(NamespaceContext);
}
