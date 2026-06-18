/**
 * Remark plugin that walks markdown text leaves and replaces inline entity
 * mentions `@<marker>:<id>` (e.g. `@device:64f0a1`, `@kb:5`) with synthetic
 * `link` mdast nodes whose `url` is `mention://<marker>:<id>` (a non-standard
 * scheme). The downstream `<a>` component override in `chat-message-enhanced`
 * detects that scheme and renders an inline `<Tag>`-style chip, resolving the
 * display name from the message's `contextItems`.
 *
 * Sibling of `remark-card-links` (which handles the ASSISTANT-side
 * `[card://type:id]` markers). This one handles the USER-side `@marker:id`
 * tokens the composer commits when picking context via the `@`-mention flow.
 *
 * Why a remark plugin (NOT a regex on the raw markdown source): it splits only
 * TEXT leaves, so bold / italic / list / code wrappers around a mention stay
 * intact, and the marker disappears before any rehype-raw HTML pass.
 *
 * Grammar:
 *   - marker: `[a-z]+` — the backend `ContextItemType.marker()` short form
 *     (`device`, `script`, `ticket`, `organization`, `user`, `kb`, `policy`,
 *     `query`, …). Always lowercase.
 *   - id: `[A-Za-z0-9_.+/=-]+` — the mention-token charset (UUIDs with hyphens,
 *     fleet numeric ids, etc.). Matches the composer's `MENTION_TOKEN`.
 *   - A LEFT boundary (start-of-text or whitespace) keeps `@marker:` from
 *     matching inside emails / mid-word (`user@host:1234` never starts a token
 *     because the `@` isn't at a boundary).
 */

import type { Plugin } from 'unified'
import type { Root, Text, Link } from 'mdast'
import { visit, SKIP } from 'unist-util-visit'

const MENTION_REGEX = /(^|\s)@([a-z]+):([A-Za-z0-9_.+/=-]+)/g

export const remarkMentionChips: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return
      const text = node.value
      if (!text || !text.includes('@')) return

      const parts: Array<Text | Link> = []
      let lastIndex = 0
      MENTION_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = MENTION_REGEX.exec(text)) !== null) {
        const lead = match[1] // '' or the whitespace char before '@'
        const marker = match[2]
        const id = match[3]
        const tokenStart = match.index + lead.length // position of '@'
        if (tokenStart > lastIndex) {
          parts.push({ type: 'text', value: text.slice(lastIndex, tokenStart) })
        }
        parts.push({
          type: 'link',
          url: `mention://${marker}:${id}`,
          // Keep the raw token as the visible children so an unresolved mention
          // (no matching context item) falls back to the literal text.
          children: [{ type: 'text', value: `@${marker}:${id}` }],
        })
        lastIndex = match.index + match[0].length
      }
      if (lastIndex === 0) return // no matches

      if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) })
      }

      parent.children.splice(index, 1, ...parts)
      return [SKIP, index + parts.length]
    })
  }
}
