import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { backendFetch, clusterBase } from '../client.js';

interface CappResponse {
  name: string;
  namespace: string;
  image: string;
  state?: string;
  scaleMetric?: string;
  minReplicas: number;
  status: {
    conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
    applicationLinks: { site?: string; consoleLink?: string };
    stateStatus: { state?: string; lastChange?: string };
  };
}

interface CappListResponse {
  items: CappResponse[];
  total: number;
}

function resolveSessionId(extra: { sessionId?: string }): string {
  return extra.sessionId ?? 'default';
}

function formatCappSummary(c: CappResponse): string {
  const state = c.status?.stateStatus?.state ?? c.state ?? 'unknown';
  return `${c.namespace}/${c.name} | image: ${c.image} | state: ${state} | replicas: ${c.minReplicas}`;
}

function formatCappDetail(c: CappResponse): string {
  const lines: string[] = [
    `Name: ${c.name}`,
    `Namespace: ${c.namespace}`,
    `Image: ${c.image}`,
    `State: ${c.state ?? 'N/A'}`,
    `Scale Metric: ${c.scaleMetric ?? 'N/A'}`,
    `Min Replicas: ${c.minReplicas}`,
  ];

  if (c.status?.applicationLinks?.site) {
    lines.push(`Site URL: ${c.status.applicationLinks.site}`);
  }

  if (c.status?.stateStatus?.state) {
    lines.push(`Runtime State: ${c.status.stateStatus.state}`);
  }

  if (c.status?.conditions?.length) {
    lines.push('', 'Conditions:');
    for (const cond of c.status.conditions) {
      lines.push(`  - ${cond.type}: ${cond.status}${cond.reason ? ` (${cond.reason})` : ''}`);
      if (cond.message) lines.push(`    ${cond.message}`);
    }
  }

  return lines.join('\n');
}

export function registerCappTools(server: McpServer): void {
  server.registerTool(
    'list-capps',
    {
      title: 'List Capps',
      description: 'List Capp applications. Optionally filter by namespace.',
      inputSchema: {
        namespace: z.string().optional().describe('Namespace to filter by. Omit to list across all namespaces.'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const path = params.namespace
          ? `${base}/namespaces/${encodeURIComponent(params.namespace)}/capps`
          : `${base}/capps`;

        const data = await backendFetch<CappListResponse>(sessionId, path);

        if (!data.items.length) {
          return { content: [{ type: 'text' as const, text: 'No Capps found.' }] };
        }

        const lines = data.items.map(formatCappSummary);
        return {
          content: [{ type: 'text' as const, text: `Capps (${data.total}):\n${lines.join('\n')}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get-capp',
    {
      title: 'Get Capp',
      description: 'Get detailed information about a specific Capp, including status conditions and links.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Capp'),
        name: z.string().describe('Name of the Capp'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);
        const capp = await backendFetch<CappResponse>(sessionId, `${base}/namespaces/${ns}/capps/${n}`);

        return {
          content: [{ type: 'text' as const, text: formatCappDetail(capp) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create-capp',
    {
      title: 'Create Capp',
      description: 'Create a new Capp application in a namespace.',
      inputSchema: {
        namespace: z.string().describe('Target namespace'),
        name: z.string().describe('Capp name'),
        image: z.string().describe('Container image (e.g. nginx:latest)'),
        state: z.enum(['enabled', 'disabled']).default('enabled').describe('Initial state'),
        scaleMetric: z.enum(['concurrency', 'cpu', 'memory', 'rps']).default('concurrency').describe('Scale metric'),
        minReplicas: z.number().int().min(0).optional().describe('Minimum number of replicas'),
        containerName: z.string().optional().describe('Container name override'),
        env: z.array(z.object({ name: z.string(), value: z.string() })).optional().describe('Environment variables'),
        hostname: z.string().optional().describe('Route hostname'),
        tlsEnabled: z.boolean().optional().describe('Enable TLS on the route'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);

        const body: Record<string, unknown> = {
          name: params.name,
          image: params.image,
          state: params.state,
          scaleMetric: params.scaleMetric,
        };
        if (params.minReplicas !== undefined) body.minReplicas = params.minReplicas;
        if (params.containerName) body.containerName = params.containerName;
        if (params.env?.length) body.env = params.env;
        if (params.hostname || params.tlsEnabled !== undefined) {
          body.routeSpec = {
            ...(params.hostname ? { hostname: params.hostname } : {}),
            ...(params.tlsEnabled !== undefined ? { tlsEnabled: params.tlsEnabled } : {}),
          };
        }

        const capp = await backendFetch<CappResponse>(sessionId, `${base}/namespaces/${ns}/capps`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text' as const, text: `Capp "${capp.name}" created in namespace "${capp.namespace}".\n\n${formatCappDetail(capp)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error creating Capp: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update-capp',
    {
      title: 'Update Capp',
      description: 'Update an existing Capp. Only provided fields will be changed.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Capp'),
        name: z.string().describe('Name of the Capp to update'),
        image: z.string().optional().describe('New container image'),
        state: z.enum(['enabled', 'disabled']).optional().describe('New state'),
        scaleMetric: z.enum(['concurrency', 'cpu', 'memory', 'rps']).optional().describe('New scale metric'),
        minReplicas: z.number().int().min(0).optional().describe('New minimum replicas'),
        env: z.array(z.object({ name: z.string(), value: z.string() })).optional().describe('New environment variables (replaces all)'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        const current = await backendFetch<CappResponse>(sessionId, `${base}/namespaces/${ns}/capps/${n}`);

        const body: Record<string, unknown> = {
          name: params.name,
          image: params.image ?? current.image,
          state: params.state ?? current.state,
          scaleMetric: params.scaleMetric ?? current.scaleMetric,
          minReplicas: params.minReplicas ?? current.minReplicas,
        };
        if (params.env !== undefined) body.env = params.env;

        const capp = await backendFetch<CappResponse>(sessionId, `${base}/namespaces/${ns}/capps/${n}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text' as const, text: `Capp "${capp.name}" updated.\n\n${formatCappDetail(capp)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error updating Capp: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'delete-capp',
    {
      title: 'Delete Capp',
      description: 'Delete a Capp application. This action is irreversible.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Capp'),
        name: z.string().describe('Name of the Capp to delete'),
      },
      annotations: { destructiveHint: true },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        await backendFetch<void>(sessionId, `${base}/namespaces/${ns}/capps/${n}`, { method: 'DELETE' });

        return {
          content: [{ type: 'text' as const, text: `Capp "${params.name}" deleted from namespace "${params.namespace}".` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error deleting Capp: ${msg}` }], isError: true };
      }
    },
  );
}
