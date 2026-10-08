// The assistant's identity, read from the SERVER and nowhere else: the name and
// glyph the header launcher, the FAQ's ask card and every other "ask" surface
// show. Nothing here types a name or draws an icon.
//
// Two server reads, both through the /content proxy, in the hub's own order:
//   1. the platform's configured chat identity (`/api/docs/empty-state`: the
//      `name` and `icon` an admin set in chat config), the SAME request the
//      chat panel makes (one cached query, `useEmptyStateConfig`);
//   2. where the platform configured none, the agent the admin talks to
//      (`/api/ai-agents`, audience `admin`), the hub's own fallback.
// Neither: the lib's defaults (its launcher's name and packaged mark).
import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EntityIcon, type EntityIconValue } from '@flamingo-stack/openframe-frontend-core/components'
import { useEmptyStateConfig } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { AssistantRuntimeContext, type AssistantRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils'
import { openEmbedChat } from '../components/ask-ai'
import { EP } from '../config/endpoints'

/** The audience of the agent a site's chat assistant is (the hub's `ASSISTANT_AUDIENCE`). */
const ASSISTANT_AUDIENCE = 'admin'

interface AgentIdentity {
  name: string
  audience: string
  icon: EntityIconValue | null
}

async function fetchAssistantAgent(signal?: AbortSignal): Promise<AgentIdentity | null> {
  const res = await embedAuthedFetch(new URL(EP.aiAgents, window.location.origin).toString(), { signal, headers: {} })
  // A failed read is an ERROR, never "no agent": the query retries it and does not keep it as an answer.
  if (!res.ok) throw new Error(`assistant agent read failed: ${res.status}`)
  const body = (await res.json()) as { agents?: AgentIdentity[] }
  return body.agents?.find((agent) => agent.audience === ASSISTANT_AUDIENCE) ?? null
}

export interface AssistantIdentity {
  /** The configured name; null while it loads and when the server has none. */
  name: string | null
  /** The configured glyph; undefined when the server has none (the lib's packaged mark then shows). */
  icon: ReactNode | undefined
}

export function useAssistantIdentity(): AssistantIdentity {
  const { config, loaded } = useEmptyStateConfig(EP.emptyState)
  // The agents are read only once the platform is known to have no identity of its own.
  const needsAgent = loaded && (!config.name || !config.icon)
  const { data: agent } = useQuery({
    queryKey: ['assistant-agent', EP.aiAgents],
    queryFn: ({ signal }) => fetchAssistantAgent(signal),
    enabled: needsAgent,
    staleTime: Infinity,
  })
  const name = config.name ?? agent?.name ?? null
  const icon = config.icon ?? agent?.icon ?? null
  // One element per glyph: readers that key on it (the runtime below) stay stable.
  const iconNode = useMemo(() => (icon ? <EntityIcon icon={icon} size={32} className="size-full" /> : undefined), [icon])
  return { name, icon: iconNode }
}

/**
 * What the lib's "ask" surfaces (the FAQ's card) need to offer THIS embed's
 * chat: the chat is always mounted here (`<AskAi />` in the shell), the
 * identity is the server's, the questions come through the /content proxy, and
 * a click goes to the embed's own opener, never to a chat the lib assumes.
 */
export function AssistantRuntimeProvider({ children }: { children: ReactNode }) {
  const { name, icon } = useAssistantIdentity()
  const runtime = useMemo<AssistantRuntime>(
    () => ({ available: true, name, icon, askPromptsUrl: EP.askPrompts, open: openEmbedChat }),
    [name, icon],
  )
  return <AssistantRuntimeContext.Provider value={runtime}>{children}</AssistantRuntimeContext.Provider>
}
