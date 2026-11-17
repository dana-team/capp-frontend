/**
 * Mock of the capp-backend cfunc API: pools and functions.
 * Env: MOCK_CFUNC=off leaves every cfunc route out, MOCK_CFUNC=pools leaves the
 * function routes out, like a backend with the feature turned off.
 */
import type { ServerResponse } from 'node:http';
import type {
  BuildStatus,
  FunctionRequest,
  FunctionResponse,
  FunctionTestRequest,
  FunctionTrigger,
  PoolRequest,
  PoolResponse,
} from '../src/types/cfunc';

type Body = Record<string, unknown>;

interface Ctx {
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Body;
}

export interface CfuncDeps {
  route: (method: string, pattern: string, handler: (ctx: Ctx) => void) => void;
  send: (res: ServerResponse, status: number, body?: unknown) => void;
  error: (res: ServerResponse, status: number, code: string, message: string) => void;
  hasNamespace: (cluster: string, namespace: string) => boolean;
}

const MODE = process.env.MOCK_CFUNC ?? 'on';
const ROUTER_URL = 'http://router.fission.mock';
const BUILD_PENDING_MS = 3_000;
const BUILD_RUNNING_MS = 9_000;
const MAX_POOL_SIZE = 10;
const DNS_1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

const FLAVORS: Record<string, { image: string; builder?: string }> = {
  go: { image: 'go-env-1.23:1.35.0', builder: 'go-builder-1.23:1.35.0' },
  java: { image: 'jvm-env:1.32.0', builder: 'jvm-builder:1.32.0' },
  js: { image: 'node-env:1.34.0', builder: 'node-builder:1.34.0' },
  python: { image: 'python-env:1.35.0', builder: 'python-builder:1.35.0' },
  ruby: { image: 'ruby-env:1.32.0', builder: 'ruby-builder:1.32.0' },
};

const SIZES = {
  small: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '200m', memory: '256Mi' } },
  medium: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } },
  large: { requests: { cpu: '500m', memory: '512Mi' }, limits: { cpu: '1', memory: '1Gi' } },
};
const DEFAULT_SIZE = 'small';
const REGISTRY = 'registry.mock/fission';

interface StoredFunction {
  response: FunctionResponse;
  /** When the code was last cloned; the build state is derived from its age. */
  deployedAt: number;
  builds: boolean;
  buildFails: boolean;
}

const pools = new Map<string, PoolResponse>();
const functions = new Map<string, StoredFunction>();
let counter = 0;

const key = (cluster: string, ns: string, name: string) => `${cluster}/${ns}/${name}`;
const uid = () => `cfunc-${(++counter).toString(16).padStart(8, '0')}-mock`;
const hash = () => Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const listOf = <T>(items: T[]) => ({ items, total: items.length });

