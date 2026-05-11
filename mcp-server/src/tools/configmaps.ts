import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { backendFetch, clusterBase } from '../client.js';

interface ConfigMapResponse {
  name: string;
  namespace: string;
  data: Record<string, string>;
  createdAt?: string;
}

interface ConfigMapListResponse {
  items: ConfigMapResponse[];
  total: number;
}

function resolveSessionId(extra: { sessionId?: string }): string {
  return extra.sessionId ?? 'default';
}

function formatConfigMap(cm: ConfigMapResponse): string {
  const keys = Object.keys(cm.data ?? {});
  const lines = [
    `Name: ${cm.name}`,
    `Namespace: ${cm.namespace}`,
    `Keys (${keys.length}): ${keys.join(', ') || '(empty)'}`,
  ];
  if (cm.createdAt) lines.push(`Created: ${cm.createdAt}`);
  lines.push('', 'Data:');
  for (const [k, v] of Object.entries(cm.data ?? {})) {
    lines.push(`  ${k}: ${v}`);
  }
  return lines.join('\n');
}

export function registerConfigMapTools(server: McpServer): void {
  server.registerTool(
    'list-configmaps',
    {
      title: 'List ConfigMaps',
      description: 'List ConfigMaps. Optionally filter by namespace.',
      inputSchema: {
        namespace: z.string().optional().describe('Namespace to filter by. Omit to list across all namespaces.'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const path = params.namespace
          ? `${base}/namespaces/${encodeURIComponent(params.namespace)}/configmaps`
          : `${base}/configmaps`;

        const data = await backendFetch<ConfigMapListResponse>(sessionId, path);

        if (!data.items.length) {
          return { content: [{ type: 'text' as const, text: 'No ConfigMaps found.' }] };
        }

        const lines = data.items.map(
          (cm) => `  - ${cm.namespace}/${cm.name} (${Object.keys(cm.data ?? {}).length} keys)`,
        );
        return {
          content: [{ type: 'text' as const, text: `ConfigMaps (${data.total}):\n${lines.join('\n')}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'get-configmap',
    {
      title: 'Get ConfigMap',
      description: 'Get a ConfigMap with all its data entries.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the ConfigMap'),
        name: z.string().describe('Name of the ConfigMap'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);
        const cm = await backendFetch<ConfigMapResponse>(sessionId, `${base}/namespaces/${ns}/configmaps/${n}`);

        return { content: [{ type: 'text' as const, text: formatConfigMap(cm) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'create-configmap',
    {
      title: 'Create ConfigMap',
      description: 'Create a new ConfigMap with key-value data.',
      inputSchema: {
        namespace: z.string().describe('Target namespace'),
        name: z.string().describe('ConfigMap name'),
        data: z.record(z.string(), z.string()).describe('Key-value pairs for the ConfigMap'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);

        const cm = await backendFetch<ConfigMapResponse>(sessionId, `${base}/namespaces/${ns}/configmaps`, {
          method: 'POST',
          body: JSON.stringify({ name: params.name, namespace: params.namespace, data: params.data }),
        });

        return {
          content: [{ type: 'text' as const, text: `ConfigMap "${cm.name}" created.\n\n${formatConfigMap(cm)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error creating ConfigMap: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'update-configmap',
    {
      title: 'Update ConfigMap',
      description: 'Update the data entries of an existing ConfigMap. The provided data replaces all existing entries.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the ConfigMap'),
        name: z.string().describe('Name of the ConfigMap to update'),
        data: z.record(z.string(), z.string()).describe('New key-value pairs (replaces all existing data)'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        const cm = await backendFetch<ConfigMapResponse>(sessionId, `${base}/namespaces/${ns}/configmaps/${n}`, {
          method: 'PUT',
          body: JSON.stringify({ data: params.data }),
        });

        return {
          content: [{ type: 'text' as const, text: `ConfigMap "${cm.name}" updated.\n\n${formatConfigMap(cm)}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error updating ConfigMap: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'delete-configmap',
    {
      title: 'Delete ConfigMap',
      description: 'Delete a ConfigMap. This action is irreversible.',
      inputSchema: {
        namespace: z.string().describe('Namespace of the ConfigMap'),
        name: z.string().describe('Name of the ConfigMap to delete'),
      },
      annotations: { destructiveHint: true },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const ns = encodeURIComponent(params.namespace);
        const n = encodeURIComponent(params.name);

        await backendFetch<void>(sessionId, `${base}/namespaces/${ns}/configmaps/${n}`, { method: 'DELETE' });

        return {
          content: [{ type: 'text' as const, text: `ConfigMap "${params.name}" deleted from namespace "${params.namespace}".` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error deleting ConfigMap: ${msg}` }], isError: true };
      }
    },
  );
}
