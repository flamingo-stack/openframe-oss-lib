import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works. An empty `guide` config makes the SSE adapter fall back to the
 * lib's built-in `defaultTableIdForDocumentType` (no hand-written map needed).
 *
 * No source wiring: source is resolved server-side; the chat-history namespace +
 * link decisions fall back to lib defaults. See `content-runtime.ts`.
 *
 * Doc-card routing is config-driven via `content-runtime.ts`'s `docPlatformTargets` (per
 * documentType): OpenFrame docs (markdown) → flamingo's public knowledge hub, data-room
 * docs → company-hub. Doc chips carry no public externalUrl, so the lib resolves each PER
 * ROW to `getBaseUrl(platform)/<basePath>/<path>` and opens it in a new tab — a chat
 * mixing both sources routes each to its own home, no static per-embed fallback. Entity
 * content (releases, podcasts, …) routes through `composeContentUrl`.
 */
export function AskAi() {
  return <EmbeddableChat modes={{ guide: {} }} defaultActiveMode="guide" />
}
