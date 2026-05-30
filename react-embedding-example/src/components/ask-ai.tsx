import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works. An empty `guide` config makes the SSE adapter fall back to the
 * lib's built-in `defaultTableIdForDocumentType` (no hand-written map needed).
 */
export function AskAi() {
  return <EmbeddableChat modes={{ guide: {} }} defaultActiveMode="guide" />
}
