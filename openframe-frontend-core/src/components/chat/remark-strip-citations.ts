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
 *   - 1–2 digit indices, optionally comma-separated, and runs of them (`[1][2]`);
 *   - the token must be delimiter-bounded on BOTH sides (start/whitespace
 *     before; whitespace/punctuation/end after) so technical prose like
 *     `array[1]` or `foo[12]bar` is untouched.
 */

import type { Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/** A run of citation markers (`[1]`, `[2, 3]`, `[1][2]`) bounded by whitespace or the start on the left and by
 *  whitespace, punctuation or the end on the right. */
const CITATION_REGEX = /(^|\s)(?:\[\d{1,2}(?:\s*,\s*\d{1,2})*\])+(?=[\s.,;:!?)\]]|$)/g;

/** What a removed run leaves: nothing when punctuation or the end follows it (so "command [1]." reads "command."),
 *  else the whitespace that preceded it. */
function withoutRun(text: string): string {
  return text.replace(CITATION_REGEX, (run: string, lead: string, offset: number) => {
    const next = text.charAt(offset + run.length);
    return next === '' || /[.,;:!?)\]]/.test(next) ? '' : lead;
  });
}

export const remarkStripCitations: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      if (!node.value || !node.value.includes('[')) return;
      const withoutCitations = withoutRun(node.value);
      // No citation matched → leave the node untouched, INCLUDING its
      // whitespace (collapsing unconditionally would rewrite deliberate
      // spacing in prose like `array[1]  value`).
      if (withoutCitations === node.value) return;
      // Replace the text node rather than editing `node.value` in place —
      // same idiom as remark-card-links / remark-mention-chips next door, and
      // the node the visitor was handed is left alone. The spread keeps
      // `position` so source mapping survives. Length is unchanged, so the
      // walker needs no index steering: it has already captured the original
      // leaf and moves on to the next sibling, never re-entering this slot.
      parent.children.splice(index, 1, {
        ...node,
        // Collapse doubled spaces the removal can leave mid-sentence.
        value: withoutCitations.replace(/ {2,}/g, ' '),
      });
    });
  };
};
