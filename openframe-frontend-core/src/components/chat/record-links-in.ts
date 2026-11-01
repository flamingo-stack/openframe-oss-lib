/**
 * The record links (`[name](record://<type>/<id>)`, `chat-protocol/record-link.ts`) a chat message's markdown DRAWS,
 * found in the PARSED markdown (CommonMark + GFM, the body's own parser), in document order. A record link in a code
 * span or a code block is text, not a link, so it is not found here and never gets a card.
 */

import type { Nodes, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { parseRecordHref, type RecordLink } from '../../chat-protocol/record-link';

/** A record link as the message shows it: its record and the name it gives it. */
export interface DrawnRecordLink extends RecordLink {
  label: string;
}

/** Built on first use, never at import: the CommonJS build loads `unified` through an interop that is not ready
 *  while this module is still being evaluated. */
let parser: ReturnType<typeof createParser> | null = null;
const createParser = () => unified().use(remarkParse).use(remarkGfm);

/** The plain text a node shows. */
function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as Nodes[]).map(textOf).join('');
  return '';
}

/** Every record link `markdown` draws, repeats included. */
export function recordLinksIn(markdown: string): DrawnRecordLink[] {
  if (!markdown || !markdown.includes('record://')) return [];
  parser ??= createParser();
  const tree = parser.runSync(parser.parse(markdown), markdown) as Root;
  const found: DrawnRecordLink[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'link') {
      const record = parseRecordHref(node.url);
      if (record) found.push({ ...record, label: textOf(node) || record.id });
      return;
    }
    if ('children' in node) for (const child of node.children as Nodes[]) visit(child);
  };
  visit(tree);
  return found;
}
