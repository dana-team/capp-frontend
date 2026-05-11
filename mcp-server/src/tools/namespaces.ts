import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { backendFetch, clusterBase } from '../client.js';

interface NamespaceItem {
  name: string;
  status: string;
}

interface NamespaceListResponse {
  items: NamespaceItem[];
}

function resolveSessionId(extra: { sessionId?: string }): string {
  return extra.sessionId ?? 'default';
}

export function registerNamespaceTools(server: McpServer): void {
  server.registerTool(
    'list-namespaces',
    {
      title: 'List Namespaces',
      description: 'List all namespaces in the active cluster.',
    },
    async (extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const base = clusterBase(sessionId);
        const data = await backendFetch<NamespaceListResponse>(sessionId, `${base}/namespaces`);

        const lines = data.items.map((ns) => `  - ${ns.name} (${ns.status})`);
        return {
          content: [{ type: 'text' as const, text: `Namespaces:\n${lines.join('\n')}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}
