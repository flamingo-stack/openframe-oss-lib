/**
 * The ONE place the "Ask Mingo" (discuss) prompt for an inline entity card is
 * composed — shared by every transport so the affordance reads identically
 * wherever it is clicked.
 *
 * ## Why the two transports still differ underneath
 *
 * The prose is UX only. What narrows retrieval differs:
 *
 *   - **SSE / guide** — `sendMessage(prompt, { commandOverride: { entityIdFilter:
 *     { tableId, id } } })`. Retrieval is strictly primary-key-driven; the
 *     sentence is decoration.
 *   - **Mingo / NATS** — the agent backend has no entity-id-filtered retrieval
 *     (`ContextItemType` covers DEVICE / SCRIPT / TICKET / ORGANIZATION / USER /
 *     KB_ARTICLE / POLICY / QUERY / SCHEDULED_SCRIPT — no content types), so the
 *     prompt is ALL the agent gets. Hence `includeReference`, which appends the
 *     type + id so the agent can still identify the exact row by text.
 *
 * When the backend grows an id-filter for the agent transport, the Mingo callers
 * switch to it and drop `includeReference` — the prose stays put.
 */

import { sanitizeTitleForChat } from './slash-dispatch-utils'

export interface DiscussPromptRef {
  /** documentType, e.g. `'roadmap_item'`. */
  type: string
  /** Primary key — the id from the `[card://type:id]` marker. */
  id: string
  /** Display title. May be the bare id on a synthetic ref (Mingo). */
  title?: string | null
}

export interface BuildDiscussPromptOptions {
  /**
   * Append `(<type> <id>)` so a transport WITHOUT structured entity filtering
   * still points the agent at the exact row. Default `false` — the SSE path
   * sends `entityIdFilter` and must keep the sentence clean.
   */
  includeReference?: boolean
}

/**
 * `Tell me more about <title>` — plus `(<type> <id>)` when
 * `includeReference` is set and the title alone is ambiguous.
 *
 * Falls back to `this item` when the ref has no usable title, matching the
 * long-standing SSE behavior. A title that is just the id (the synthetic ref a
 * Mingo `[card://…]` marker produces before its row loads) is treated as
 * missing, so the prompt never degrades to `Tell me more about 86ad3qvv5`.
 */
export function buildDiscussPrompt(
  reference: DiscussPromptRef,
  options: BuildDiscussPromptOptions = {},
): string {
  const id = (reference.id ?? '').trim()
  const rawTitle = (reference.title ?? '').trim()
  const usableTitle = rawTitle && rawTitle !== id ? sanitizeTitleForChat(rawTitle) : ''
  const prompt = `Tell me more about ${usableTitle || 'this item'}`
  if (!options.includeReference || !id) return prompt
  // Only worth the noise when the reference adds something the title doesn't.
  return `${prompt} (${reference.type} ${id})`
}
