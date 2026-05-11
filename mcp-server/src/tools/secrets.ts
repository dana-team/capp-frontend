import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { backendFetch, clusterBase } from '../client.js';

interface SecretResponse {
  name: string;
  namespace: string;
  type?: string;
  data: Record<string, string>;
  createdAt?: string;
}

interface SecretListResponse {
  items: SecretResponse[];
  total: number;
}

function resolveSessionId(extra: { sessionId?: string }): string {
  return extra.sessionId ?? 'default';
}

function formatSecret(s: SecretResponse): string {
  const keys = Object.keys(s.data ?? {});
  const lines = [
    `Name: ${s.name}`,
    `Namespace: ${s.namespace}`,
  ];
  if (s.type) lines.push(`Type: ${s.type}`);
  lines.push(`Keys (${keys.length}): ${keys.join(', ') || '(empty)'}`);
  if (s.createdAt) lines.push(`Created: ${s.createdAt}`);
  lines.push('', 'Data:');
  for (const [k, v] of Object.entries(s.data ?? {})) {
    lines.push(`  ${k}: ${v}`);
  }
  return lines.join('\n');
}

export function registerSecretTools(server: McpServer): void {
  server.registerTool(
    'list-secrets',
    {
      title: 'List Secrets',
      description: 'List Secrets. Optionally filter by namespace.',
      inputSchema: {
        namespace: z.string().optional().describe('Namespace to filter by. Omit to list across all namespaces.'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const path = params.namespace
          ? `${base}/namespaces/${encodeURIComponent(params.namespace)}/secrets`
          : `${base}/secrets`;

        const data = await backendFetch<SecretListResponse>(sessionId, path);

        if (!data.items.length) {
          return { content: [{ type: 'text' as const, text: 'No Secrets found.' }] };
        }

        const lines = data.items.map(
          (s) => `  - ${s.namespace}/${s.name}${s.type ? ` (${s.type})` : ''} — ${Object.keys(s.data ?? {}).length} keys`,
        );
        return {
          content: [{ type: 'text' as const, text: `Secrets (${data.total}):\n${lines.join('\n')}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get-secret',
    {
      title: 'Get Secret',
      description: 'Get a Secret with all its data entries.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Secret'),
        name: z.string().describe('Name of the Secret'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);
        const secret = await backendFetch<SecretResponse>(sessionId, `${base}/namespaces/${ns}/secrets/${n}`);

        return { content: [{ type: 'text' as const, text: formatSecret(secret) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create-secret',
    {
      title: 'Create Secret',
      description: 'Create a new Secret with key-value data.',
      inputSchema: {
        namespace: z.string().describe('Target namespace'),
        name: z.string().describe('Secret name'),
        type: z.string().optional().describe('Secret type (e.g. Opaque, kubernetes.io/tls). Defaults to Opaque.'),
        data: z.record(z.string(), z.string()).describe('Key-value pairs for the Secret'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);

        const body: Record<string, unknown> = {
          name: params.name,
          namespace: params.namespace,
          data: params.data,
        };
        if (params.type) body.type = params.type;

        const secret = await backendFetch<SecretResponse>(sessionId, `${base}/namespaces/${ns}/secrets`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text' as const, text: `Secret "${secret.name}" created.\n\n${formatSecret(secret)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error creating Secret: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update-secret',
    {
      title: 'Update Secret',
      description: 'Update the data entries of an existing Secret. The provided data replaces all existing entries.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Secret'),
        name: z.string().describe('Name of the Secret to update'),
        data: z.record(z.string(), z.string()).describe('New key-value pairs (replaces all existing data)'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        const secret = await backendFetch<SecretResponse>(sessionId, `${base}/namespaces/${ns}/secrets/${n}`, {
          method: 'PUT',
          body: JSON.stringify({ data: params.data }),
        });

        return {
          content: [{ type: 'text' as const, text: `Secret "${secret.name}" updated.\n\n${formatSecret(secret)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error updating Secret: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'delete-secret',
    {
      title: 'Delete Secret',
      description: 'Delete a Secret. This action is irreversible.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the Secret'),
        name: z.string().describe('Name of the Secret to delete'),
      },
      annotations: { destructiveHint: true },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        await backendFetch<void>(sessionId, `${base}/namespaces/${ns}/secrets/${n}`, { method: 'DELETE' });

        return {
          content: [{ type: 'text' as const, text: `Secret "${params.name}" deleted from namespace "${params.namespace}".` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error deleting Secret: ${msg}` }], isError: true };
      }
    },
  );
}
