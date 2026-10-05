/**
 * Mock capp-backend HTTP server (node:http, no framework).
 * Env: PORT (8080), MOCK_SEED, MOCK_AUTH_MODE, MOCK_TOKEN_TTL, MOCK_LATENCY_MS.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CappRequest, MigrateRequest } from '../src/types/capp';
import type { ConfigMapRequest, ConfigMapUpdateRequest } from '../src/types/configmap';
import type { SecretRequest, SecretUpdateRequest } from '../src/types/secret';
import type {
  CreateNamespaceRequest,
  PatchNamespaceRequest,
  UpdateNamespaceRequest,
} from '../src/api/namespaces';
import { store, ConflictError, NotFoundError } from './store';
import { seedStore } from './seed';
import * as auth from './auth';

const PORT = Number(process.env.PORT) || 8080;
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS) || 0;
const SPEC_PATH = fileURLToPath(new URL('../../capp-backend/api/openapi.yaml', import.meta.url));
const DNS_1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const DNS_1123_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

// ── Helpers ──────────────────────────────────────────────────────────────────

type Body = Record<string, unknown>;

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  body: Body;
}

type Handler = (ctx: Ctx) => void;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept,X-Backend-Url',
};

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined || status === 204) {
    res.writeHead(status, CORS).end();
    return;
  }
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function error(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { error: { code, message, status } });
}

const notFound = (res: ServerResponse, what: string) => error(res, 404, 'NOT_FOUND', `${what} not found`);
const badRequest = (res: ServerResponse, message: string) => error(res, 400, 'BAD_REQUEST', message);

function readBody(req: IncomingMessage): Promise<Body> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return reject(new Error('body must be a JSON object'));
        resolve(parsed as Body);
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

interface Route {
  method: string;
  re: RegExp;
  names: string[];
  handler: Handler;
}

const routes: Route[] = [];

/** `:param` segments match a single path segment. Register specific routes before parameterised siblings. */
function route(method: string, pattern: string, handler: Handler): void {
  const names: string[] = [];
  const src = pattern.replace(/:(\w+)/g, (_, n: string) => {
    names.push(n);
    return '([^/]+)';
  });
  routes.push({ method, re: new RegExp(`^${src}/?$`), names, handler });
}

// ── Shared checks ────────────────────────────────────────────────────────────

/** Returns true (after replying) when the cluster is unknown or unhealthy. */
function clusterGuard(res: ServerResponse, name: string): boolean {
  const c = store.getCluster(name);
  if (!c) {
    error(res, 404, 'CLUSTER_NOT_FOUND', `cluster "${name}" not found`);
    return true;
  }
  if (!c.healthy) {
    error(res, 503, 'CLUSTER_UNHEALTHY', `cluster "${name}" is currently unhealthy`);
    return true;
  }
  return false;
}

/** Runs `fn`, mapping store errors to 404/409. */
function guarded(res: ServerResponse, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConflictError) error(res, 409, 'CONFLICT', e.message);
    else if (e instanceof NotFoundError) error(res, 404, 'NOT_FOUND', e.message);
    else throw e;
  }
}

function checkName(res: ServerResponse, name: unknown, what: string): name is string {
  if (typeof name !== 'string' || !name) {
    badRequest(res, `${what} name is required`);
    return false;
  }
  if (name.length > 63 || !DNS_1123.test(name)) {
    badRequest(res, `${what} name "${name}" is not a valid DNS-1123 label`);
    return false;
  }
  return true;
}

function checkData(res: ServerResponse, data: unknown): boolean {
  if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    badRequest(res, 'data must be an object of string values');
    return false;
  }
  return true;
}

function checkCapp(res: ServerResponse, req: Body, requireName: boolean): boolean {
  if (requireName && !checkName(res, req.name, 'capp')) return false;
  if (typeof req.image !== 'string' || !req.image) {
    badRequest(res, 'image is required');
    return false;
  }
  // Mirrors capp-backend: DNS-1123 subdomain names, no duplicates, existence not checked.
  if (req.imagePullSecrets !== undefined) {
    const names = req.imagePullSecrets;
    if (!Array.isArray(names) || names.some((n) => typeof n !== 'string')) {
      badRequest(res, 'imagePullSecrets must be an array of strings');
      return false;
    }
    const seen = new Set<string>();
    for (const n of names as string[]) {
      if (n.length > 253 || !DNS_1123_SUBDOMAIN.test(n)) {
        badRequest(res, `imagePullSecrets: invalid secret name "${n}"`);
        return false;
      }
      if (seen.has(n)) {
        badRequest(res, `imagePullSecrets: duplicate secret name "${n}"`);
        return false;
      }
      seen.add(n);
    }
  }
  return true;
}

