'use client';

import { type Query, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeRegisteredAdapter } from '../utils/embed-auth-adapter-registry';
import { answeredAfterRefresh, subscribeEmbedCredentialChange } from '../utils/embed-authed-fetch';
import { contentFetch } from '../utils/embed-content-fetch';

/** An icon as an agent's identity holds it: a library glyph name, an uploaded picture, or both unset. */
export interface AgentIdentityIcon {
  name?: string | null;
  url?: string | null;
  props?: Record<string, unknown> | null;
  /**
   * The identity's accent, travelling with its icon: a hex colour (`#5efaf0`),
   * as the server stores it. What is drawn in the agent's colour (its tab, the
   * step it is on) reads it through `useAgentAccents`; unset, that is the platform's accent.
   */
  accent?: string | null;
}

/** Each agent's identity icon, keyed by the agent's slug. */
export type AgentIdentityIcons = Readonly<Record<string, AgentIdentityIcon | null | undefined>>;

/** GET endpoint for the agents' public identities (the hub's path; embedders prefix their proxy). It answers `{ agents: [{ slug, icon }] }`. */
export const AGENT_IDENTITIES_API_PATH = '/api/ai-agents';

/** Why a read failed, by what can make the next one succeed (the rule is on `useAgentIdentities`). */
type ReadFailure =
  /** No answer at all, or the server's own failure (5xx): the same read can succeed a moment later. */
  | 'transient'
  /** A 401 that no refresh got past: only a new credential can lift it. */
  | 'unauthorized'
  /** Anything else: asked again, the answer is the same. */
  | 'final';

class AgentIdentitiesReadError extends Error {
  readonly failure: ReadFailure;

  constructor(failure: ReadFailure, detail: string | number) {
    super(`agent identities read failed (${detail})`);
    this.failure = failure;
  }
}

function failureOf(error: unknown): ReadFailure {
  // Whatever else is thrown is the host refusing to send (its adapter's `beforeRequest` / `onResponse`, the
  // origin guard) or an answer that is not the identities: neither changes by asking again.
  return error instanceof AgentIdentitiesReadError ? error.failure : 'final';
}

function refusalOf(response: Response): ReadFailure {
  if (response.status >= 500) return 'transient';
  // A 401 to the retry `embedAuthedFetch` sent with a credential it had just refreshed is final: a newer one
  // cannot lift it, and asking on every rotation would refresh, and so rotate, again.
  return response.status === 401 && !answeredAfterRefresh(response) ? 'unauthorized' : 'final';
}

async function fetchAgentIdentities(endpoint: string, signal: AbortSignal): Promise<AgentIdentityIcons> {
  const response = await contentFetch(endpoint, { signal }).catch((error: unknown) => {
    // `fetch` rejects with a TypeError when the request got no answer at all: offline, DNS, a dropped connection.
    throw error instanceof TypeError ? new AgentIdentitiesReadError('transient', error.message) : error;
  });
  if (!response.ok) throw new AgentIdentitiesReadError(refusalOf(response), response.status);
  const body = (await response.json()) as { agents?: Array<{ slug?: string; icon?: AgentIdentityIcon | null }> } | null;
  const icons: Record<string, AgentIdentityIcon> = {};
  for (const agent of body?.agents ?? []) if (agent.slug && agent.icon) icons[agent.slug] = agent.icon;
  return icons;
}

/** How many more times a transient failure is asked again on a timer. */
const TIMED_ATTEMPTS = 3;
/** The wait before the first of them, in ms; each later wait is three times the one before (2s, 6s, 18s). */
const FIRST_WAIT_MS = 2_000;

/** Whether the page being shown again, or the browser coming back online, may ask again. */
function eventMayAsk(query: Query<AgentIdentityIcons>): boolean {
  return failureOf(query.state.error) === 'transient';
}

/**
 * The AI agents' identity icons, read FROM THE SERVER. Every caller with the
 * same endpoint shares one request (react-query), and the answer is kept for
 * the page's life: an identity changes when an admin edits it, never while a
 * page is open. `undefined` until it lands and while it cannot be read.
 *
 * `enabled` is how a host that signs its requests holds the read back until its
 * session is in place. A read sent before then is refused, and on such a host a
 * refused request starts a token refresh that can end the session being set up.
 * Nothing below sends a read while `enabled` is false, and an attempt waiting
 * on its timer is dropped when it turns false.
 *
 * The provider above the marks is mounted once for the page, so a read that
 * failed has to be asked again here: nothing remounts to ask it. What asks
 * again depends on what can change the answer:
 *   - No answer at all, or a 5xx: `TIMED_ATTEMPTS` more attempts on a timer,
 *     each after a longer wait (react-query holds them while the page is hidden
 *     or offline). After those: when the page is shown again, when the browser
 *     is back online, and when the host holds a new credential.
 *   - A 401 the adapter's refresh did not get past: ONLY when the host holds a
 *     new credential (`subscribeEmbedCredentialChange`, or an adapter registered
 *     after the read left unsigned). Never on a timer and never on an event that
 *     says nothing about the credential: each such attempt would start another
 *     refresh, which is what ends a sign-in in progress.
 *   - Anything else (a 401 to a credential just refreshed, another 4xx, the
 *     host refusing to send, an answer that is not the identities): not asked
 *     again until `enabled` turns false and true again. The answer would be the
 *     same, and a 401 asked again on every new credential would refresh, and so
 *     rotate the session, each time.
 * A read that gave up says so in the console, in production too: the marks are
 * then empty boxes with nothing else to show why.
 */
export function useAgentIdentities(
  endpoint: string = AGENT_IDENTITIES_API_PATH,
  enabled: boolean = true,
): AgentIdentityIcons | undefined {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['agent-identities', endpoint],
    queryFn: ({ signal }) => fetchAgentIdentities(endpoint, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failureCount, failure) => failureCount < TIMED_ATTEMPTS && failureOf(failure) === 'transient',
    retryDelay: failureCount => FIRST_WAIT_MS * 3 ** failureCount,
    // Only identities that could not be read are stale (`staleTime`), so these never ask for ones already held.
    refetchOnWindowFocus: eventMayAsk,
    refetchOnReconnect: eventMayAsk,
    enabled,
  });

  useEffect(() => {
    const filter = { queryKey: ['agent-identities', endpoint], exact: true };
    if (!enabled) {
      // react-query keeps a timed attempt going for a query that was disabled meanwhile.
      void queryClient.cancelQueries(filter);
      return undefined;
    }
    const onCredentialChange = () => {
      // A read in flight holds no error, so the credential its own refresh brought in asks nothing.
      if (failureOf(queryClient.getQueryState(filter.queryKey)?.error) === 'final') return;
      void queryClient.refetchQueries(filter);
    };
    let detachCredential = subscribeEmbedCredentialChange(onCredentialChange);
    const detachAdapter = subscribeRegisteredAdapter(() => {
      // `subscribeEmbedCredentialChange` binds to the adapter registered when it is called.
      detachCredential();
      detachCredential = subscribeEmbedCredentialChange(onCredentialChange);
      onCredentialChange();
    });
    return () => {
      detachCredential();
      detachAdapter();
    };
  }, [queryClient, endpoint, enabled]);

  useEffect(() => {
    if (!error) return;
    console.error(
      `[AgentIdentity] the agents' identities could not be read from "${endpoint}", so every agent's mark is an ` +
        'empty box. `useAgentIdentities` says what asks for them again.',
      error,
    );
  }, [error, endpoint]);

  return data;
}
