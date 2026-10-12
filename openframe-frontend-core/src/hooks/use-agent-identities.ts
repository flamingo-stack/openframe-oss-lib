'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { subscribeEmbedCredentialChange } from '../utils/embed-authed-fetch';
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

/** How many times a failed identity read is tried again, and how long it waits between tries. */
const IDENTITY_READ_RETRIES = 4;
const IDENTITY_RETRY_BASE_MS = 1_000;
const IDENTITY_RETRY_MAX_MS = 8_000;

/**
 * The AI agents' identity icons, read FROM THE SERVER. Every caller with the
 * same endpoint shares one request (react-query), and the answer is kept for
 * the page's life: an identity changes when an admin edits it, never while a
 * page is open. `undefined` until it lands and when it cannot be read.
 *
 * A read that FAILS is not kept for the page's life: it is tried again a few
 * times, and once more whenever the host's sign-in changes. On a host that signs
 * its requests (a native shell, a local build) the first read can go out before
 * the session is in place and be refused; without this every mark stayed blank
 * until the page was reloaded.
 */
export function useAgentIdentities(endpoint: string = AGENT_IDENTITIES_API_PATH): AgentIdentityIcons | undefined {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['agent-identities', endpoint] as const, [endpoint]);
  const { data } = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAgentIdentities(endpoint, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: IDENTITY_READ_RETRIES,
    retryDelay: attempt => Math.min(IDENTITY_RETRY_BASE_MS * 2 ** attempt, IDENTITY_RETRY_MAX_MS),
  });
  useEffect(
    () =>
      subscribeEmbedCredentialChange(() => {
        // Only a read that has no answer yet is asked again: a loaded identity is never refetched.
        if (queryClient.getQueryData(queryKey) === undefined) void queryClient.invalidateQueries({ queryKey });
      }),
    [queryClient, queryKey],
  );
  return data;
}
