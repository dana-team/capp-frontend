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
  return (
    window.CAPP_BACKEND_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    'http://localhost:8080'
  )
}