const listOf = <T>(items: T[]) => ({ items, total: items.length });

// ── Public routes ────────────────────────────────────────────────────────────

route('GET', '/healthz', ({ res }) => send(res, 200, { status: 'ok' }));
route('GET', '/readyz', ({ res }) => {
  if (store.listClusters().some((c) => c.healthy)) send(res, 200, { status: 'ready' });
  else send(res, 503, { status: 'not ready', reason: 'no healthy clusters available' });
});
route('GET', '/openapi.yaml', ({ res }) => {
  if (!existsSync(SPEC_PATH)) return notFound(res, 'openapi.yaml');
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/yaml' }).end(readFileSync(SPEC_PATH));
});

route('GET', '/api/v1/auth/mode', ({ res }) => send(res, 200, { mode: auth.authMode }));
const authReply = <T>(res: ServerResponse, r: auth.AuthResult<T>) =>
  r.ok ? send(res, 200, r.data) : error(res, r.status, r.code, r.message);
route('POST', '/api/v1/auth/login', ({ res, body }) => authReply(res, auth.login(body)));
route('POST', '/api/v1/auth/refresh', ({ res, body }) => authReply(res, auth.refresh(body)));
route('GET', '/api/v1/auth/openshift/authorize', ({ res }) => authReply(res, auth.openshiftAuthorize()));
route('POST', '/api/v1/auth/openshift/callback', ({ res, body }) => authReply(res, auth.openshiftCallback(body)));
route('GET', '/api/v1/sizes', ({ res }) => send(res, 200, store.getSizes()));

// ── Clusters ─────────────────────────────────────────────────────────────────

route('GET', '/api/v1/clusters', ({ res }) => send(res, 200, { items: store.listClusters() }));
route('GET', '/api/v1/clusters/:cluster', ({ res, params }) => {
  const c = store.getCluster(params.cluster);
  if (!c) return error(res, 404, 'CLUSTER_NOT_FOUND', `cluster "${params.cluster}" not found`);
  send(res, 200, c);
});

// ── Namespaces ───────────────────────────────────────────────────────────────

const NS = '/api/v1/clusters/:cluster/namespaces';

route('GET', NS, ({ res, params }) => {
  const r = store.listNamespaces(params.cluster);
  r ? send(res, 200, r) : notFound(res, 'cluster');
});
route('POST', NS, ({ res, params, body }) => {
  if (!checkName(res, body.name, 'namespace')) return;
  guarded(res, () => {
    const ns = store.createNamespace(params.cluster, body as unknown as CreateNamespaceRequest);
    ns ? send(res, 201, ns) : notFound(res, 'cluster');
  });
});
route('GET', `${NS}/:namespace`, ({ res, params }) => {
  const ns = store.getNamespace(params.cluster, params.namespace);
  ns ? send(res, 200, ns) : notFound(res, `namespace "${params.namespace}"`);
});
route('PUT', `${NS}/:namespace`, ({ res, params, body }) => {
  const ns = store.updateNamespace(params.cluster, params.namespace, body as unknown as UpdateNamespaceRequest);
  ns ? send(res, 200, ns) : notFound(res, `namespace "${params.namespace}"`);
});
route('PATCH', `${NS}/:namespace`, ({ res, params, body }) => {
  const ns = store.patchNamespace(params.cluster, params.namespace, body as unknown as PatchNamespaceRequest);
  ns ? send(res, 200, ns) : notFound(res, `namespace "${params.namespace}"`);
});
route('DELETE', `${NS}/:namespace`, ({ res, params }) => {
  const { cluster, namespace } = params;
  if (!store.getNamespace(cluster, namespace)) return notFound(res, `namespace "${namespace}"`);
  if (store.listCapps(cluster, namespace)?.length) {
    return error(res, 409, 'CONFLICT', `namespace "${namespace}" contains Capps and cannot be deleted`);
  }
  store.deleteNamespace(cluster, namespace);
  send(res, 204);
});

// ── ConfigMaps ───────────────────────────────────────────────────────────────

const CM = `${NS}/:namespace/configmaps`;

