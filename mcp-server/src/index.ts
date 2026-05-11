import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { registerAuthTools } from './tools/auth.js';
import { registerNamespaceTools } from './tools/namespaces.js';
import { registerCappTools } from './tools/capps.js';
import { registerConfigMapTools } from './tools/configmaps.js';
import { registerSecretTools } from './tools/secrets.js';

const server = new McpServer(
  { name: 'capp-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

registerAuthTools(server);
registerNamespaceTools(server);
registerCappTools(server);
registerConfigMapTools(server);
registerSecretTools(server);

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. MCP endpoint is at /mcp' }));
    return;
  }

  if (req.method === 'POST') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      await server.connect(transport);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or expired session. Reconnect without a session ID.' }));
      return;
    }

    await transport.handleRequest(req, res);
    return;
  }

  if (req.method === 'GET') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or invalid session ID for SSE stream.' }));
    return;
  }

  if (req.method === 'DELETE') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.close();
      transports.delete(sessionId);
      res.writeHead(200);
      res.end();
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found.' }));
    return;
  }

  res.writeHead(405, { Allow: 'GET, POST, DELETE' });
  res.end();
});

const { port, backendUrl } = loadConfig();

httpServer.listen(port, () => {
  console.error(`Capp MCP Server listening on http://localhost:${port}/mcp`);
  console.error(`Backend URL: ${backendUrl}`);
});
