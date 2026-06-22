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
      // Single React (+ peer singletons) across the app AND the pre-bundled linked lib.
      // Without this, optimizeDeps could bundle the lib's OWN React copy → "invalid hook
      // call", and the QueryClient / router / chat-runtime contexts would split into two
      // instances (provider on one, consumer on the other → "called outside provider").
      dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
      alias: {
        // Guard: the lib's ./fonts entry imports next/font/google (a Next compiler macro). No
        // surface here imports ./fonts, but stub it so an accidental import can't break the build.
        'next/font/google': path.resolve(__dirname, 'src/stubs/next-font-google.ts'),
      },
    },
    // Pre-bundle the yalc-linked lib (esbuild → ONE cached copy in node_modules/.vite/deps)
    // instead of reading its dist on demand via /@fs. Fixes two dev-only issues:
    //   1. "[vite] Failed to load url .../dist/components/<x>/index.js" — a page load that
    //      lands in the lib watcher's `rm -rf dist && tsup` window can't find the file.
    //   2. "[BABEL] code generator deoptimised … exceeds 500KB" — the lib's big chunks no
    //      longer pass through @vitejs/plugin-react's Babel (esbuild bundles them once).
    // The lib is consumed via `file:.yalc/...` (committed in package.json), and its
    // `yalc:watch` script does `yalc push --changed` on every rebuild. Yalc copies
    // updated files in-place BUT does NOT bump the package.json `version` field, so
    // Vite's optimizeDeps cache (keyed on lockfile + package.json version) never
    // invalidates on its own. The `dev` script runs `vite --force` to re-bundle on
    // every restart — cold start costs ~3s; in steady state, lib edits flowing
    // through yalc:watch trigger HMR on raw imports and the optimizeDeps cache
    // doesn't need refreshing until the next restart.
    optimizeDeps: {
      include: [
        '@flamingo-stack/openframe-frontend-core/components',
        '@flamingo-stack/openframe-frontend-core/components/chat',
        '@flamingo-stack/openframe-frontend-core/components/contact',
        '@flamingo-stack/openframe-frontend-core/components/docs',
        '@flamingo-stack/openframe-frontend-core/components/features',
        '@flamingo-stack/openframe-frontend-core/components/onboarding-guides',
        '@flamingo-stack/openframe-frontend-core/components/tickets',
        '@flamingo-stack/openframe-frontend-core/components/ui',
        '@flamingo-stack/openframe-frontend-core/contexts',
        '@flamingo-stack/openframe-frontend-core/embed-shims',
        '@flamingo-stack/openframe-frontend-core/utils',
      ],
    },
    server: { proxy },
    preview: { proxy },
  }
})
