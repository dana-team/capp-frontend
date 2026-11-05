import { useAuthStore } from '@/store/auth';
import { getBackendUrl } from '@/lib/config';

export class BackendApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.code = code;
  }
}

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
  } | string;
  message?: string;
}

/** Reads a capp-backend error envelope, or a Prometheus `{ "error": "..." }` body. */
function readError(body: unknown, fallback: string): { message: string; code?: string } {
  if (!body || typeof body !== 'object') return { message: fallback };
  const record = body as BackendErrorBody;
  if (typeof record.error === 'string' && record.error.trim()) {
    return { message: record.error };
  }
  if (record.error && typeof record.error === 'object') {
    const message = record.error.message?.trim() ? record.error.message : fallback;
    return { message, code: record.error.code };
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return { message: record.message };
  }
  return { message: fallback };
}

let isRefreshing = false
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = []

async function doRefresh(): Promise<string> {
  const { refreshToken, updateTokens, logout } = useAuthStore.getState()
  const backendUrl = getBackendUrl()
  const base = import.meta.env.DEV ? '' : backendUrl.replace(/\/$/, '')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(import.meta.env.DEV
      ? { 'X-Backend-Url': backendUrl.replace(/\/$/, '') }
      : {}),
  }
  const res = await fetch(`${base}/api/v1/auth/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    logout()
    throw new BackendApiError('Session expired. Please sign in again.', res.status, 'UNAUTHORIZED')
  }
  const pair = await res.json() as { accessToken: string; refreshToken: string }
  updateTokens(pair.accessToken, pair.refreshToken)
  return pair.accessToken
}

/**
 * Sends a request to the capp-backend.
 *
 * In dev mode Vite proxies /api paths to the backend (see vite.config.ts),
 * so the explicit backendUrl from config is only needed in production.
 * The Authorization header always carries the stored Bearer token so that
 * Kubernetes RBAC is enforced per-user in passthrough auth mode.
 */
export async function backendClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = useAuthStore.getState();
  const backendUrl = getBackendUrl();

  const base = import.meta.env.DEV ? '' : backendUrl.replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // In dev mode, tell the Vite proxy where to forward the request.
    ...(import.meta.env.DEV
      ? { 'X-Backend-Url': backendUrl.replace(/\/$/, '') }
      : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const newToken = await (isRefreshing
      ? new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        })
      : (() => {
          isRefreshing = true
          return doRefresh()
            .then((t) => {
              refreshQueue.forEach((p) => p.resolve(t))
              refreshQueue = []
              return t
            })
            .catch((e: Error) => {
              refreshQueue.forEach((p) => p.reject(e))
              refreshQueue = []
              throw e
            })
            .finally(() => {
              isRefreshing = false
            })
        })())

    // Retry the original request with the new token
    const retryHeaders: Record<string, string> = { ...headers, Authorization: `Bearer ${newToken}` }
    const retryResponse = await fetch(url, { ...options, headers: retryHeaders })
    if (!retryResponse.ok) {
      const retryData = await retryResponse.json().catch(() => ({}))
      const parsed = readError(retryData, retryResponse.statusText || `HTTP ${retryResponse.status}`)
      throw new BackendApiError(parsed.message, retryResponse.status, parsed.code ?? 'UNKNOWN')
    }
    if (retryResponse.status === 204) {
      return undefined as unknown as T
    }
    return retryResponse.json() as Promise<T>
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code: string | undefined;

    try {
      const parsed = readError(await response.json(), message);
      message = parsed.message;
      code = parsed.code;
    } catch {
      // ignore JSON parse errors
    }

    throw new BackendApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Alias kept for any code that still imports k8sClient / K8sApiError.
export const k8sClient = backendClient;
export { BackendApiError as K8sApiError };

/** Defaults to the selected cluster. Queries pass theirs, as it can change before they run. */
export function clusterBase(cluster = useAuthStore.getState().cluster): string {
  return `/api/v1/clusters/${encodeURIComponent(cluster)}`;
}