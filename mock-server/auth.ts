/**
 * Mock auth for the capp-backend mock. Tokens are opaque (the frontend never decodes them),
 * kept in an in-memory map, so a restart invalidates every session.
 *
 * MOCK_AUTH_MODE: passthrough (default) | jwt | static | dex | openshift
 * MOCK_TOKEN_TTL: access-token lifetime in seconds (default 900); refresh tokens live 24h.
 */
import type { IncomingMessage } from 'node:http';
import { store } from './store';

export type AuthMode = 'passthrough' | 'jwt' | 'static' | 'dex' | 'openshift';
const MODES: AuthMode[] = ['passthrough', 'jwt', 'static', 'dex', 'openshift'];

const envMode = process.env.MOCK_AUTH_MODE as AuthMode | undefined;
export const authMode: AuthMode = envMode && MODES.includes(envMode) ? envMode : 'passthrough';
if (envMode && !MODES.includes(envMode)) {
  console.warn(`[mock] unknown MOCK_AUTH_MODE "${envMode}", using passthrough`);
}

const envTtl = Number(process.env.MOCK_TOKEN_TTL);
const ACCESS_TTL_MS = (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 900) * 1000;
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

/** Frontend origin used for the fake OpenShift redirect. */
const FRONTEND_URL = process.env.MOCK_FRONTEND_URL ?? 'http://localhost:3000';

interface TokenInfo {
  kind: 'access' | 'refresh';
  expiresAt: number;
  user: string;
}

const tokens = new Map<string, TokenInfo>();
const openshiftStates = new Set<string>();

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

const fail = (status: number, code: string, message: string): AuthResult<never> => ({ ok: false, status, code, message });

function sweep(): void {
  const now = Date.now();
  for (const [t, info] of tokens) if (info.expiresAt <= now) tokens.delete(t);
}

function issue(user: string): TokenPair {
  sweep();
  const now = Date.now();
  const accessToken = `mock-access-${crypto.randomUUID()}`;
  const refreshToken = `mock-refresh-${crypto.randomUUID()}`;
  tokens.set(accessToken, { kind: 'access', expiresAt: now + ACCESS_TTL_MS, user });
  tokens.set(refreshToken, { kind: 'refresh', expiresAt: now + REFRESH_TTL_MS, user });
  return { accessToken, refreshToken, expiresAt: new Date(now + ACCESS_TTL_MS).toISOString() };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** POST /auth/login. */
export function login(body: Record<string, unknown>): AuthResult<TokenPair> {
  if (authMode === 'passthrough') return fail(404, 'NOT_FOUND', 'login is not available in passthrough auth mode');
  if (authMode === 'jwt' || authMode === 'static') {
    const cluster = str(body.cluster);
    const token = str(body.token);
    if (!cluster || !token) return fail(400, 'BAD_REQUEST', 'cluster and token are required');
    if (!store.getCluster(cluster)) return fail(400, 'BAD_REQUEST', `unknown cluster "${cluster}"`);
    return { ok: true, data: issue(`token@${cluster}`) };
  }
  // dex / openshift: username + password
  const username = str(body.username);
  const password = str(body.password);
  if (!username || !password) return fail(400, 'BAD_REQUEST', 'username and password are required');
  if (password === 'wrong') return fail(401, 'UNAUTHORIZED', 'invalid username or password');
  return { ok: true, data: issue(username) };
}

/** POST /auth/refresh: rotates the pair (old refresh token is consumed). */
export function refresh(body: Record<string, unknown>): AuthResult<TokenPair> {
  const rt = str(body.refreshToken);
  const info = tokens.get(rt);
  if (!info || info.kind !== 'refresh' || info.expiresAt <= Date.now()) {
    tokens.delete(rt);
    return fail(401, 'UNAUTHORIZED', 'invalid or expired refresh token');
  }
  tokens.delete(rt);
  return { ok: true, data: issue(info.user) };
}

/** GET /auth/openshift/authorize. */
export function openshiftAuthorize(): AuthResult<{ authorizeUrl: string; state: string }> {
  if (authMode !== 'openshift') return fail(404, 'NOT_FOUND', 'openshift auth is not enabled');
  const state = crypto.randomUUID();
  // Abandoned flows never hit /callback; cap the set so it can't grow forever.
  if (openshiftStates.size > 1000) openshiftStates.clear();
  openshiftStates.add(state);
  const authorizeUrl = `${FRONTEND_URL}/login?code=mock-code&state=${state}`;
  return { ok: true, data: { authorizeUrl, state } };
}

/** POST /auth/openshift/callback. */
export function openshiftCallback(body: Record<string, unknown>): AuthResult<TokenPair> {
  if (authMode !== 'openshift') return fail(404, 'NOT_FOUND', 'openshift auth is not enabled');
  const code = str(body.code);
  const state = str(body.state);
  if (!code || !state) return fail(400, 'BAD_REQUEST', 'code and state are required');
  if (!openshiftStates.delete(state)) return fail(401, 'UNAUTHORIZED', 'unknown or already used OAuth state');
  return { ok: true, data: issue('openshift-user') };
}

/** Bearer check for /api/v1/clusters/**: passthrough accepts any non-empty token, others need a live access token. */
export function authenticate(req: IncomingMessage): boolean {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  if (!m) return false;
  if (authMode === 'passthrough') return true;
  const info = tokens.get(m[1]);
  return !!info && info.kind === 'access' && info.expiresAt > Date.now();
}
