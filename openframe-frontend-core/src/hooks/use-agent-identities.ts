'use client';

import { type Query, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  answeredAfterRefresh,
  hasEmbedAuthAdapter,
  isRetryableStatus,
  subscribeEmbedCredentialSource,
} from '../utils/embed-authed-fetch';
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

const agentIdentitiesKey = (endpoint: string) => ['agent-identities', endpoint] as const;

/**
 * Why a read failed, by what can make the next one succeed (which answer is which: `refusalOf`, and the rule
 * on `useAgentIdentities`):
 * - `transient`: the same read can succeed a moment later.
 * - `stale`: a 401 to an attempt that left with less than the host holds now: the next one is sent with it.
 * - `unauthorized`: only a new credential, or the host registering its adapter, can lift it.
 * - `final`: asked again, the answer is the same.
 *
 * The picture store sorts its failures by the same facts (`retryOnFor` in `use-authed-asset-src.ts`) and leaves a
 * 5xx to the picture's next mount. Here one read serves the whole page and nothing remounts to ask it.
 */
type ReadFailure = 'transient' | 'stale' | 'unauthorized' | 'final';

class AgentIdentitiesReadError extends Error {
  readonly failure: ReadFailure;

  constructor(failure: ReadFailure, detail: string | number) {
    super(`agent identities read failed (${detail})`);
    this.failure = failure;
  }
}

function failureOf(error: unknown): ReadFailure {
  // Whatever else is thrown is the host refusing to send (its adapter's `beforeRequest` / `onResponse`, the
  // origin guard) or an answer that is not the identities: neither changes by asking again. No error at all
  // (the read answered, or none sent yet) has nothing to ask again either.
  return error instanceof AgentIdentitiesReadError ? error.failure : 'final';
}

/**
 * How many times the host has reported a credential, or registered an adapter, to a mounted caller. An attempt
 * notes it when it is sent, so its 401 can tell whether the host holds something the attempt did not carry.
 */
let credentialReports = 0;
let reportedThisTurn = false;

/** One report per event, however many callers hear it: a host tells them all in one synchronous turn. */
function noteCredentialReport(): void {
  if (reportedThisTurn) return;
  reportedThisTurn = true;
  credentialReports += 1;
  queueMicrotask(() => {
    reportedThisTurn = false;
  });
}

/** What the host held when an attempt was sent. */
interface Sent {
  /** No adapter was registered: the request left unsigned. */
  unsigned: boolean;
  reports: number;
}

function refusalOf(response: Response, sent: Sent): ReadFailure {
  const { status } = response;
  if (isRetryableStatus(status)) return 'transient';
  // A 401 to the retry `embedAuthedFetch` sent with a credential it had just refreshed is final.
  if (status !== 401 || answeredAfterRefresh(response)) return 'final';
  const outgrown = (sent.unsigned && hasEmbedAuthAdapter()) || credentialReports !== sent.reports;
  return outgrown ? 'stale' : 'unauthorized';
}

/**
 * `fetch` and a body read reject with a TypeError when the answer never came or was cut short: offline, DNS, a
 * dropped connection.
 */
function orTransient<T>(read: Promise<T>): Promise<T> {
  return read.catch((error: unknown) => {
    throw error instanceof TypeError ? new AgentIdentitiesReadError('transient', error.message) : error;
  });
}

async function fetchAgentIdentities(endpoint: string, signal: AbortSignal): Promise<AgentIdentityIcons> {
  const sent: Sent = { unsigned: !hasEmbedAuthAdapter(), reports: credentialReports };
  const response = await orTransient(contentFetch(endpoint, { signal }));
  if (!response.ok) throw new AgentIdentitiesReadError(refusalOf(response, sent), response.status);
  const body = (await orTransient(response.json())) as {
    agents?: Array<{ slug?: string; icon?: AgentIdentityIcon | null }>;
  } | null;
  const icons: Record<string, AgentIdentityIcon> = {};
  for (const agent of body?.agents ?? []) if (agent.slug && agent.icon) icons[agent.slug] = agent.icon;
  return icons;
}

