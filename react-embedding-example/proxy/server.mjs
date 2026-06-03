/**
 * Standalone Node proxy for the BUILT app (`npm run build && npm run preview:proxy`).
 * Serves dist/ as an SPA and proxies /content (+ the two documented bare-/api
 * exceptions) to the hub using the SAME inject module as the Vite dev proxy.
 *
 * SSE NOTE: this server deliberately does NOT pipe responses through any
 * compression middleware and never sets `selfHandleResponse` — both would buffer
 * and break the chat's text/event-stream. Static files are served uncompressed.
 *
 * For local dev use `npm run dev` instead (Vite's built-in proxy). In production
 * this whole file is replaced by the existing Spring Boot proxy.
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'
import { CONTENT_PREFIX } from './content-prefix.mjs'
import { hubTarget, rewrite, injectHeaders } from './inject.mjs'

const env = process.env
const PORT = Number(env.PORT) || 4173
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

const proxy = httpProxy.createProxyServer({ target: hubTarget(env), changeOrigin: true })
proxy.on('proxyReq', (proxyReq) => injectHeaders(proxyReq, env))
proxy.on('error', (err, _req, res) => {
  res.writeHead(502, { 'content-type': 'text/plain' })
  res.end(`proxy error: ${err.message}`)
})

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  // Resolve within DIST; SPA fallback to index.html for client routes.
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  const target = path.resolve(DIST, rel)
  const safe = target.startsWith(DIST)
  try {
    const file = safe && path.extname(target) ? await readFile(target) : await readFile(path.join(DIST, 'index.html'))
    const ext = safe && path.extname(target) ? path.extname(target) : '.html'
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
    res.end(file)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found')
  }
}

http
  .createServer((req, res) => {
    const url = req.url || '/'
    if (url === CONTENT_PREFIX || url.startsWith(`${CONTENT_PREFIX}/`)) {
      req.url = rewrite(url) // /content/api/x → /api/x
      return void proxy.web(req, res)
    }
    if (url.startsWith('/api/docs/search') || url.startsWith('/api/chat/agent')) {
      return void proxy.web(req, res) // documented bare-/api exceptions (forwarded as-is)
    }
    void serveStatic(req, res)
  })
  .listen(PORT, () =>
    console.log(`[proxy] dist/ + ${CONTENT_PREFIX} → ${hubTarget(env)}  ·  http://localhost:${PORT}`),
  )
