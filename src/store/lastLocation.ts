import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Stored namespace value for the "All Namespaces" view. */
export const ALL_NAMESPACES = '*';

interface BackendLocation {
  /** Last cluster used on this backend. */
  cluster?: string;
  /** Last namespace picked per cluster; ALL_NAMESPACES for "All Namespaces". */
  namespaces: Record<string, string>;
}

interface LastLocationState {
  /** Keyed by backend URL, since cluster names belong to a backend. */
  byBackend: Record<string, BackendLocation>;
  setCluster: (backendUrl: string, cluster: string) => void;
  setNamespace: (backendUrl: string, cluster: string, namespace: string | undefined) => void;
}

const empty: BackendLocation = { namespaces: {} };

/**
 * Where the user last was, so the next session starts there. Kept apart from the
 * auth store, which logout clears. Values are hints: callers check them against
 * what the user can still access before using them.
 */
export const useLastLocationStore = create<LastLocationState>()(
  persist(
    (set) => ({
      byBackend: {},
      setCluster: (backendUrl, cluster) =>
        set((s) => {
          const cur = s.byBackend[backendUrl] ?? empty;
          if (cur.cluster === cluster) return s;
          return { byBackend: { ...s.byBackend, [backendUrl]: { ...cur, cluster } } };
        }),
      setNamespace: (backendUrl, cluster, namespace) =>
        set((s) => {
          const cur = s.byBackend[backendUrl] ?? empty;
          const value = namespace ?? ALL_NAMESPACES;
          if (cur.namespaces[cluster] === value) return s;
          return {
            byBackend: {
              ...s.byBackend,
              [backendUrl]: { ...cur, namespaces: { ...cur.namespaces, [cluster]: value } },
            },
          };
        }),
    }),
    { name: 'capp-last-location' }
  )
);
