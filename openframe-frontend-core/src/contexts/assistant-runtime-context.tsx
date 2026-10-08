'use client';

/**
 * Assistant runtime context: what a PAGE needs to offer the host's chat
 * assistant ("Ask Mingo"): whether a chat is there to open, the assistant's
 * name and glyph, where its questions are read from, and HOW the chat is
 * opened and asked.
 *
 * A sibling of `ChatRuntimeContext` (which configures the chat panel itself)
 * and `EndpointsRuntimeContext`. It is its own context because its values
 * change with the visitor (signed in or not, chat mounted or not), and a new
 * `ChatRuntime` identity re-renders the whole chat tree.
 *
 * The NEAREST provider wins, so a page region that carries its own chat (an
 * embedded chat beside the content) mounts a provider whose `open` opens THAT
 * chat: every "ask" surface under it (`FaqSection`'s card, `AskPrompts`,
 * `AskCard`) then opens and fills it, with no prop on any of them.
 *
 * No provider, or `available: false`: the "ask" surfaces render nothing.
 */

import { createContext, useContext, type ReactNode } from 'react';

/** What an "ask" surface asks the chat to do. */
export interface AssistantOpenRequest {
  /** A question to send once the chat is open. Absent: the chat only opens. */
  prompt?: string;
  /** The topic of the surface that asked (a FAQ's topic, a page section). */
  topic?: string;
}

/** What an "ask" surface reports after a question was sent (analytics). */
export interface AssistantAskEvent {
  /** The id of the question that was asked. */
  promptId: string;
  /** The topic of the surface that asked. */
  topic?: string;
}

/** The card beside a FAQ on this host. `{assistant}` in the wording is replaced by the assistant's name. */
export interface AssistantAskCardCopy {
  title?: string;
  description?: string;
  /** How many questions the card offers. */
  count?: number;
  /**
   * The section a FAQ's card asks for when the FAQ itself states none: the
   * questions this host wrote for its FAQs. A host with several sites sets it
   * per site, so each site's FAQs get that site's questions.
   */
  topic?: string;
}

export interface AssistantRuntime {
  /** A chat is mounted for this visitor: an "ask" click has something to open. */
  available: boolean;
  /** The assistant's configured name. */
  name?: string | null;
  /** The assistant's configured glyph. Absent: the packaged Mingo mark. */
  icon?: ReactNode;
  /** The chat source the default `open` addresses its `ask-ai:open` event to. */
  source?: string;
  /**
   * GET endpoint the questions are read from:
   *   `<url>?count=<n>&section=<topic>&exclude=<id,id>` → `{ prompts: AskPrompt[] }`
   * `section` is ANY string: the host decides what topics exist (the hub: the
   * `section` attribute of a quick action, set in chat config), so a new topic
   * needs no change here. Hub: '/api/quick-actions/questions'. Absent: an "ask"
   * surface shows its launcher with no questions.
   */
  askPromptsUrl?: string;
  /**
   * Open the chat and, with `prompt`, ask it. Absent: the `ask-ai:open` event
   * of `source` (`openAskAi`), which the mounted `EmbeddableChat` listens for.
   * A host whose chat is opened another way (an embedded chat, a different
   * panel) supplies its own.
   */
  open?: (request: AssistantOpenRequest) => void;
  /** After a question was sent (analytics). */
  onAsk?: (event: AssistantAskEvent) => void;
  /** The card beside a FAQ: its wording and its default section. Absent: the lib's own. */
  askCard?: AssistantAskCardCopy;
}

export const AssistantRuntimeContext = createContext<AssistantRuntime | null>(null);

/** The nearest assistant runtime, or null when no provider is mounted. */
export function useAssistantRuntime(): AssistantRuntime | null {
  return useContext(AssistantRuntimeContext);
}
