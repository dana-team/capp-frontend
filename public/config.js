// Runtime configuration — rendered by Caddy templates at serve time.
// Set BACKEND_URL in the container environment (e.g. via Helm values.backendUrl).
window.CAPP_BACKEND_URL = "{{.Env.BACKEND_URL}}";