route('GET', '/api/v1/clusters/:cluster/configmaps', ({ res, params }) => {
  const r = store.listConfigMaps(params.cluster);
  r ? send(res, 200, listOf(r)) : notFound(res, 'cluster');
});
route('GET', CM, ({ res, params }) => {
  const r = store.listConfigMaps(params.cluster, params.namespace);
  r ? send(res, 200, listOf(r)) : notFound(res, `namespace "${params.namespace}"`);
});
route('GET', `${CM}/names`, ({ res, params }) => {
  const r = store.listConfigMapNames(params.cluster, params.namespace);
  r ? send(res, 200, listOf(r)) : notFound(res, `namespace "${params.namespace}"`);
});
route('POST', CM, ({ res, params, body }) => {
  if (!checkName(res, body.name, 'configmap') || !checkData(res, body.data)) return;
  guarded(res, () => {
    const r = store.createConfigMap(params.cluster, params.namespace, body as unknown as ConfigMapRequest);
    r ? send(res, 201, r) : notFound(res, 'cluster');
  });
});
route('GET', `${CM}/:name`, ({ res, params }) => {
  const r = store.getConfigMap(params.cluster, params.namespace, params.name);
  r ? send(res, 200, r) : notFound(res, `configmap "${params.name}"`);
});
route('PUT', `${CM}/:name`, ({ res, params, body }) => {
  if (!checkData(res, body.data)) return;
  const r = store.updateConfigMap(params.cluster, params.namespace, params.name, body as unknown as ConfigMapUpdateRequest);
  r ? send(res, 200, r) : notFound(res, `configmap "${params.name}"`);
});
route('DELETE', `${CM}/:name`, ({ res, params }) => {
  store.deleteConfigMap(params.cluster, params.namespace, params.name)
    ? send(res, 204)
    : notFound(res, `configmap "${params.name}"`);
});

// ── Secrets ──────────────────────────────────────────────────────────────────

const SEC = `${NS}/:namespace/secrets`;

route('GET', '/api/v1/clusters/:cluster/secrets', ({ res, params }) => {
  const r = store.listSecrets(params.cluster);
  r ? send(res, 200, listOf(r)) : notFound(res, 'cluster');
});
route('GET', SEC, ({ res, params }) => {
  const r = store.listSecrets(params.cluster, params.namespace);
  r ? send(res, 200, listOf(r)) : notFound(res, `namespace "${params.namespace}"`);
});
route('GET', `${SEC}/names`, ({ res, params }) => {
  const r = store.listSecretNames(params.cluster, params.namespace);
  r ? send(res, 200, listOf(r)) : notFound(res, `namespace "${params.namespace}"`);
});
route('POST', SEC, ({ res, params, body }) => {
  if (!checkName(res, body.name, 'secret') || !checkData(res, body.data)) return;
  guarded(res, () => {
    const r = store.createSecret(params.cluster, params.namespace, body as unknown as SecretRequest);
    r ? send(res, 201, r) : notFound(res, 'cluster');
  });
});
route('GET', `${SEC}/:name`, ({ res, params }) => {
  const r = store.getSecret(params.cluster, params.namespace, params.name);
  r ? send(res, 200, r) : notFound(res, `secret "${params.name}"`);
});
route('PUT', `${SEC}/:name`, ({ res, params, body }) => {
  if (!checkData(res, body.data)) return;
  const r = store.updateSecret(params.cluster, params.namespace, params.name, body as unknown as SecretUpdateRequest);
  r ? send(res, 200, r) : notFound(res, `secret "${params.name}"`);
});
route('DELETE', `${SEC}/:name`, ({ res, params }) => {
  store.deleteSecret(params.cluster, params.namespace, params.name)
    ? send(res, 204)
    : notFound(res, `secret "${params.name}"`);
});

// ── Capps ────────────────────────────────────────────────────────────────────

const CAPP = `${NS}/:namespace/capps`;
const cappNotFound = (res: ServerResponse, name: string) => error(res, 404, 'CAPP_NOT_FOUND', `capp "${name}" not found`);

