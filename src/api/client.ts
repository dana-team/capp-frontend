import { useAuthStore } from '@/store/auth';

export class K8sApiError extends Error {
  status: number;
  reason?: string;
  code?: number;

  constructor(message: string, status: number, reason?: string, code?: number) {
    super(message);
    this.name = 'K8sApiError';
    this.status = status;
    this.reason = reason;
    this.code = code;
  }
}

interface K8sErrorResponse {
  message?: string;
  reason?: string;
  code?: number;
}

export async function k8sClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { clusterUrl, token } = useAuthStore.getState();

  const base = import.meta.env.DEV ? '/k8s-proxy' : clusterUrl.replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(import.meta.env.DEV && clusterUrl ? { 'X-K8s-Cluster': clusterUrl.replace(/\/$/, '') } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let reason: string | undefined;
    let code: number | undefined;

    try {
      const errorBody: K8sErrorResponse = await response.json();
      if (errorBody.message) errorMessage = errorBody.message;
      reason = errorBody.reason;
      code = errorBody.code;
    } catch {
      // ignore JSON parse errors
    }

    throw new K8sApiError(errorMessage, response.status, reason, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
