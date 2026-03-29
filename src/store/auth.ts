import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  /** Name of the selected cluster (must match a cluster in capp-backend config) */
  cluster: string;
  /** Short-lived access token forwarded to the backend as a Bearer token */
  token: string;
  // Security note: both tokens are stored in localStorage via Zustand persist.
  // This is acceptable for an internal tool but requires CSP headers to mitigate XSS.
  // A future hardening step would store the refresh token in an HttpOnly cookie instead.
  /** Long-lived JWT used to refresh the session without re-authenticating */
  refreshToken: string;
  isAuthenticated: boolean;
  setCredentials: (cluster: string, token: string, refreshToken: string) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      cluster: '',
      token: '',
      refreshToken: '',
      isAuthenticated: false,
      setCredentials: (cluster: string, token: string, refreshToken: string) =>
        set({ cluster, token, refreshToken, isAuthenticated: true }),
      updateTokens: (token: string, refreshToken: string) =>
        set({ token, refreshToken }),
      logout: () =>
        set({ cluster: '', token: '', refreshToken: '', isAuthenticated: false }),
    }),
    {
      name: 'capp-auth',
    }
  )
);
