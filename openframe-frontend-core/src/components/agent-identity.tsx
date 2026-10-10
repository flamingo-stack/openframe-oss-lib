'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createSharedRequest } from '../hooks/shared-request';

/** An icon as an agent's identity holds it: a library glyph name, an uploaded picture, or both unset. */
export interface AgentIdentityIcon {
  name?: string | null;
  url?: string | null;
  props?: Record<string, unknown> | null;
}

/** Each agent's identity icon, keyed by the agent's slug. */
export type AgentIdentityIcons = Readonly<Record<string, AgentIdentityIcon | null | undefined>>;

/**
 * GET endpoint for the agents' public identities (the hub's path; embedders
 * prefix their proxy). It answers `{ agents: [{ slug, icon }] }`.
 */
export const AGENT_IDENTITIES_API_PATH = '/api/ai-agents';

/** The list answer, read down to what a mark needs: each agent's icon by slug. A body of another shape names none. */
function readIdentityIcons(body: unknown): AgentIdentityIcons {
  const agents = (body as { agents?: unknown } | null)?.agents;
  const icons: Record<string, AgentIdentityIcon> = {};
  if (!Array.isArray(agents)) return icons;
  for (const agent of agents as Array<{ slug?: unknown; icon?: AgentIdentityIcon | null }>) {
    if (typeof agent?.slug === 'string' && agent.icon) icons[agent.slug] = agent.icon;
  }
  return icons;
}

const identities = createSharedRequest<AgentIdentityIcons>(readIdentityIcons);

/** Test seam: forget every answer. */
export function resetAgentIdentitiesStore(): void {
  identities.reset();
}

/**
 * The AI agents' identity icons, by agent slug.
 *
 * An agent's picture is a record the product keeps (its agent identity: its
 * name and icon). Mounted once, this provider makes every mark of an agent,
 * wherever a component of this library or of the host draws one (`AgentMark`,
 * `EntityIcon`), the icon its identity holds. A change to the identity reaches
 * every mark with no edit to a call site.
 *
 * Where the identities come from:
 *   - `icons`: the host's own copy (one it read on the server). No request.
 *   - no `icons`: the provider reads them FROM THE SERVER (`endpoint`, default
 *     `AGENT_IDENTITIES_API_PATH`), one request shared by every provider on the
 *     page. An embedder passes its proxy path.
 *
 * Until the answer lands, when it cannot be read, and with no provider at all
 * (a story, a test) each agent keeps the mark packaged with the library.
 */
const AgentIdentityContext = createContext<ReadonlyMap<string, AgentIdentityIcon>>(new Map());

export function AgentIdentityProvider({
  icons,
  endpoint = AGENT_IDENTITIES_API_PATH,
  children,
}: {
  /** The host's copy of each agent's identity icon. Omit it and the provider reads them from `endpoint`. */
  icons?: AgentIdentityIcons;
  /** GET endpoint for the identities, used when `icons` is not given. */
  endpoint?: string;
  children: ReactNode;
}) {
  const { data } = identities.useSharedRequest({ endpoint, enabled: !icons });
  const held = icons ?? data;
  const bySlug = useMemo(() => {
    const map = new Map<string, AgentIdentityIcon>();
    for (const [slug, icon] of Object.entries(held ?? {})) if (icon) map.set(slug, icon);
    return map;
  }, [held]);
  return <AgentIdentityContext.Provider value={bySlug}>{children}</AgentIdentityContext.Provider>;
}

/** The icon the identity of the agent with this slug holds; undefined when none is known. */
export function useAgentIdentityIcon(slug: string | null | undefined): AgentIdentityIcon | undefined {
  return useContext(AgentIdentityContext).get(slug ?? '');
}
