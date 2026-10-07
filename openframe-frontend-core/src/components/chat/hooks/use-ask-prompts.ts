'use client';

import { useCallback, useId, useLayoutEffect, useSyncExternalStore } from 'react';
import {
  useAssistantRuntime,
  type AssistantOpenRequest,
  type AssistantRuntime,
} from '../../../contexts/assistant-runtime-context';
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import { openAskAi } from '../../navigation/mingo-ai-button';
import type { AskPrompt } from '../ask-prompts';

/** The answer of a host's questions endpoint (`AssistantRuntime.askPromptsUrl`). */
export interface AskPromptsResponse {
  prompts: AskPrompt[];
}

/** How many questions an "ask" surface offers when nothing states a number. */
export const ASK_PROMPTS_DEFAULT_COUNT = 3;

/** The questions URL: the host's endpoint with the surface's count, topic and exclusions. */
export function buildAskPromptsUrl(
  base: string,
  { count, topic, exclude = [] }: { count: number; topic?: string; exclude?: readonly string[] },
): string {
  const params = new URLSearchParams({ count: String(count) });
  if (topic) params.set('section', topic);
  if (exclude.length > 0) params.set('exclude', exclude.join(','));
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** An "ask" surface has something to open: a runtime is mounted and its chat is there. */
export function assistantAvailable(assistant: AssistantRuntime | null): assistant is AssistantRuntime {
  return !!assistant?.available;
}

export interface UseAskPromptsOptions {
  /**
   * What the surface is about: ANY string the host's endpoint knows (sent as
   * `section`). Questions written for it are picked first. Absent: general ones.
   */
  topic?: string;
  count?: number;
  /** Ids of questions never to pick (the ones the page already shows). */
  exclude?: readonly string[];
  /** False: nothing is fetched yet (the surface is not ready to pick). Default true. */
  enabled?: boolean;
}

export interface UseAskPromptsResult {
  prompts: AskPrompt[];
  /** True until the pick has landed (or failed). False where nothing is fetched. */
  isLoading: boolean;
  /** The host has a questions endpoint and a chat to ask: questions can exist here. */
  supported: boolean;
}

/**
 * The questions an "ask" surface offers, picked by the HOST for this visit
 * (`AssistantRuntime.askPromptsUrl`). One pick per mount: read once, never
 * cached, so a visitor keeps the same questions while the page is open and
 * gets a new pick next time. A failed read leaves the list empty. No chat, or
 * no endpoint: nothing is fetched and the list is empty.
 */
export function useAskPrompts({
  topic,
  count = ASK_PROMPTS_DEFAULT_COUNT,
  exclude,
  enabled = true,
}: UseAskPromptsOptions = {}): UseAskPromptsResult {
  const assistant = useAssistantRuntime();
  const base = assistantAvailable(assistant) ? assistant.askPromptsUrl : undefined;
  const url = base && enabled ? buildAskPromptsUrl(base, { count, topic, exclude }) : null;
  const { data, isLoading } = useSelfFetch<AskPromptsResponse>(url);
  return { prompts: data?.prompts ?? [], isLoading: !!base && (!enabled || isLoading), supported: !!base };
}

/**
 * How an "ask" surface opens the chat and asks it: its own `onOpen`, else the
 * nearest assistant runtime's `open`, else the `ask-ai:open` event of the
 * runtime's source (the mounted `EmbeddableChat`). The surface's topic rides
 * every request, so a host with several chats can tell them apart.
 */
export function useAssistantOpen(
  topic?: string,
  onOpen?: (request: AssistantOpenRequest) => void,
): (request: { prompt?: string }) => void {
  const assistant = useAssistantRuntime();
  const runtimeOpen = assistant?.open;
  const source = assistant?.source;
  return useCallback(
    (request: { prompt?: string }) => {
      const full: AssistantOpenRequest = { ...request, topic };
      if (onOpen) onOpen(full);
      else if (runtimeOpen) runtimeOpen(full);
      else openAskAi(source, request);
    },
    [onOpen, runtimeOpen, source, topic],
  );
}

// ─── The questions the page already shows ────────────────────────────────────
// Every surface that shows questions says which ones (`useShownAskPrompts`), so
// a later surface (the FAQ's card) never repeats one, with no wiring by the
// host. One page, one list: a module store, read through React's external-store
// hook. `null` for a surface = it is still picking.

const shownBySurface = new Map<string, readonly string[] | null>();
const listeners = new Set<() => void>();
const NO_IDS: readonly string[] = [];
let snapshot: readonly string[] | null = NO_IDS;

function publish(): void {
  const lists = [...shownBySurface.values()];
  const next = lists.some(list => list === null) ? null : lists.flatMap(list => list ?? []);
  const same = next === null ? snapshot === null : snapshot !== null && next.join(',') === snapshot.join(',');
  if (same) return;
  snapshot = next === null ? null : next.length > 0 ? next : NO_IDS;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Say which questions this surface shows. `null`: it is still picking, so a
 * surface that must not repeat them waits. Pass `undefined` to say nothing
 * (the surface shows no questions here).
 */
export function useShownAskPrompts(ids: readonly string[] | null | undefined): void {
  const surface = useId();
  const key = ids === undefined ? undefined : ids === null ? null : ids.join(',');
  // A layout effect: the list holds this surface before any reader's own effects run.
  useLayoutEffect(() => {
    if (key === undefined) return undefined;
    shownBySurface.set(surface, key === null ? null : key ? key.split(',') : NO_IDS);
    publish();
    return () => {
      shownBySurface.delete(surface);
      publish();
    };
  }, [surface, key]);
}

/** The ids of the questions the page's other surfaces show; `null` while one of them is still picking. */
export function useShownAskPromptIds(): readonly string[] | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => NO_IDS,
  );
}

/** Tests only: forget every surface. */
export function resetShownAskPrompts(): void {
  shownBySurface.clear();
  snapshot = NO_IDS;
}
