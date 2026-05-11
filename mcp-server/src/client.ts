import { loadConfig } from './config.js';

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
  error?: { code?: string; message?: string };
}

export interface Session {
  token: string;
  refreshToken: string;
  cluster: string;
}

const sessions = new Map<string, Session>();

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function setSession(sessionId: string, session: Session): void {
  sessions.set(sessionId, session);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

function requireSession(sessionId: string): Session {
  const s = sessions.get(sessionId);
  if (!s) {
    throw new BackendApiError(
      'Not authenticated. Call the "authenticate" tool first.',
      401,
      'UNAUTHENTICATED',
    );
  }
  return s;
}

function requireCluster(session: Session): string {
  if (!session.cluster) {
    throw new BackendApiError(
      'No cluster selected. Call the "set-cluster" tool first.',
      400,
      'NO_CLUSTER',
    );
  }
  return session.cluster;
}

async function tryRefresh(sessionId: string): Promise<string> {
  const session = requireSession(sessionId);
  const { backendUrl } = loadConfig();

  const res = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!res.ok) {
    deleteSession(sessionId);
    throw new BackendApiError('Session expired. Please authenticate again.', res.status, 'UNAUTHORIZED');
  }

  const pair = (await res.json()) as { accessToken: string; refreshToken: string };
  session.token = pair.accessToken;
  session.refreshToken = pair.refreshToken;
  return pair.accessToken;
}

export async function backendFetch<T>(
  sessionId: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = requireSession(sessionId);
  const { backendUrl } = loadConfig();
  const url = `${backendUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && session.refreshToken) {
    const newToken = await tryRefresh(sessionId);
    headers['Authorization'] = `Bearer ${newToken}`;
    response = await fetch(url, { ...options, headers });
  }

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

export function clusterBase(sessionId: string): string {
  const session = requireSession(sessionId);
  const cluster = requireCluster(session);
  return `/api/v1/clusters/${encodeURIComponent(cluster)}`;
}
