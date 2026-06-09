"use client";

/**
 * Client-side hook + helper for the slash-command autocomplete.
 *
 * `fetchSlashCommands` is a stateless wrapper around the host's
 * commands endpoint. The caller threads the URL — the lib never
 * depends on hub-internal route paths.
 *
 * `useSlashCommands` is the React-state version (debounced, cancellable).
 *
 * Types live in `../types/component.types` so the autocomplete
 * dropdown and the chat-side runtime share one source of truth.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { embedAuthedFetch } from "../../../utils/embed-authed-fetch";
import type {
  SlashCommandActionId,
  SlashCommandSummaryAction,
  SlashCommandSummary,
} from "../types/component.types";

// Re-export so callers can `import { SlashCommandSummary } from
// '@flamingo-stack/openframe-frontend-core/components/chat/hooks'`
// without reaching into types. The component.types module is the
// canonical declaration.
export type {
  SlashCommandActionId,
  SlashCommandSummaryAction,
  SlashCommandSummary,
};

/**
 * Fetch slash-command suggestions for the CURRENT deployment platform,
 * matching id-prefix `prefix`. The chat source is server-resolved — the
 * client sends NO `source` param on the URL.
 *
 * `commandsUrl` is required — supplied by `useChatRuntime().endpoints.commandsUrl`
 * at the call site. NO default value.
 *
 * URL handling: `new URL(commandsUrl, window.location.origin)` works
 * for both relative (e.g. `/api/mingo-guide/commands` → resolved against
 * the embedder origin, proxy handles it) and absolute
 * (e.g. `https://hub.openframe.ai/api/commands` → the base arg is
 * ignored).
 *
 * Auth: rides on `embedAuthedFetch` (same bearer-act-as + 401 self-heal
 * as the chat stream / identity / attachment calls) so a host that runs
 * proxy-impersonation or a refresh-capable auth adapter gets its creds
 * attached here too — no host-side `window.fetch` patch required. Hosts
 * with no adapter fall through to cookie auth unchanged.
 *
 * Returns the parsed `commands` array; on any non-2xx (auth,
 * rate-limit, chat-disabled) returns an empty array — the autocomplete
 * UI silently shows no suggestions rather than surfacing 401/403/429
 * toasts.
 */
export async function fetchSlashCommands(
  prefix: string,
  signal: AbortSignal | undefined,
  commandsUrl: string,
): Promise<SlashCommandSummary[]> {
  const url = new URL(commandsUrl, window.location.origin);
  if (prefix) url.searchParams.set("q", prefix);
  // `headers: {}` opts out of the default `Content-Type: application/json`
  // — this is a bare GET with no body, so no content-type is needed.
  const res = await embedAuthedFetch(url.toString(), { signal, headers: {} });
  if (!res.ok) return [];
  const data = (await res.json()) as { commands?: SlashCommandSummary[] };
  return data.commands ?? [];
}

/**
 * Debounced, cancellable React hook. Returns `{ commands, loading }`.
 *
 * `commandsUrl` is required — pass `useChatRuntime().endpoints.commandsUrl`.
 */
export function useSlashCommands(
  prefix: string | null,
  commandsUrl: string,
): { commands: SlashCommandSummary[]; loading: boolean } {
  const [commands, setCommands] = useState<SlashCommandSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefix == null) {
      setCommands([]);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const next = await fetchSlashCommands(prefix, ctrl.signal, commandsUrl);
        if (!cancelled) setCommands(next);
      } catch (err) {
        // AbortError on dep-change / unmount is expected; log others.
        if (!cancelled && (err as Error)?.name !== "AbortError") {
          console.warn("[use-slash-commands] fetch failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(handle);
    };
  }, [prefix, commandsUrl]);

  return { commands, loading };
}

/**
 * The full slash-command registry (empty-prefix fetch), shared via
 * react-query so every consumer in one chat surface dedupes to a SINGLE
 * network request.
 *
 * Keyed on `commandsUrl` ALONE — the request sends no `source` param (the
 * hub resolves source server-side), so the URL fully determines the
 * response. Both the onboarding-card list in `<EmbeddableChat>` and the
 * SSE adapter's `displayRef` table lookup read from this one cache entry
 * instead of each firing their own `fetchSlashCommands('')`.
 *
 * `staleTime`/`gcTime: Infinity` → static per session, so toggling modes
 * or remounting the (close-on-unmount) drawer reads from cache, never
 * refetches.
 *
 * `enabled` gates the live fetch: pass `activeMode === 'guide'` (or the
 * SSE adapter's `active` flag) so opening the panel in Mingo mode does
 * NOT hit the commands endpoint at all.
 */
export function useSlashCommandRegistry(
  commandsUrl: string,
  options?: { enabled?: boolean },
): { commands: SlashCommandSummary[]; loading: boolean; loaded: boolean } {
  const query = useQuery({
    queryKey: ["chat-slash-commands", commandsUrl],
    queryFn: ({ signal }) => fetchSlashCommands("", signal, commandsUrl),
    enabled: options?.enabled ?? true,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return {
    commands: query.data ?? [],
    loading: query.isLoading,
    // "Loaded" = the fetch has settled, or it isn't running (disabled).
    loaded: !query.isLoading,
  };
}
