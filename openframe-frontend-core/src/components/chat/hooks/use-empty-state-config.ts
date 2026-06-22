"use client";

/**
 * Client-side hook + helper for the per-platform chat empty-state config.
 *
 * The runtime sibling of `use-slash-commands`. Where the in-app (host-mode)
 * chat receives `emptyStateGreeting` / `suggestedQueries` / `enabledRagTableIds`
 * as SSR props, a cross-origin EMBEDDER has no server hop — it fetches the
 * same three values from the host's `/api/docs/empty-state` endpoint (URL
 * threaded via `useChatRuntime().endpoints.emptyStateUrl`).
 *
 * The lib never depends on hub-internal route paths — the caller threads the
 * URL, exactly like `fetchSlashCommands`.
 */

import { useQuery } from "@tanstack/react-query";
import { embedAuthedFetch } from "../../../utils/embed-authed-fetch";

/** Wire shape of `GET /api/docs/empty-state`. */
export interface EmptyStateConfig {
  /** Admin-edited greeting (`chat_admin_personas.empty_state_greeting`).
   *  Null → caller falls back to the explicit prop / in-code default. */
  greeting: string | null;
  /** Override-aware enabled RAG-table ids — the chip-catalog filter. */
  enabledRagTableIds: string[];
  /** Admin-curated starter prompts ("Try-asking chips" →
   *  empty-state quick actions). Empty array when none. */
  suggestedQueries: string[];
}

const EMPTY_STATE_FALLBACK: EmptyStateConfig = {
  greeting: null,
  enabledRagTableIds: [],
  suggestedQueries: [],
};

/**
 * Fetch the empty-state config for the CURRENT deployment platform. The
 * chat source is server-resolved — the client sends NO `source` param.
 *
 * URL + auth handling mirror `fetchSlashCommands`: `new URL(url, origin)`
 * supports relative (proxied) and absolute paths, and `embedAuthedFetch`
 * attaches the same bearer-act-as + 401 self-heal as every other endpoint.
 *
 * On any non-2xx (auth / rate-limit / chat-disabled) returns the neutral
 * fallback so the empty state silently renders in-code defaults rather than
 * surfacing 401/403/429 toasts.
 */
export async function fetchEmptyStateConfig(
  signal: AbortSignal | undefined,
  emptyStateUrl: string,
): Promise<EmptyStateConfig> {
  try {
    const url = new URL(emptyStateUrl, window.location.origin);
    // Bare GET, no body → opt out of the default `Content-Type: application/json`.
    const res = await embedAuthedFetch(url.toString(), { signal, headers: {} });
    if (!res.ok) {
      // 401/403/429/404 are expected (auth / rate-limit / chat-disabled) and stay
      // silent. A 5xx is a real backend/proxy fault: still fall back gracefully so
      // the empty state renders, but log it so operators can distinguish a broken
      // empty-state proxy from "admin configured nothing".
      if (res.status >= 500) {
        console.error(`[chat] empty-state config fetch failed (${res.status}): ${url.pathname}`);
      }
      return EMPTY_STATE_FALLBACK;
    }
    const data = (await res.json()) as Partial<EmptyStateConfig> | null;
    return {
      greeting: data?.greeting ?? null,
      enabledRagTableIds: data?.enabledRagTableIds ?? [],
      suggestedQueries: data?.suggestedQueries ?? [],
    };
  } catch (err) {
    // Cancellation (unmount / dep change) MUST propagate so react-query treats
    // it as cancelled. Every OTHER failure (network down, proxy reject, non-JSON
    // body) degrades to the neutral fallback so a flaky empty-state endpoint can
    // NEVER break the chat — the empty state just renders the in-code defaults.
    if ((err as Error)?.name === "AbortError") throw err;
    console.warn("[chat] empty-state config fetch failed, using neutral defaults:", err);
    return EMPTY_STATE_FALLBACK;
  }
}

/**
 * Shared empty-state config (single fetch per chat surface), via react-query
 * so every consumer dedupes to ONE request. Keyed on `emptyStateUrl` ALONE —
 * the request sends no `source` param (resolved server-side), so the URL
 * fully determines the response.
 *
 * `staleTime`/`gcTime: Infinity` → static per session (toggling modes or
 * remounting the drawer reads from cache, never refetches).
 *
 * `enabled` gates the live fetch: pass `false` (e.g. when `emptyStateUrl` is
 * unset, host-mode) to skip the network call entirely; the hook then returns
 * the neutral fallback and `loaded: true`.
 */
export function useEmptyStateConfig(
  emptyStateUrl: string | undefined,
  options?: { enabled?: boolean },
): { config: EmptyStateConfig; loading: boolean; loaded: boolean } {
  const enabled = (options?.enabled ?? true) && !!emptyStateUrl;
  const query = useQuery({
    queryKey: ["chat-empty-state", emptyStateUrl],
    queryFn: ({ signal }) => fetchEmptyStateConfig(signal, emptyStateUrl as string),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    // The empty-state config is non-critical chrome — a failure degrades to the
    // neutral fallback (handled in `fetchEmptyStateConfig`). Don't retry: settle
    // immediately so a flaky endpoint never holds the welcome in a spinner.
    retry: false,
  });
  return {
    config: query.data ?? EMPTY_STATE_FALLBACK,
    loading: query.isLoading && enabled,
    // "Loaded" = settled, or not running (disabled / no URL).
    loaded: !enabled || !query.isLoading,
  };
}
