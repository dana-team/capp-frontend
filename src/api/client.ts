import { useAuthStore } from '@/store/auth';

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
  };
}

/**
 * Sends a request to the capp-backend.
 *
 * In dev mode Vite proxies /api paths to the backend (see vite.config.ts),
 * so the explicit backendUrl from the store is only needed in production.
 * The Authorization header always carries the stored Bearer token so that
 * Kubernetes RBAC is enforced per-user in passthrough auth mode.
 */
export async function backendClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { backendUrl, token } = useAuthStore.getState();

  const base = import.meta.env.DEV ? '' : backendUrl.replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // In dev mode, tell the Vite proxy where to forward the request.
    ...(import.meta.env.DEV && backendUrl
      ? { 'X-Backend-Url': backendUrl.replace(/\/$/, '') }
      : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code: string | undefined;

    try {
      const body: BackendErrorBody = await response.json();
      if (body.error?.message) message = body.error.message;
      code = body.error?.code;
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