function inScope<T>(map: Map<string, T>, cluster: string, ns?: string): T[] {
  const prefix = ns ? `${cluster}/${ns}/` : `${cluster}/`;
  return [...map.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
}

function buildPool(ns: string, req: PoolRequest, existing?: PoolResponse): PoolResponse | string {
  const flavor = FLAVORS[req.flavor];
  if (!flavor) return `flavor "${req.flavor}" is not one of: ${Object.keys(FLAVORS).join(', ')}`;
  const sizeName = req.size || DEFAULT_SIZE;
  const size = SIZES[sizeName as keyof typeof SIZES];
  if (!size) return `size "${sizeName}" is not one of: ${Object.keys(SIZES).join(', ')}`;
  const poolSize = req.poolSize ?? 3;
  if (poolSize < 0 || poolSize > MAX_POOL_SIZE) return `poolSize must be between 0 and ${MAX_POOL_SIZE}`;
  if (req.advanced?.buildImage || req.advanced?.buildCommand) {
    return 'advanced.buildImage and advanced.buildCommand are not allowed: custom builds are disabled';
  }
  const custom = req.advanced?.resources;
  const resources = {
    requests: { ...size.requests, ...custom?.requests },
    limits: { ...size.limits, ...custom?.limits },
  };
  return {
    name: req.name,
    namespace: ns,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    uid: existing?.uid ?? uid(),
    resourceVersion: String(++counter),
    flavor: req.flavor,
    size: custom ? '' : sizeName,
    poolSize,
    resources,
    image: `${REGISTRY}/${flavor.image}`,
    builder: flavor.builder ? { image: `${REGISTRY}/${flavor.builder}`, command: 'build' } : undefined,
    env: req.env,
    advanced: custom ? { resources: custom } : undefined,
    version: 3,
    terminationGracePeriodSeconds: 360,
    status: {
      conditions: [{
        type: 'Ready', status: 'True', reason: 'EnvironmentReady',
        lastTransitionTime: new Date().toISOString(),
      }],
    },
  };
}

function checkFunction(cluster: string, ns: string, req: FunctionRequest): string | undefined {
  if (!req.pool || !pools.has(key(cluster, ns, req.pool))) return `pool "${req.pool}" not found in namespace ${ns}`;
  if (!req.source?.url?.startsWith('https://')) return 'source.url must be an https URL under the git base URL';
  const triggers = req.triggers ?? [];
  if (triggers.length > 10) return 'a function has at most 10 triggers';
  const names = new Set<string>();
  for (const [i, t] of triggers.entries()) {
    if (!t.name || !DNS_1123.test(t.name)) return `triggers[${i}]: name is not a valid DNS-1123 label`;
    if (names.has(t.name)) return `triggers[${i}]: duplicate name "${t.name}"`;
    names.add(t.name);
    if (t.type === 'cron' && !t.schedule) return `triggers[${i}]: schedule is required for a cron trigger`;
    if (t.type === 'http' && t.path && !t.path.startsWith('/')) return `triggers[${i}]: path must start with "/"`;
    if (t.type !== 'http' && t.type !== 'cron') return `triggers[${i}]: type must be "http" or "cron"`;
  }
  const timeout = req.timeoutSeconds ?? 60;
  if (timeout < 1 || timeout > 300) return 'timeoutSeconds must be between 1 and 300';
  return undefined;
}

function buildFunction(cluster: string, ns: string, req: FunctionRequest, existing?: StoredFunction): StoredFunction {
  const pool = pools.get(key(cluster, ns, req.pool));
  const oneFile = /\.[a-z]+$/.test(req.source.path ?? '');
  const builds = req.source.build ?? (Boolean(pool?.builder) && !oneFile);
  const triggers: FunctionTrigger[] = (req.triggers ?? []).map((t) => {
    if (t.type === 'cron') return { name: t.name, type: 'cron', schedule: t.schedule, status: 'CronRegistered' };
    const fullPath = `/${ns}/${req.name}${t.path ?? ''}`;
    return {
      name: t.name,
      type: 'http',
      path: t.path,
      methods: t.methods?.length ? t.methods : ['GET'],
      fullPath,
      url: `${ROUTER_URL}${fullPath}`,
      status: 'RouteAdmitted',
    };
  });
  return {
    deployedAt: Date.now(),
    builds,
    buildFails: req.source.url.includes('broken'),
    response: {
      name: req.name,
      namespace: ns,
      createdAt: existing?.response.createdAt ?? new Date().toISOString(),
      uid: existing?.response.uid ?? uid(),
      resourceVersion: String(++counter),
      pool: req.pool,
      source: { url: req.source.url, ref: req.source.ref, path: req.source.path, build: builds, commit: hash() },
      entrypoint: req.entrypoint,
      timeoutSeconds: req.timeoutSeconds ?? 60,
      secretVolumes: req.secretVolumes?.map((v) => ({
        secretName: v.secretName, name: v.secretName, mountPath: `/secrets/${ns}/${v.secretName}`,
      })),
      configMapVolumes: req.configMapVolumes?.map((v) => ({
        configMapName: v.configMapName, name: v.configMapName, mountPath: `/configs/${ns}/${v.configMapName}`,
      })),
      triggers,
      advanced: req.advanced && Object.values(req.advanced).some((x) => x !== undefined && x !== false)
        ? req.advanced
        : undefined,
      build: { status: '' },
      status: { conditions: [] },
    },
  };
}

/** The build runs after the write returns, so its state depends on when the function is read. */
function present(stored: StoredFunction): FunctionResponse {
  const age = Date.now() - stored.deployedAt;
  let status: BuildStatus = 'none';
  let log: string | undefined;
  if (stored.builds) {
    status = age < BUILD_PENDING_MS ? 'pending' : age < BUILD_RUNNING_MS ? 'running' : stored.buildFails ? 'failed' : 'succeeded';
    if (status !== 'pending') {
      log = ['+ build', 'Collecting dependencies', 'Installing collected packages'].join('\n');
      if (status === 'succeeded') log += '\nBuild succeeded';
      if (status === 'failed') log += '\nERROR: could not find a version that satisfies the requirement\nexit status 1';
    }
  }
  return { ...stored.response, build: { status, log } };
}

export function registerCfuncRoutes({ route, send, error, hasNamespace }: CfuncDeps): void {
  if (MODE === 'off') return;

  const bad = (res: ServerResponse, message: string) => error(res, 400, 'BAD_REQUEST', message);
  const missing = (res: ServerResponse, what: string) => error(res, 404, 'NOT_FOUND', `${what} not found`);
  /** Returns true (after replying) when the namespace does not exist. */
  const noNamespace = ({ res, params }: Ctx) => {
    if (hasNamespace(params.cluster, params.namespace)) return false;
    missing(res, `namespace "${params.namespace}"`);
    return true;
  };

  route('GET', '/api/v1/cfunc/flavors', ({ res }) => send(res, 200, listOf(Object.keys(FLAVORS))));
  route('GET', '/api/v1/cfunc/sizes', ({ res }) => send(res, 200, listOf(Object.keys(SIZES))));

  const POOLS = '/api/v1/clusters/:cluster/namespaces/:namespace/cfunc/pools';
  route('GET', '/api/v1/clusters/:cluster/cfunc/pools', ({ res, params }) =>
    send(res, 200, listOf(inScope(pools, params.cluster))));
  route('GET', POOLS, (ctx) => {
    if (noNamespace(ctx)) return;
    send(ctx.res, 200, listOf(inScope(pools, ctx.params.cluster, ctx.params.namespace)));
  });
  route('POST', POOLS, (ctx) => {
    if (noNamespace(ctx)) return;
    const { res, params, body } = ctx;
    const req = body as unknown as PoolRequest;
    if (!req.name || !DNS_1123.test(req.name)) return bad(res, 'name is not a valid DNS-1123 label');
    const k = key(params.cluster, params.namespace, req.name);
    if (pools.has(k)) return error(res, 409, 'CONFLICT', `pool ${req.name} already exists`);
    const pool = buildPool(params.namespace, req);
    if (typeof pool === 'string') return bad(res, pool);
    pools.set(k, pool);
    send(res, 201, pool);
  });
  route('GET', `${POOLS}/:name`, ({ res, params }) => {
    const pool = pools.get(key(params.cluster, params.namespace, params.name));
    pool ? send(res, 200, pool) : missing(res, `pool "${params.name}"`);
  });
  route('PUT', `${POOLS}/:name`, ({ res, params, body }) => {
    const k = key(params.cluster, params.namespace, params.name);
    const existing = pools.get(k);
    if (!existing) return missing(res, `pool "${params.name}"`);
    const pool = buildPool(params.namespace, { ...(body as unknown as PoolRequest), name: params.name }, existing);
    if (typeof pool === 'string') return bad(res, pool);
    pools.set(k, pool);
    send(res, 200, pool);
  });
  route('DELETE', `${POOLS}/:name`, ({ res, params }) => {
    const k = key(params.cluster, params.namespace, params.name);
    if (!pools.has(k)) return missing(res, `pool "${params.name}"`);
    const users = inScope(functions, params.cluster, params.namespace).filter((f) => f.response.pool === params.name);
    if (users.length > 0) {
      return error(res, 409, 'CONFLICT',
        `pool ${params.name} is used by functions: ${users.map((f) => f.response.name).join(', ')}`);
    }
    pools.delete(k);
    send(res, 204);
  });

  if (MODE === 'pools') return;

  const FUNCTIONS = '/api/v1/clusters/:cluster/namespaces/:namespace/cfunc/functions';
  const found = ({ res, params }: Ctx): StoredFunction | undefined => {
    const stored = functions.get(key(params.cluster, params.namespace, params.name));
    if (!stored) missing(res, `function "${params.name}"`);
    return stored;
  };

  route('GET', '/api/v1/clusters/:cluster/cfunc/functions', ({ res, params }) =>
    send(res, 200, listOf(inScope(functions, params.cluster).map(present))));
  route('GET', FUNCTIONS, (ctx) => {
    if (noNamespace(ctx)) return;
    send(ctx.res, 200, listOf(inScope(functions, ctx.params.cluster, ctx.params.namespace).map(present)));
  });
  route('POST', FUNCTIONS, (ctx) => {
    if (noNamespace(ctx)) return;
    const { res, params, body } = ctx;
    const req = body as unknown as FunctionRequest;
    if (!req.name || !DNS_1123.test(req.name)) return bad(res, 'name is not a valid DNS-1123 label');
    const k = key(params.cluster, params.namespace, req.name);
    if (functions.has(k)) {
      return error(res, 409, 'CONFLICT', `function ${req.name} already exists; update it with PUT`);
    }
    const invalid = checkFunction(params.cluster, params.namespace, req);
    if (invalid) return bad(res, invalid);
    const stored = buildFunction(params.cluster, params.namespace, req);
    functions.set(k, stored);
    send(res, 201, present(stored));
  });
  route('GET', `${FUNCTIONS}/:name`, (ctx) => {
    const stored = found(ctx);
    if (stored) send(ctx.res, 200, present(stored));
  });
  route('PUT', `${FUNCTIONS}/:name`, (ctx) => {
    const existing = found(ctx);
    if (!existing) return;
    const { res, params, body } = ctx;
    const req = { ...(body as unknown as FunctionRequest), name: params.name };
    const invalid = checkFunction(params.cluster, params.namespace, req);
    if (invalid) return bad(res, invalid);
    const stored = buildFunction(params.cluster, params.namespace, req, existing);
    functions.set(key(params.cluster, params.namespace, params.name), stored);
    send(res, 200, present(stored));
  });
  route('DELETE', `${FUNCTIONS}/:name`, (ctx) => {
    if (!found(ctx)) return;
    functions.delete(key(ctx.params.cluster, ctx.params.namespace, ctx.params.name));
    send(ctx.res, 204);
  });
  route('POST', `${FUNCTIONS}/:name/test`, (ctx) => {
    const stored = found(ctx);
    if (!stored) return;
    const { res, body } = ctx;
    const req = body as FunctionTestRequest;
    const fn = present(stored);
    const http = fn.triggers.filter((t) => t.type === 'http');
    if (http.length === 0) return bad(res, `function ${fn.name} has no http trigger to test`);
    if (!req.trigger && http.length > 1) return bad(res, 'trigger is required: the function has more than one http trigger');
    const trigger = req.trigger ? http.find((t) => t.name === req.trigger) : http[0];
    if (!trigger) return bad(res, `function ${fn.name} has no http trigger named "${req.trigger}"`);
    const method = req.method ?? trigger.methods?.[0] ?? 'GET';
    const ready = fn.build.status === 'succeeded' || fn.build.status === 'none';
    send(res, 200, {
      url: trigger.url,
      method,
      statusCode: ready ? 200 : 500,
      headers: { 'Content-Type': ready ? 'application/json' : 'text/plain' },
      body: ready
        ? JSON.stringify({ message: `hello from ${fn.name}`, method, received: req.body ?? null }, null, 2)
        : `error loading function: build is ${fn.build.status}`,
      durationMs: 20 + Math.floor(Math.random() * 180),
    });
  });
  route('GET', `${FUNCTIONS}/:name/logs`, (ctx) => {
    const stored = found(ctx);
    if (!stored) return;
    const lines = Math.min(1000, Math.max(1, Number(ctx.query.get('lines')) || 100));
    const fn = stored.response;
    const now = Date.now();
    send(ctx.res, 200, {
      pods: [{
        pod: `poolmgr-${fn.pool}-${fn.namespace}-${fn.uid?.slice(6, 14)}-x7k2p`,
        lines: Array.from({ length: Math.min(lines, 12) }, (_, i) =>
          `${new Date(now - (12 - i) * 5_000).toISOString()} INFO request ${i + 1} served by ${fn.name}`),
      }],
    });
  });
}

/** Puts a few pools and functions in the given namespaces, so the pages are not empty. */
export function seedCfunc(cluster: string, namespaces: string[]): void {
  if (MODE === 'off') return;
  const examples = 'https://github.com/fission/examples';
  namespaces.slice(0, 2).forEach((ns, i) => {
    const flavors = i === 0 ? ['python', 'js'] : ['go'];
    for (const flavor of flavors) {
      const pool = buildPool(ns, { name: `${flavor}-pool`, flavor, size: i === 0 ? 'small' : 'medium' });
      if (typeof pool !== 'string') pools.set(key(cluster, ns, pool.name), pool);
    }
    if (MODE === 'pools') return;
    const requests: FunctionRequest[] = i === 0
      ? [
          {
            name: 'hello', pool: 'python-pool', source: { url: examples, path: 'python/hello.py' },
            triggers: [{ name: 'api', type: 'http', path: '', methods: ['GET', 'POST'] }],
          },
          {
            name: 'report', pool: 'python-pool', entrypoint: 'main.handler',
            source: { url: examples, ref: 'main', path: 'python/sourcepkg' },
            triggers: [
              { name: 'nightly', type: 'cron', schedule: '0 2 * * *' },
              { name: 'run', type: 'http', path: '/run', methods: ['POST'] },
            ],
            advanced: { concurrency: 10 },
          },
          {
            name: 'resize', pool: 'js-pool', source: { url: `${examples}-broken`, path: 'nodejs/resize' },
            triggers: [{ name: 'api', type: 'http', path: '/resize', methods: ['POST'] }],
          },
        ]
      : [
          {
            name: 'ping', pool: 'go-pool', entrypoint: 'Handler', source: { url: examples, path: 'go/hello-world' },
            triggers: [{ name: 'api', type: 'http' }],
          },
        ];
    for (const req of requests) {
      const stored = buildFunction(cluster, ns, req);
      // Seeded functions are past their build when the server starts.
      stored.deployedAt -= BUILD_RUNNING_MS;
      functions.set(key(cluster, ns, req.name), stored);
    }
  });
}
