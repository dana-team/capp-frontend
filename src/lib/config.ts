declare global {
  interface Window {
    CAPP_BACKEND_URL?: string
  }
}

/**
 * Returns the capp-backend base URL.
 * Resolution order:
 *   1. window.CAPP_BACKEND_URL  — injected at runtime by Caddy templates (production)
 *   2. import.meta.env.VITE_BACKEND_URL — set at build time via .env.local (optional)
 *   3. http://localhost:8080    — dev fallback
 */
export function getBackendUrl(): string {
  const runtimeUrl = window.CAPP_BACKEND_URL
  // Ignore the value if Caddy's template was never rendered (e.g. Vite dev
  // server serves public/config.js verbatim), which leaves the literal string
  // "{{.Env.BACKEND_URL}}". Falling through prevents a truthy-but-invalid URL
  // from breaking the dev proxy.
  if (runtimeUrl && !runtimeUrl.startsWith('{{')) {
    return runtimeUrl
  }
  return (
    import.meta.env.VITE_BACKEND_URL ||
    'http://localhost:8080'
  )
}