/** How many more times a transient failure is asked again on a timer. */
const TIMED_ATTEMPTS = 3;
/** The wait before the first of them, in ms; each later wait is three times the one before (2s, 6s, 18s). */
const FIRST_WAIT_MS = 2_000;

/** Whether another attempt, on a timer, may get past the failure. */
function timed(error: unknown): boolean {
  const failure = failureOf(error);
  return failure === 'transient' || failure === 'stale';
}

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
 * on its timer is dropped when no caller of the endpoint has it true.
 *
 * The provider above the marks is mounted once for the page, so a read that
 * failed has to be asked again here: nothing remounts to ask it. What asks
 * again depends on what can change the answer:
 *   - No answer at all (or one cut short), a 5xx, a 408 or a 429:
 *     `TIMED_ATTEMPTS` more attempts on a timer, each after a longer wait
 *     (react-query holds them while the page is hidden or offline). After
 *     those: when the page is shown again and when the browser is back online
 *     (react-query's focus and online signals, which a host may wire to its
 *     own), and when the host holds a new credential.
 *   - A 401 the adapter's refresh did not get past: ONLY when the host holds a
 *     new credential (`subscribeEmbedCredentialSource`: the adapter reports
 *     one, or an adapter is registered). Never on a timer and never on an event
 *     that says nothing about the credential: each such attempt would start
 *     another refresh, which is what ends a sign-in in progress. The one 401
 *     that is timed is the answer to an attempt that left with less than the
 *     host holds now (unsigned, before its adapter registered, or before a
 *     credential it has reported since): the next attempt is sent with it.
 *     Once those attempts are over it waits for a credential like any 401.
 *   - Anything else (a 401 to a credential just refreshed, another 4xx, the
 *     host refusing to send, an answer that is not the identities): not asked
 *     again until `enabled` turns false and true again. The answer would be the
 *     same, and a 401 asked again on every new credential would refresh, and so
 *     rotate the session, each time.
 *
 * A caller that mounts later asks a failed read again whatever the failure:
 * that is react-query's rule for a read with no answer yet.
 * A read that gave up says so in the console, in production too: a mark whose
 * identity is not held is then an empty box with nothing else to show why.
 */
export function useAgentIdentities(
  endpoint: string = AGENT_IDENTITIES_API_PATH,
  enabled: boolean = true,
): AgentIdentityIcons | undefined {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: agentIdentitiesKey(endpoint),
    queryFn: ({ signal }) => fetchAgentIdentities(endpoint, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failureCount, thrown) => failureCount < TIMED_ATTEMPTS && timed(thrown),
    retryDelay: failureCount => FIRST_WAIT_MS * 3 ** failureCount,
    // Only identities that could not be read are stale (`staleTime`), so these never ask for ones already held.
    refetchOnWindowFocus: eventMayAsk,
    refetchOnReconnect: eventMayAsk,
    enabled,
  });

  useEffect(() => {
    const filter = { queryKey: agentIdentitiesKey(endpoint), exact: true };
    // react-query keeps a timed attempt going while the query has a caller, held back or not. The read of another
    // caller of this endpoint that is not held back is left alone.
    const dropUnlessAsked = () => {
      if (!queryClient.getQueryCache().find(filter)?.isActive()) void queryClient.cancelQueries(filter);
    };
    if (!enabled) {
      dropUnlessAsked();
      return undefined;
    }
    const detach = subscribeEmbedCredentialSource(() => {
      noteCredentialReport();
      const state = queryClient.getQueryState(filter.queryKey);
      // A read in flight is left alone: if it is refused, the report above is what times its next attempt.
      if (state?.fetchStatus !== 'idle' || failureOf(state.error) === 'final') return;
      void queryClient.refetchQueries(filter);
    });
    return () => {
      detach();
      // After this commit's effects: react-query moves this caller's observer to a new endpoint in one of them.
      queueMicrotask(dropUnlessAsked);
    };
  }, [queryClient, endpoint, enabled]);

  useEffect(() => {
    if (!error) return;
    console.error(
      `[AgentIdentity] the agents' identities could not be read from "${endpoint}", so a mark whose identity ` +
        'is not held is an empty box. `useAgentIdentities` says what asks for them again.',
      error,
    );
  }, [error, endpoint]);

  return data;
}
