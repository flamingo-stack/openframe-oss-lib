import { useEffect, useState } from 'react'
import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { openAskAi } from '@flamingo-stack/openframe-frontend-core/components/navigation'
import type { AssistantOpenRequest } from '@flamingo-stack/openframe-frontend-core/contexts'
import { DOCS_BASE_ROUTE } from '../config/content'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works.
 *
 * ENTRY POINT: the shared header's Mingo launcher (`SiteHeader`'s `mingo` in
 * app-shell.tsx) — the same `ask-ai:open` event bus the hub uses. The lib's
 * floating internal trigger is disabled (`showInternalTrigger={false}`),
 * matching the hub's retired-dock model.
 *
 * OpenFrame AGENT MODE (Fae / Mingo): the demo chooser below sets `activeAgentSlug`.
 * Agent mode reuses the same `<EmbeddableChat>` — it just OVERRIDES the empty-state
 * config URL, fetching the agent's display config (greeting + suggested prompts +
 * source chips) from `runtime.endpoints.aiAgentConfigUrl(slug)` (wired in
 * content-runtime.ts → `/content/api/ai-agents/:slug`). `activeAgentSlug = undefined`
 * is the default Guide-mode chat.
 *
 * `baseRoute='/knowledge-base'` tells the chip resolver where in-app markdown doc
 * chips land. Doc-card routing for other documentTypes is config-driven via
 * `content-runtime.ts`'s `docPlatformTargets`.
 */
/** The event this embed's chat opens on. Its OWN name: nothing but `<AskAi />` listens for it. */
const EMBED_CHAT_OPEN_EVENT = 'embed-example:open-chat'

/**
 * THIS embed's chat opener, handed to the lib through the assistant runtime
 * (`AssistantRuntimeContext.open`, providers/assistant-identity.tsx). Every "ask" surface of
 * the lib under that provider (the FAQ's card) calls it instead of assuming
 * the site chat: `<AskAi />` below receives the request, and decides which
 * chat answers. An embedder with an inline chat, a second panel or a native
 * shell does the same with its own function.
 */
export function openEmbedChat(request: AssistantOpenRequest): void {
  window.dispatchEvent(new CustomEvent<AssistantOpenRequest>(EMBED_CHAT_OPEN_EVENT, { detail: request }))
}

const AGENT_CHOICES: ReadonlyArray<{ slug: string | undefined; label: string }> = [
  { slug: undefined, label: 'Guide' },
  { slug: 'fae', label: 'Fae' },
  { slug: 'mingo', label: 'Mingo' },
]

export function AskAi() {
  // `undefined` → default Guide mode; a slug → OpenFrame agent mode.
  const [activeAgentSlug, setActiveAgentSlug] = useState<string | undefined>(undefined)

  // An "ask" surface asked for the chat (`openEmbedChat`). This embed answers
  // every such request in the Guide chat, so it leaves agent mode first and
  // opens its panel only once that switch has rendered (the effect below):
  // the panel must read the Guide chat's config, never the agent's it just left.
  const [pendingOpen, setPendingOpen] = useState<AssistantOpenRequest | null>(null)
  useEffect(() => {
    const onOpen = (event: Event) => {
      setActiveAgentSlug(undefined)
      setPendingOpen({ prompt: (event as CustomEvent<AssistantOpenRequest>).detail.prompt })
    }
    window.addEventListener(EMBED_CHAT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(EMBED_CHAT_OPEN_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (!pendingOpen || activeAgentSlug !== undefined) return
    openAskAi(undefined, { prompt: pendingOpen.prompt })
    setPendingOpen(null)
  }, [pendingOpen, activeAgentSlug])

  return (
    <>
      {/* Demo-only chooser: flip the SAME chat between Guide mode and an
          OpenFrame AI agent. A real embedder might hardcode one agent slug.
          Bottom-RIGHT — opposite corner from the floating walkthrough-video
          widget (bottom-left), so neither covers the other. */}
      <div className="fixed bottom-4 right-4 z-[60] flex gap-1 rounded-lg border border-ods-border bg-ods-card p-1 shadow-lg">
        {AGENT_CHOICES.map((choice) => (
          <button
            key={choice.label}
            type="button"
            onClick={() => setActiveAgentSlug(choice.slug)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeAgentSlug === choice.slug
                ? 'bg-ods-accent text-black'
                : 'text-ods-text-secondary hover:text-ods-text-primary'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {/* Headless panel — the floating internal trigger is DISABLED (same as
          the hub): the shared header's MingoAiButton (SiteHeader's mingo in
          app-shell.tsx) is the ONLY chat entry; it dispatches `ask-ai:open`
          and this always-mounted panel listens. */}
      <EmbeddableChat
        modes={{ guide: {} }}
        defaultActiveMode="guide"
        baseRoute={DOCS_BASE_ROUTE}
        showInternalTrigger={false}
        activeAgentSlug={activeAgentSlug}
        onAgentChange={setActiveAgentSlug}
      />
    </>
  )
}
