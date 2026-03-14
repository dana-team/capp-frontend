import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

function dynamicK8sProxy(): Plugin {
  return {
    name: 'dynamic-k8s-proxy',
    configureServer(server) {
      server.middlewares.use('/k8s-proxy', (req, res) => {
        const clusterHeader = Array.isArray(req.headers['x-k8s-cluster'])
          ? req.headers['x-k8s-cluster'][0]
          : req.headers['x-k8s-cluster']

        const baseUrl = (clusterHeader ?? process.env.VITE_K8S_URL ?? 'https://localhost:6443').replace(/\/$/, '')
        const targetUrl = new URL((req.url ?? '/'), baseUrl)

        const isHttps = targetUrl.protocol === 'https:'
        const transport = isHttps ? https : http

        // Strip the proxy-specific header before forwarding
        const forwardHeaders = { ...req.headers }
        delete forwardHeaders['x-k8s-cluster']
        forwardHeaders.host = targetUrl.host

        const proxyReq = transport.request(
          { hostname: targetUrl.hostname, port: targetUrl.port || (isHttps ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search, method: req.method,
            headers: forwardHeaders, rejectUnauthorized: false },
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
  plugins: [react(), dynamicK8sProxy()],
  resolve: {
    alias: { '@': '/src' }
  },
  server: {
    port: 3000,
  }
})
