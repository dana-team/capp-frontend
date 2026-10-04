// Helpers for kubernetes.io/dockerconfigjson (image pull) secrets.
// Kept dependency-free so mock-server can reuse it.

export const DOCKER_CONFIG_JSON_TYPE = 'kubernetes.io/dockerconfigjson';
export const DOCKER_CONFIG_JSON_KEY = '.dockerconfigjson';

export interface RegistryCredentials {
  server: string;
  username: string;
  password: string;
  email?: string;
}

interface DockerAuthEntry {
  username?: string;
  password?: string;
  email?: string;
  auth?: string;
}

const encodeBase64 = (s: string) => {
  let binary = '';
  for (const b of new TextEncoder().encode(s)) binary += String.fromCharCode(b);
  return btoa(binary);
};

const decodeBase64 = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/** Builds the `.dockerconfigjson` value for a single registry. */
export function buildDockerConfigJson({ server, username, password, email }: RegistryCredentials): string {
  const entry: DockerAuthEntry = {
    username,
    password,
    ...(email ? { email } : {}),
    auth: encodeBase64(`${username}:${password}`),
  };
  return JSON.stringify({ auths: { [server]: entry } });
}

/**
 * Parses a `.dockerconfigjson` value. Returns null unless it holds exactly one
 * registry with recoverable credentials, so callers can fall back to raw editing.
 */
export function parseDockerConfigJson(raw: string | undefined): RegistryCredentials | null {
  if (!raw) return null;
  try {
    const auths = (JSON.parse(raw) as { auths?: Record<string, DockerAuthEntry> }).auths;
    if (!auths) return null;
    const servers = Object.keys(auths);
    if (servers.length !== 1) return null;
    const entry = auths[servers[0]];
    let { username, password } = entry;
    if ((!username || password === undefined) && entry.auth) {
      const decoded = decodeBase64(entry.auth);
      const sep = decoded.indexOf(':');
      if (sep === -1) return null;
      username = decoded.slice(0, sep);
      password = decoded.slice(sep + 1);
    }
    if (!username || password === undefined) return null;
    return { server: servers[0], username, password, ...(entry.email ? { email: entry.email } : {}) };
  } catch {
    return null;
  }
}
