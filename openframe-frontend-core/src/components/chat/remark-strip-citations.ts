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
 *   - what counts as a citation is the chat protocol's one chip grammar
 *     (`chat-protocol/citation-chip.ts`), the same one the server writes, so
 *     technical prose like `array[1]` or `foo[12]bar` is untouched.
 */

import type { Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { stripCitationChips } from '../../chat-protocol/citation-chip';

export const remarkStripCitations: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      if (!node.value || !node.value.includes('[')) return;
      const withoutCitations = stripCitationChips(node.value);
      // No citation matched → leave the node untouched.
      if (withoutCitations === node.value) return;
      // Replace the text node rather than editing `node.value` in place —
      // same idiom as remark-card-links / remark-mention-chips next door, and
      // the node the visitor was handed is left alone. The spread keeps
      // `position` so source mapping survives. Length is unchanged, so the
      // walker needs no index steering: it has already captured the original
      // leaf and moves on to the next sibling, never re-entering this slot.
      parent.children.splice(index, 1, { ...node, value: withoutCitations });
    });
  };
};
