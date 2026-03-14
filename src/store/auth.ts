import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// NOTE: Direct API calls to a remote cluster will fail due to CORS unless:
// 1. The cluster API server is configured to allow cross-origin requests
// 2. You use kubectl proxy: `kubectl proxy --port=8001` and connect to http://localhost:8001
// 3. You use a CORS proxy

interface AuthState {
  clusterUrl: string;
  token: string;
  isAuthenticated: boolean;
  setCredentials: (clusterUrl: string, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      clusterUrl: '',
      token: '',
      isAuthenticated: false,
      setCredentials: (clusterUrl: string, token: string) =>
        set({ clusterUrl, token, isAuthenticated: true }),
      logout: () =>
        set({ clusterUrl: '', token: '', isAuthenticated: false }),
    }),
    {
      name: 'capp-auth',
    }
  )
);
