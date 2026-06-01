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
 * Doc-card routing mirrors the hub's openframe config (`openframe.config.tsx` askAI):
 * `baseRoute="/"` + `chipBasePlatform="flamingo"`. OpenFrame doc chips (markdown) carry
 * no public externalUrl, so the lib resolves them cross-platform to flamingo's public
 * knowledge hub — `getBaseUrl('flamingo')/knowledge-base/<path>` — opening there in a new
 * tab, exactly like production OpenFrame. (Data-room docs target company-hub instead, but
 * data room isn't an enabled source for OpenFrame, so those chips never appear here.)
 * Entity content (releases, podcasts, …) routes through `composeContentUrl`.
 */
export function AskAi() {
  return (
    <EmbeddableChat
      baseRoute="/"
      chipBasePlatform="flamingo"
      modes={{ guide: {} }}
      defaultActiveMode="guide"
    />
  )
}
