import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works. An empty `guide` config makes the SSE adapter fall back to the
 * lib's built-in `defaultTableIdForDocumentType` (no hand-written map needed).
 */
export function AskAi() {
  const runtime = useChatRuntime()
  // Readiness gate, NOT platform awareness: the lib's <EmbedChatRuntimeProvider>
  // resolves the chat `source` from the proxied hub's /auth/identity, and the chat
  // adapter requires a non-empty source. We never name a platform here — we just wait
  // for the server to report one.
  if (!runtime?.source) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-ods-text-secondary">
        Connecting…
      </div>
    )
  }
  return <EmbeddableChat modes={{ guide: {} }} defaultActiveMode="guide" />
}
