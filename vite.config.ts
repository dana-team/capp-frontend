import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

/**
 * In dev mode all /api paths are proxied to the capp-backend.
 * The X-Backend-Url header (set by backendClient) tells the proxy where to
 * forward the request when the user-supplied backend URL differs from the
 * default (e.g. when connecting to a remote cluster).
 */
function dynamicBackendProxy(): Plugin {
  return {
    name: 'dynamic-backend-proxy',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        const backendHeader = Array.isArray(req.headers['x-backend-url'])
          ? req.headers['x-backend-url'][0]
          : req.headers['x-backend-url']

        const baseUrl = (backendHeader ?? process.env.VITE_BACKEND_URL ?? 'http://localhost:8080').replace(/\/$/, '')
        const targetUrl = new URL((req.url ?? '/'), baseUrl + '/api')

        const isHttps = targetUrl.protocol === 'https:'
        const transport = isHttps ? https : http

        const forwardHeaders = { ...req.headers }
        delete forwardHeaders['x-backend-url']
        forwardHeaders.host = targetUrl.host

        const proxyReq = transport.request(
          {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isHttps ? 443 : 80),
            path: '/api' + targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: forwardHeaders,
            rejectUnauthorized: false,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          }
        )

        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end(`Proxy error: ${err.message}`)
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), dynamicBackendProxy()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 3000,
  },
})
