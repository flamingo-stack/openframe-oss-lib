import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { CONTENT_PREFIX } from './proxy/content-prefix.mjs'
import { hubTarget, rewrite, injectHeaders } from './proxy/inject.mjs'

// The dev server + `vite preview` both proxy /content (and the two documented bare-/api
// exceptions) to the hub, injecting the chat secret + fixed identity headers server-side.
// Secrets come from loadEnv with prefix '' (ALL vars) — these run in Node config, never in the bundle.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = hubTarget(env)
  const inject = {
    target,
    changeOrigin: true,
    configure: (proxy: { on: (e: string, cb: (preq: { setHeader: (k: string, v: string) => void }) => void) => void }) => {
      proxy.on('proxyReq', (proxyReq) => injectHeaders(proxyReq, env))
    },
  }
  const proxy = {
    // Canonical namespace: /content/api/* → ${HUB_ORIGIN}/api/* .
    [CONTENT_PREFIX]: { ...inject, rewrite },
    // Dev-only fallback for the two surfaces whose lib hooks still hardcode bare /api
    // (the onboarding catalog's in-view doc-search + the tickets hooks). Forwarded as-is.
    // Drop these once the optional lib seam (catalog searchEndpoint + tickets agentBaseUrl) lands.
    '/api/docs/search': inject,
    '/api/chat/agent': inject,
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Guard: the lib's ./fonts entry imports next/font/google (a Next compiler macro). No
        // surface here imports ./fonts, but stub it so an accidental import can't break the build.
        'next/font/google': path.resolve(__dirname, 'src/stubs/next-font-google.ts'),
      },
    },
    server: { proxy },
    preview: { proxy },
  }
})
