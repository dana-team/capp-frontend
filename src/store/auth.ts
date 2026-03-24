import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  /** Base URL of the capp-backend, e.g. "http://localhost:8080" */
  backendUrl: string;
  /** Name of the selected cluster (must match a cluster in capp-backend config) */
  cluster: string;
  /** Bearer token forwarded to the Kubernetes API in passthrough auth mode */
  token: string;
  isAuthenticated: boolean;
  setCredentials: (backendUrl: string, cluster: string, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      backendUrl: '',
      cluster: '',
      token: '',
      isAuthenticated: false,
      setCredentials: (backendUrl: string, cluster: string, token: string) =>
        set({ backendUrl, cluster, token, isAuthenticated: true }),
      logout: () =>
        set({ backendUrl: '', cluster: '', token: '', isAuthenticated: false }),
    }),
    {
      name: 'capp-auth',
    }
  )
);
