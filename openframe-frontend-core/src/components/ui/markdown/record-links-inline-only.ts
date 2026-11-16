/**
 * A record link draws its chip only in its one form, the inline link `[label](record://type/id)`: the form every check
 * of an answer reads (`extractRecordLinks` here and in the hub, the agent's link sanitizer), so a chip never stands for a
 * record those checks did not see. A reference-style link to a record (`[label][r]` with `[r]: record://…`) is its
 * plain label, and a `record://` address in raw HTML loses its scheme, so the sanitizer drops the attribute.
 */

import type { Definition, Html, Nodes, Parent, Root, RootContent } from 'mdast';
import { visit } from 'unist-util-visit';
import { RECORD_LINK_SCHEME } from '../../../chat-protocol/record-link';

/** What a `record://` address in raw HTML becomes: a scheme no sanitizer admits. */
const NEUTRALIZED_SCHEME = 'blocked-record://';

const normalizeIdentifier = (identifier: string) => identifier.toLowerCase();

export function remarkRecordLinksInlineOnly() {
  return (tree: Root) => {
    const recordDefinitions = new Set<string>();
    visit(tree, 'definition', (node: Definition) => {
      if (node.url.startsWith(RECORD_LINK_SCHEME)) recordDefinitions.add(normalizeIdentifier(node.identifier));
    });

    // Collected first and replaced after, last first, so no replacement moves an index still to be used.
    const replacements: Array<{ parent: Parent; index: number; nodes: RootContent[] }> = [];
    visit(tree, (node: Nodes, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.type === 'html' && node.value.includes(RECORD_LINK_SCHEME)) {
        const html: Html = { ...node, value: node.value.split(RECORD_LINK_SCHEME).join(NEUTRALIZED_SCHEME) };
        replacements.push({ parent, index, nodes: [html] });
      } else if (node.type === 'linkReference' && recordDefinitions.has(normalizeIdentifier(node.identifier))) {
        replacements.push({ parent, index, nodes: node.children });
      }
    });
    for (const { parent, index, nodes } of replacements.reverse())
      parent.children.splice(index, 1, ...(nodes as never[]));
  };
}
