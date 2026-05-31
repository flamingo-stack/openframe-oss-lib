/**
 * SINGLE SOURCE OF TRUTH for the client-facing reverse-proxy namespace.
 *
 * Imported by BOTH the Node proxy (proxy/inject.mjs, proxy/server.mjs,
 * vite.config.ts) AND the browser (src/config/content.ts). Keep this file a
 * pure ESM string export — no Node-only code — so Vite can bundle it for the
 * client without pulling anything server-side.
 */
export const CONTENT_PREFIX = '/content'
