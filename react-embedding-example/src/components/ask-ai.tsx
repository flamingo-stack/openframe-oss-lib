import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works. An empty `guide` config makes the SSE adapter fall back to the
 * lib's built-in `defaultTableIdForDocumentType` (no hand-written map needed).
 *
 * No platform/source wiring: the embedder is platform-agnostic — the lib defaults the
 * chat-history namespace + falls back to origin-based link decisions, and the chat wire
 * resolves source server-side. See `content-runtime.ts`.
 *
 * `baseRoute=""` signals this embed does NOT host an in-app doc viewer (no
 * /knowledge-base or /data-room route), so doc-table cards (openframe docs / data-room)
 * become Ask-only instead of navigating to a dead in-app route. Entity content
 * (releases, podcasts, …) is unaffected — it routes through `composeContentUrl`.
 */
export function AskAi() {
  return <EmbeddableChat baseRoute="" modes={{ guide: {} }} defaultActiveMode="guide" />
}
