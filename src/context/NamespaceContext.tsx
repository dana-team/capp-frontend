import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCanListAllNamespaces, useNamespaces } from '@/hooks/useNamespaces';

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
  const [selectedNamespace, setSelectedNamespace] = useState<string | undefined>(
    undefined
  );

  const access = useCanListAllNamespaces();
  const { data: namespaces } = useNamespaces();
  // If the check itself fails for another reason, keep the old behaviour.
  const canListAll = access.isError ? true : access.data;
  const firstNamespace = namespaces?.items?.[0]?.name;

  // Users without cluster-wide access cannot view "All Namespaces", so start
  // them in the first namespace they can see.
  useEffect(() => {
    if (canListAll === false && selectedNamespace === undefined && firstNamespace) {
      setSelectedNamespace(firstNamespace);
    }
  }, [canListAll, selectedNamespace, firstNamespace]);

  // Hold cluster-wide queries until access is known, so a restricted user never
  // sees the 403 they would return. With no namespaces at all, let them run and
  // show the error rather than load forever.
  const allNamespacesEnabled =
    canListAll === true || (canListAll === false && namespaces !== undefined && !firstNamespace);

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
