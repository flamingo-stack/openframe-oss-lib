import { useState } from 'react'
import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { DOCS_BASE_ROUTE } from '../config/content'

/**
 * Embedder-side equivalent of the hub's `global-ask-ai-client.tsx`. It reuses the
 * SAME lib component (`EmbeddableChat`) the hub file wraps — no copy, no auth gate.
 * Identity (Michael) is resolved server-side via the proxy's act-as headers, so the
 * greeting just works.
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
const AGENT_CHOICES: ReadonlyArray<{ slug: string | undefined; label: string }> = [
  { slug: undefined, label: 'Guide' },
  { slug: 'fae', label: 'Fae' },
  { slug: 'mingo', label: 'Mingo' },
]

export function AskAi() {
  // `undefined` → default Guide mode; a slug → OpenFrame agent mode.
  const [activeAgentSlug, setActiveAgentSlug] = useState<string | undefined>(undefined)

  return (
    <>
      {/* Demo-only chooser: flip the SAME chat between Guide mode and an
          OpenFrame AI agent. A real embedder might hardcode one agent slug. */}
      <div className="fixed bottom-4 left-4 z-[60] flex gap-1 rounded-lg border border-ods-border bg-ods-card p-1 shadow-lg">
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

      <EmbeddableChat
        modes={{ guide: {} }}
        defaultActiveMode="guide"
        baseRoute={DOCS_BASE_ROUTE}
        activeAgentSlug={activeAgentSlug}
        onAgentChange={setActiveAgentSlug}
      />
    </>
  )
}
