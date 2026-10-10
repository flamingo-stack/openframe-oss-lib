'use client';

import { useCallback, useId, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
  const { data, dataUrl, error } = useSelfFetch<AskPromptsResponse>(url);
  // Landed for THIS url (or failed): never the frame between a url appearing and its fetch starting.
  const landed = url !== null && (dataUrl === url || error);
  return { prompts: landed ? (data?.prompts ?? []) : [], isLoading: !!base && !landed, supported: !!base };
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

// ─── One pick at a time, and never a question twice ──────────────────────────
// Every surface that offers questions (a row in a section, the FAQ's card)
// takes a TURN before it picks, in the order the surfaces came to need one:
// document order for the ones a page mounts together, later for one that waits
// to be reached (the FAQ's card). A surface picks once every surface ahead of
// it has settled, and leaves out every question the page already shows. So no
// two surfaces of a page can show the same question, whatever their topics,
// with no wiring by the host. One queue per QUESTIONS ENDPOINT (the runtime's
// `askPromptsUrl`): two assistants on one page read different questions, and
// never wait for or leave out each other's. A module store, read through
// React's external-store hook.

/** One endpoint's queue: each surface's turn and the questions it settled on (`null`: not yet). */
interface AskQueue {
  enter(surface: string): void;
  settle(surface: string, ids: readonly string[] | null): void;
  leave(surface: string): void;
  subscribe(listener: () => void): () => void;
  /**
   * What `surface` must leave out, as a comma-joined list ('' for nothing),
   * once it may pick; `null` while it has no turn or a surface ahead of it is
   * still picking. A string, so React can compare two readings.
   */
  turnOf(surface: string): string | null;
}

function createAskQueue(): AskQueue {
  const entries = new Map<string, { turn: number; ids: readonly string[] | null }>();
  const listeners = new Set<() => void>();
  let next = 0;
  const publish = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    enter(surface) {
      if (entries.has(surface)) return;
      entries.set(surface, { turn: next++, ids: null });
      publish();
    },
    settle(surface, ids) {
      const entry = entries.get(surface);
      if (!entry || (entry.ids?.join(',') ?? null) === (ids?.join(',') ?? null)) return;
      entry.ids = ids;
      publish();
    },
    leave(surface) {
      if (entries.delete(surface)) publish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    turnOf(surface) {
      const own = entries.get(surface);
      if (!own) return null;
      const shown: string[] = [];
      for (const [other, entry] of entries) {
        if (other === surface) continue;
        if (entry.ids === null) {
          if (entry.turn < own.turn) return null;
          continue;
        }
        shown.push(...entry.ids);
      }
      return shown.join(',');
    },
  };
}

const askQueues = new Map<string, AskQueue>();

/** The queue a surface belongs to: the questions endpoint of its assistant runtime. */
function useAskQueue(): AskQueue {
  const scope = useAssistantRuntime()?.askPromptsUrl ?? '';
  let queue = askQueues.get(scope);
  if (!queue) {
    queue = createAskQueue();
    askQueues.set(scope, queue);
  }
  return queue;
}

export interface UseAskSurfaceOptions {
  /** What the surface is about (see `UseAskPromptsOptions.topic`). */
  topic?: string;
  count?: number;
  /**
   * Ids of questions never to offer. Absent: the ones the page's other
   * surfaces show, which this one waits for. A list: exactly those, picked at
   * once with no wait (the surfaces after it still leave its questions out).
   * `null`: the surface waits and never picks.
   */
  exclude?: readonly string[] | null;
  /** False: the surface is not ready to pick yet (it takes its turn when it is). Default true. */
  enabled?: boolean;
  /** How the chat is opened from THIS surface. Absent: the assistant runtime's opener. */
  onOpen?: (request: AssistantOpenRequest) => void;
}

export interface UseAskSurfaceResult extends UseAskPromptsResult {
  /** The nearest assistant runtime; `null` with none mounted. */
  assistant: AssistantRuntime | null;
  /** The same runtime with THIS surface's opener: what the surface's launcher reads. */
  scoped: AssistantRuntime | null;
  /** Opens the chat (and asks, with a prompt), carrying the surface's topic. */
  open: (request: { prompt?: string }) => void;
  /** Reports a question that was asked (the runtime's `onAsk`, with the topic). */
  reportAsk: (prompt: AskPrompt) => void;
}

/**
 * THE wiring of an "ask" surface, whatever it looks like: the assistant
 * runtime, the surface's questions (picked on its turn, never one the page
 * already shows), the opener and the click report. `AssistantAskPrompts` is its
 * one component; nothing else picks questions for a page.
 */
export function useAskSurface({
  topic,
  count = ASK_PROMPTS_DEFAULT_COUNT,
  exclude,
  enabled = true,
  onOpen,
}: UseAskSurfaceOptions = {}): UseAskSurfaceResult {
  const assistant = useAssistantRuntime();
  const surface = useId();
  const queue = useAskQueue();
  const picks = assistantAvailable(assistant) && !!assistant.askPromptsUrl && enabled && exclude !== null;

  // A layout effect: surfaces a page mounts together take their turns in document order.
  useLayoutEffect(() => {
    if (!picks) return undefined;
    queue.enter(surface);
    return () => queue.leave(surface);
  }, [queue, surface, picks]);

  const turn = useSyncExternalStore(
    queue.subscribe,
    () => queue.turnOf(surface),
    () => null,
  );
  // ONE pick per mount: what the page showed when this surface's turn came is what it leaves out, for good.
  const [shownAtTurn, setShownAtTurn] = useState<string | null>(null);
  if (picks && turn !== null && shownAtTurn === null) setShownAtTurn(turn);
  const leftOut = useMemo(() => exclude ?? (shownAtTurn ? shownAtTurn.split(',') : undefined), [exclude, shownAtTurn]);

  const { prompts, isLoading, supported } = useAskPrompts({
    topic,
    count,
    exclude: leftOut,
    // Told exactly what to leave out, a surface needs nobody's pick: it never waits for a turn.
    enabled: picks && (exclude !== undefined || shownAtTurn !== null),
  });
  const settled = picks && !isLoading ? prompts.map(prompt => prompt.id).join(',') : null;
  useLayoutEffect(() => {
    queue.settle(surface, settled === null ? null : settled ? settled.split(',') : []);
  }, [queue, surface, settled]);

  const open = useAssistantOpen(topic, onOpen);
  const scoped = useMemo(() => (assistant ? { ...assistant, open } : null), [assistant, open]);
  const onAsk = assistant?.onAsk;
  const reportAsk = useCallback((prompt: AskPrompt) => onAsk?.({ promptId: prompt.id, topic }), [onAsk, topic]);
  // A surface that waits (not reached, or told to) is loading wherever questions can exist.
  return { assistant, scoped, prompts, isLoading: supported && (!picks || isLoading), supported, open, reportAsk };
}

/** Tests only: forget every surface. */
export function resetAskSurfaces(): void {
  askQueues.clear();
}