route('GET', '/api/v1/clusters/:cluster/capps', ({ res, params }) => {
  const r = store.listCapps(params.cluster);
  r ? send(res, 200, listOf(r)) : notFound(res, 'cluster');
});
route('GET', CAPP, ({ res, params }) => {
  const r = store.listCapps(params.cluster, params.namespace);
  r ? send(res, 200, listOf(r)) : notFound(res, `namespace "${params.namespace}"`);
});
route('POST', CAPP, ({ res, params, body }) => {
  if (!checkCapp(res, body, true)) return;
  guarded(res, () => {
    const r = store.createCapp(params.cluster, params.namespace, body as unknown as CappRequest);
    r ? send(res, 201, r) : notFound(res, 'cluster');
  });
});
route('GET', `${CAPP}/:name`, ({ res, params }) => {
  const r = store.getCapp(params.cluster, params.namespace, params.name);
  r ? send(res, 200, r) : cappNotFound(res, params.name);
});
route('PUT', `${CAPP}/:name`, ({ res, params, body }) => {
  if (!checkCapp(res, body, false)) return;
  const r = store.updateCapp(params.cluster, params.namespace, params.name, body as unknown as CappRequest);
  r ? send(res, 200, r) : cappNotFound(res, params.name);
});
route('DELETE', `${CAPP}/:name`, ({ res, params }) => {
  store.deleteCapp(params.cluster, params.namespace, params.name) ? send(res, 204) : cappNotFound(res, params.name);
});
route('POST', `${CAPP}/:name/sync`, ({ res, params }) => {
  const r = store.setBackupLabel(params.cluster, params.namespace, params.name, true);
  r ? send(res, 200, r) : cappNotFound(res, params.name);
});
route('DELETE', `${CAPP}/:name/sync`, ({ res, params }) => {
  const r = store.setBackupLabel(params.cluster, params.namespace, params.name, false);
  r ? send(res, 200, r) : cappNotFound(res, params.name);
});
route('POST', `${CAPP}/:name/migrate`, ({ res, params, body }) => {
  const { targetCluster, targetNamespace } = body;
  if (typeof targetCluster !== 'string' || !targetCluster || typeof targetNamespace !== 'string' || !targetNamespace) {
    return badRequest(res, 'targetCluster and targetNamespace are required');
  }
  if (targetCluster === params.cluster && targetNamespace === params.namespace) {
    return badRequest(res, 'target must differ from the source cluster/namespace');
  }
  if (clusterGuard(res, targetCluster)) return;
  const req: MigrateRequest = {
    targetCluster,
    targetNamespace,
    deleteSource: body.deleteSource === true,
    ...(typeof body.targetHostname === 'string' && body.targetHostname ? { targetHostname: body.targetHostname } : {}),
  };
  const r = store.migrateCapp(params.cluster, params.namespace, params.name, req);
  if (r.ok) return send(res, 200, r.data);
  if (r.error === 'bad_request') return badRequest(res, r.message);
  if (r.error === 'conflict') return error(res, 409, 'CONFLICT', r.message);
  error(res, 404, r.error === 'source_not_found' ? 'CAPP_NOT_FOUND' : r.error === 'target_cluster_not_found' ? 'CLUSTER_NOT_FOUND' : 'NOT_FOUND', r.message);
});

// ── Server ───────────────────────────────────────────────────────────────────

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') return send(res, 204);
  if (LATENCY_MS > 0) await new Promise((r) => setTimeout(r, LATENCY_MS));

  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(path);
    if (!m) continue;

    // Everything under /clusters needs a Bearer token. /auth/*, /sizes and health
    // checks stay public, matching the real backend (openapi: "No authentication required").
    if (path.startsWith('/api/v1/clusters') && !auth.authenticate(req)) {
      return error(res, 401, 'UNAUTHORIZED', 'missing or invalid credentials');
    }
    const params: Record<string, string> = {};
    for (let i = 0; i < r.names.length; i++) {
      try {
        params[r.names[i]] = decodeURIComponent(m[i + 1]);
      } catch {
        return badRequest(res, 'malformed URL encoding');
      }
    }
    // Resource routes: 404 for unknown cluster, 503 for unhealthy (cluster detail stays readable).
    const isClusterDetail = /^\/api\/v1\/clusters\/[^/]+\/?$/.test(path);
    if (params.cluster && !isClusterDetail && clusterGuard(res, params.cluster)) return;

    let body: Body = {};
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        body = await readBody(req);
      } catch (e) {
        return badRequest(res, (e as Error).message);
      }
    }
    return r.handler({ req, res, params, body });
  }

  console.warn(`[mock] no route for ${method} ${path}`);
  error(res, 404, 'NOT_FOUND', `no mock route for ${method} ${path}`);
}

const server = createServer((req, res) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
  });
  handle(req, res).catch((e: unknown) => {
    console.error('[mock] handler error', e);
    if (!res.headersSent) error(res, 500, 'INTERNAL_ERROR', e instanceof Error ? e.message : 'internal error');
  });
});

const seed = seedStore(store);
server.listen(PORT, () => {
  console.log(`[mock] capp-backend mock listening on http://localhost:${PORT}`);
  console.log(`[mock] seed=${seed} (MOCK_SEED=${seed} to reproduce)  auth=${auth.authMode}  latency=${LATENCY_MS}ms`);
  for (const c of store.listClusters()) {
    const nss = store.listNamespaces(c.name)?.items.length ?? 0;
    const capps = store.listCapps(c.name)?.length ?? 0;
    const cms = store.listConfigMaps(c.name)?.length ?? 0;
    const secrets = store.listSecrets(c.name)?.length ?? 0;
    console.log(
      `[mock]   ${c.name}${c.healthy ? '' : ' (UNHEALTHY)'}${c.isOpenShift ? ' (openshift)' : ''}: ${nss} namespaces, ${capps} capps, ${cms} configmaps, ${secrets} secrets`,
    );
  }
});
