export interface Config {
  backendUrl: string;
  port: number;
}

export function loadConfig(): Config {
  const backendUrl = (process.env.CAPP_BACKEND_URL ?? 'http://localhost:8080').replace(/\/$/, '');
  const port = Number(process.env.MCP_PORT) || 3001;
  return { backendUrl, port };
}
