/**
 * Remark plugin that strips bare numeric citation tokens — `[1]`,
 * `[2, 3]` — from assistant chat markdown.
 *
 * RAG models habitually cite retrieved sources with bracketed indices
 * next to entity mentions (`[card://delivery_item:x] [1] **Title**`).
 * The chat surfaces sources as chips and entities as inline cards, so
 * the naked indices are pure noise — and when a card fetch misses they
 * were the ONLY thing left on the line (observed live: candidate lists
 * rendering as "[1]" + bold title).
 *
 * Deliberately conservative:
 *   - text leaves only (code/inline-code nodes are never visited);
 *   - 1–2 digit indices, optionally comma-separated;
 *   - the token must be delimiter-bounded on BOTH sides (start/whitespace
 *     before; whitespace/punctuation/end after) so technical prose like
 *     `array[1]` or `foo[12]bar` is untouched.
 */

import type { Plugin } from "unified"
import type { Root, Text } from "mdast"
import { visit } from "unist-util-visit"

const CITATION_REGEX = /(^|\s)\[\d{1,2}(?:\s*,\s*\d{1,2})*\](?=[\s.,;:!?)\]]|$)/g

export const remarkStripCitations: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "text", (node: Text) => {
      if (!node.value || !node.value.includes("[")) return
      const stripped = node.value
        .replace(CITATION_REGEX, "$1")
        // Collapse doubled spaces the removal can leave mid-sentence.
        .replace(/ {2,}/g, " ")
      if (stripped !== node.value) node.value = stripped
    })
  }
}
