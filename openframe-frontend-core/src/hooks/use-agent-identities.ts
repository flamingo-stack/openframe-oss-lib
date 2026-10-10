'use client';

import { useQuery } from '@tanstack/react-query';
import { contentFetch } from '../utils/embed-content-fetch';

/** An icon as an agent's identity holds it: a library glyph name, an uploaded picture, or both unset. */
export interface AgentIdentityIcon {
  name?: string | null;
  url?: string | null;
  props?: Record<string, unknown> | null;
}

/** Each agent's identity icon, keyed by the agent's slug. */
export type AgentIdentityIcons = Readonly<Record<string, AgentIdentityIcon | null | undefined>>;

/** GET endpoint for the agents' public identities (the hub's path; embedders prefix their proxy). It answers `{ agents: [{ slug, icon }] }`. */
export const AGENT_IDENTITIES_API_PATH = '/api/ai-agents';

async function fetchAgentIdentities(endpoint: string, signal: AbortSignal): Promise<AgentIdentityIcons> {
  const response = await contentFetch(endpoint, { signal });
  if (!response.ok) throw new Error(`agent identities read failed (${response.status})`);
  const body = (await response.json()) as { agents?: Array<{ slug?: string; icon?: AgentIdentityIcon | null }> } | null;
  const icons: Record<string, AgentIdentityIcon> = {};
  for (const agent of body?.agents ?? []) if (agent.slug && agent.icon) icons[agent.slug] = agent.icon;
  return icons;
}

/**
 * The AI agents' identity icons, read FROM THE SERVER. Every caller with the
 * same endpoint shares one request (react-query), and the answer is kept for
 * the page's life: an identity changes when an admin edits it, never while a
 * page is open. `undefined` until it lands and when it cannot be read.
 */
export function useAgentIdentities(endpoint: string = AGENT_IDENTITIES_API_PATH): AgentIdentityIcons | undefined {
  const { data } = useQuery({
    queryKey: ['agent-identities', endpoint],
    queryFn: ({ signal }) => fetchAgentIdentities(endpoint, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data;
}
