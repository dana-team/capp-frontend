import React, { createContext, useContext, useState } from 'react';

interface NamespaceContextValue {
  selectedNamespace: string | undefined;
  setSelectedNamespace: (ns: string | undefined) => void;
}

const NamespaceContext = createContext<NamespaceContextValue>({
  selectedNamespace: undefined,
  setSelectedNamespace: () => {},
});

export const NamespaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedNamespace, setSelectedNamespace] = useState<string | undefined>(
    undefined
  );

  return (
    <NamespaceContext.Provider value={{ selectedNamespace, setSelectedNamespace }}>
      {children}
    </NamespaceContext.Provider>
  );
};

export function useNamespaceContext() {
  return useContext(NamespaceContext);
}
