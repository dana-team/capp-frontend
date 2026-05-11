import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from '../config.js';
import { setSession, getSession, BackendApiError } from '../client.js';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface ClusterMeta {
  name: string;
  displayName: string;
  healthy: boolean;
}

function resolveSessionId(extra: { sessionId?: string }): string {
  return extra.sessionId ?? 'default';
}

export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    'authenticate',
    {
      title: 'Authenticate',
      description:
        'Authenticate with the capp-backend. Provide EITHER username+password (for login-based auth) OR a token (for passthrough/bearer auth). Returns available clusters on success.',
      inputSchema: {
        username: z.string().optional().describe('Username for login-based authentication'),
        password: z.string().optional().describe('Password for login-based authentication'),
        token: z.string().optional().describe('Bearer token for passthrough authentication'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);
      const { backendUrl } = loadConfig();

      try {
        let accessToken: string;
        let refreshToken = '';

        if (params.token) {
          accessToken = params.token;
        } else if (params.username && params.password) {
          const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: params.username, password: params.password }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as Record<string, unknown>;
            const msg = (body as { error?: { message?: string } })?.error?.message ?? `Login failed (${res.status})`;
            return { content: [{ type: 'text' as const, text: `Authentication failed: ${msg}` }], isError: true };
          }
          const data = (await res.json()) as AuthResponse;
          accessToken = data.accessToken;
          refreshToken = data.refreshToken;
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Provide either "token" or both "username" and "password".' }],
            isError: true,
          };
        }

        setSession(sessionId, { token: accessToken, refreshToken, cluster: '' });

        const clustersRes = await fetch(`${backendUrl}/api/v1/clusters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!clustersRes.ok) {
          return {
            content: [{
              type: 'text' as const,
              text: 'Authenticated successfully, but failed to fetch clusters. Use "list-clusters" to retry.',
            }],
          };
        }

        const clustersData = (await clustersRes.json()) as { items: ClusterMeta[] };
        const clusters = clustersData.items;

        if (clusters.length === 1) {
          const session = getSession(sessionId)!;
          session.cluster = clusters[0].name;
        }

        const clusterList = clusters
          .map((c) => `  - ${c.displayName || c.name} (${c.healthy ? 'healthy' : 'unhealthy'})`)
          .join('\n');

        const autoSelected = clusters.length === 1 ? `\nAuto-selected cluster: ${clusters[0].name}` : '\nCall "set-cluster" to select a cluster.';

        return {
          content: [{
            type: 'text' as const,
            text: `Authenticated successfully.\n\nAvailable clusters:\n${clusterList}${autoSelected}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Authentication error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'list-clusters',
    {
      title: 'List Clusters',
      description: 'List all available Kubernetes clusters with their health status.',
    },
    async (extra) => {
      const sessionId = resolveSessionId(extra);

      try {
        const session = getSession(sessionId);
        if (!session) {
          return { content: [{ type: 'text' as const, text: 'Not authenticated. Call "authenticate" first.' }], isError: true };
        }

        const { backendUrl } = loadConfig();
        const res = await fetch(`${backendUrl}/api/v1/clusters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        });

        if (!res.ok) {
          return { content: [{ type: 'text' as const, text: `Failed to list clusters (HTTP ${res.status}).` }], isError: true };
        }

        const data = (await res.json()) as { items: ClusterMeta[] };
        const currentCluster = session.cluster;

        const lines = data.items.map((c) => {
          const active = c.name === currentCluster ? ' (active)' : '';
          const health = c.healthy ? 'healthy' : 'unhealthy';
          return `  - ${c.displayName || c.name}: ${health}${active}`;
        });

        return {
          content: [{ type: 'text' as const, text: `Clusters:\n${lines.join('\n')}` }],
        };
      } catch (err) {
        const msg = err instanceof BackendApiError ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'set-cluster',
    {
      title: 'Set Active Cluster',
      description: 'Set the active cluster for subsequent operations. Use "list-clusters" to see available clusters.',
      inputSchema: {
        cluster: z.string().describe('Cluster name to set as active'),
      },
    },
    async (params, extra) => {
      const sessionId = resolveSessionId(extra);
      const session = getSession(sessionId);

      if (!session) {
        return { content: [{ type: 'text' as const, text: 'Not authenticated. Call "authenticate" first.' }], isError: true };
      }

      session.cluster = params.cluster;
      return {
        content: [{ type: 'text' as const, text: `Active cluster set to "${params.cluster}".` }],
      };
    },
  );
}
