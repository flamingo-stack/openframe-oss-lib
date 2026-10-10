/**
 * The window events a page opens the chat panel with. A leaf: the launcher
 * that sends them, the panel that hears them and the on-demand shell that
 * mounts the panel on the first one all read the names from here.
 */

/** Open the chat (and, with a `prompt` in the detail, ask it). */
export const ASK_AI_OPEN_EVENT = 'ask-ai:open';

/** Open the chat with a record to ask about (a search result with no page of its own). */
export const ASK_AI_OPEN_WITH_REF_EVENT = 'ask-ai:open-with-ref';

/** Every event that opens the chat. Each carries the chat `source` it is addressed to in its detail. */
export const ASK_AI_OPEN_EVENTS = [ASK_AI_OPEN_EVENT, ASK_AI_OPEN_WITH_REF_EVENT] as const;
