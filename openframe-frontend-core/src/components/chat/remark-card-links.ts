/**
 * Remark plugin that walks markdown text leaves and replaces `[card://<type>:<id>]`
 * patterns with synthetic `link` mdast nodes. The link's `url` is the literal
 * `card://<type>:<id>` (a non-standard scheme) so the downstream `<a>`
 * component override can detect it and delegate rendering to the host's
 * `renderEntityCard` callback (see `chat-message-enhanced.tsx`).
 *
 * Why a remark plugin (NOT a regex on the raw markdown source):
 *   - Preserves bold / italic / list / code wrapping around the marker.
 *     `**The [card://webinar:42] discussed pricing**` keeps the bold span
 *     because the plugin only splits TEXT leaves; the strong wrapper is
 *     untouched.
 *   - No clash with rehype-raw — the marker disappears before the HTML pass.
 *
 * Per v6.1 §B.2.6: "implement as a `react-markdown` `components.text` override
 * OR a remark plugin. NOT a regex-on-raw-text pre-pass (which loses formatting)."
 *
 * Regex shape: `[a-zA-Z0-9_-]+` for both type and id. Tolerates snake_case
 * AND kebab-case so it matches whatever `documentType` value the LLM echoes
 * from the server snapshot (e.g. `customer_interview` from the config vs
 * `customer-interview` if a future config switches conventions).
 */

import type { Plugin } from "unified"
import type { Root, Text, Link } from "mdast"
import { visit, SKIP } from "unist-util-visit"

// Closing bracket is `]` per spec, but tolerate `)` as well — the LLM
// occasionally drifts to `)` after long dashed UUID ids (bracket-balancing
// noise on opaque tokens; reproduced in production with podcast UUIDs).
// The `[card://` open is the load-bearing signature; if the open matches,
// treat trailing `)` as `]`. `[card://type:id)` is not valid markdown
// syntax anywhere else (regular links use `[text](url)`, not `[text)`),
// so widening the closer has zero false-positive risk.
const CARD_REGEX = /\[card:\/\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)[\])]/g

export const remarkCardLinks: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return
      const text = node.value
      if (!text || !text.includes("[card://")) return

      // Walk the regex and split the text into a sequence of text + link nodes.
      // The link's `children` carry the original literal so unknown-ref
      // fallbacks (no matching key in the refs map) render the literal text
      // instead of a broken anchor.
      const parts: Array<Text | Link> = []
      let lastIndex = 0
      // Reset the regex lastIndex for each invocation — `g` flag carries state.
      CARD_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = CARD_REGEX.exec(text)) !== null) {
        const matchStart = match.index
        if (matchStart > lastIndex) {
          parts.push({ type: "text", value: text.slice(lastIndex, matchStart) })
        }
        const cardType = match[1]
        const cardId = match[2]
        parts.push({
          type: "link",
          url: `card://${cardType}:${cardId}`,
          // Keep the raw marker as the visible text so unknown-ref renderers
          // can fall back to title-only formatting (the chat-side override
          // looks up refs by url and replaces children when found).
          children: [{ type: "text", value: match[0] }],
        })
        lastIndex = matchStart + match[0].length
      }
      if (lastIndex === 0) return // no matches

      if (lastIndex < text.length) {
        parts.push({ type: "text", value: text.slice(lastIndex) })
      }

      // Replace the original text node in-place. Skip past the inserted nodes
      // so the visitor doesn't recurse into them (the new text leaves can't
      // contain the marker by construction; skipping is a safety net).
      parent.children.splice(index, 1, ...parts)
      return [SKIP, index + parts.length]
    })
  }
}
