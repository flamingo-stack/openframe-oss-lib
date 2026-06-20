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
 * `baseRoute='/knowledge-base'` tells the chip resolver where in-app markdown doc
 * chips land — this embedder hosts `<DocsHubPage>` at that path, so chips with no
 * `externalUrl` (and no `docPlatformTargets.markdown` entry; see content-runtime.ts)
 * soft-navigate via react-router instead of crossing to flamingo in a new tab.
 *
 * Doc-card routing for other documentTypes is config-driven via
 * `content-runtime.ts`'s `docPlatformTargets`: data-room docs → company-hub.
 * Entity content (releases, podcasts, …) routes through `composeContentUrl`.
 */
export function AskAi() {
  return (
    <EmbeddableChat
      modes={{ guide: {} }}
      defaultActiveMode="guide"
      baseRoute="/knowledge-base"
    />
  )
}
