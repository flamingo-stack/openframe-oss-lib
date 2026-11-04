/**
 * A chat answer names a record with an ordinary markdown link whose href is the record's address:
 *
 *     The [Mac onboarding guide](record://onboarding_guide/mac-guide) walks you through it.
 *
 * The link text is the name the reader sees, so nothing is typed twice. The chat draws the link as a chip (the
 * record's icon and that name) inside the sentence; a card is a part of the message of its own (`./record-cards`). A
 * server that knows which records a turn loaded checks each link before it reaches the reader and turns one it never
 * offered into plain text (`unlinkUnknownRecords`).
 *
 * The same URI is a record's identity everywhere: a source's `sourceId`, a citation's `source.id`, a card. `record://<type>`
 * with no id is a COLLECTION: what a citation points at when it cites a table's header block. It names no record, so it
 * can never become a chip or a card (`parseRecordHref` answers null for it).
 *
 * It replaced two private tokens a model typed into its text, one for a card and one for a chip. Those were not
 * markdown, so markdown broke them (a code span, a link, emphasis), and they carried no name.
 *
 * A record link is found in the PARSED markdown (CommonMark + GFM, the chat body's own parser), never by a pattern over
 * the text: a record link in a code span or a code block is text, not a link, so no reader counts it, the server's
 * check included. THE one parser (`extractRecordLinks`, `replaceRecordLinks`, `recordLinksInParts`), for the chat's
 * renderer, its composer and every server.
 *
 * Server-safe: no React, no browser APIs. Mirrored by the Java agent (openframe-saas-tenant); both are held to the
 * record-link vectors the hub serves (`__tests__/record-link.test.ts`).
 */

import type { Nodes, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import type { ChatPart } from './chat-message';

export const RECORD_LINK_SCHEME = 'record://';

/** A record's type: a slug (`onboarding_guide`, `script`, `scheduledScript`). */
const RECORD_TYPE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** A record an answer links to. */
export interface RecordLink {
  type: string;
  id: string;
}

/** A record link as a message shows it: its record and the name it gives it. */
export interface DrawnRecordLink extends RecordLink {
  label: string;
}

/** A record link found in a text, with the name it shows and where it sits (`text.slice(start, end)` is the link). */
export interface RecordLinkMatch extends DrawnRecordLink {
  start: number;
  end: number;
  /** The name as the markdown writes it (escapes and emphasis kept), what the link becomes when it is unlinked. */
  labelSource: string;
}

/**
 * The href of a record: `record://<type>/<id>`, the id percent-encoded so a slug, a path (`docs/setup.md`), a space or
 * a `)` can never end the markdown link early: `encodeURIComponent`, plus `(` and `)`, which it leaves alone and a
 * markdown destination cannot hold. The Java agent's `RecordKey` encodes the same; both are held to the vectors the hub
 * serves (`record-link-vectors.json`). Every server that offers a record to a model hands it this exact href.
 */
export function recordHref(type: string, id: string): string {
  return `${RECORD_LINK_SCHEME}${type}/${encodeURIComponent(id).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}

/** The URI of a collection: every record of a type, as one source. */
export function collectionHref(type: string): string {
  return `${RECORD_LINK_SCHEME}${type}`;
}

/** The type a collection URI names, or null when it is not one. A record's URI is not a collection. */
export function parseCollectionHref(href: unknown): { type: string } | null {
  if (typeof href !== 'string' || !href.startsWith(RECORD_LINK_SCHEME)) return null;
  const type = href.slice(RECORD_LINK_SCHEME.length);
  return RECORD_TYPE.test(type) ? { type } : null;
}

/**
 * A record or collection URI in its one spelling, or null when it is neither. A URI read off the wire or out of a
 * model's text goes through this before it is a key: `record://markdown/docs/setup.md` and
 * `record://markdown/docs%2Fsetup.md` are one record.
 */
export function normalizeRecordUri(href: unknown): string | null {
  const record = parseRecordHref(href);
  if (record) return recordHref(record.type, record.id);
  const collection = parseCollectionHref(href);
  return collection ? collectionHref(collection.type) : null;
}

/** A source's id in its one spelling: what every reader of a source or a citation keys on. Anything but a record URI (the
 *  standard's id is any string) stays as it came. */
export function normalizeSourceId(id: string): string {
  return normalizeRecordUri(id) ?? id;
}

/** The record an href names, or null when it is not a record href. The id is decoded; an id the model left unencoded
 *  (`docs/setup.md`) reads the same, because the type ends at the FIRST slash. */
export function parseRecordHref(href: unknown): RecordLink | null {
  if (typeof href !== 'string' || !href.startsWith(RECORD_LINK_SCHEME)) return null;
  const rest = href.slice(RECORD_LINK_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  const type = rest.slice(0, slash);
  if (!RECORD_TYPE.test(type)) return null;
  return { type, id: safeDecode(rest.slice(slash + 1)) };
}

/** The records a list names: each once, in its one spelling. What names no record (a collection, anything else) goes. */
export function normalizeRecordUris(uris: unknown): string[] {
  if (!Array.isArray(uris)) return [];
  const records = new Set<string>();
  for (const uri of uris) {
    if (parseRecordHref(uri)) records.add(normalizeRecordUri(uri) as string);
  }
  return [...records];
}

/**
 * A record link as markdown: `[label](record://type/id)`. The label is escaped so a bracket in a name cannot end the
 * link early; an empty label falls back to the id. What a composer writes for a picked record and a server for a
 * record it names.
 */
export function recordLinkMarkdown(record: RecordLink, label: string): string {
  const text = label.trim() || record.id;
  return `[${text.replace(/([\\[\]])/g, '\\$1')}](${recordHref(record.type, record.id)})`;
}

function safeDecode(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

/** Every record link a text draws, in document order: what the parsed markdown holds as a link to a record. */
export function extractRecordLinks(text: string): RecordLinkMatch[] {
  if (!text || !text.includes(RECORD_LINK_SCHEME)) return [];
  parser ??= createParser();
  const tree = parser.runSync(parser.parse(text), text) as Root;
  const found: RecordLinkMatch[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'link') {
      const record = parseRecordHref(node.url);
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (record && start !== undefined && end !== undefined) {
        const first = node.children[0]?.position?.start.offset;
        const last = node.children[node.children.length - 1]?.position?.end.offset;
        const labelSource = first !== undefined && last !== undefined ? text.slice(first, last) : '';
        found.push({ ...record, label: textOf(node) || record.id, start, end, labelSource });
      }
      return;
    }
    if ('children' in node) for (const child of node.children as Nodes[]) visit(child);
  };
  visit(tree);
  return found;
}

/** The text with each record link replaced by what `replace` answers for it; the rest of the text is untouched. */
export function replaceRecordLinks(text: string, replace: (link: RecordLinkMatch) => string): string {
  const links = extractRecordLinks(text);
  let out = text;
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    out = out.slice(0, link.start) + replace(link) + out.slice(link.end);
  }
  return out;
}

/**
 * The text with every record link the reader may not be shown turned into its name as written: the server's check
 * before an answer leaves it. `allowed` says whether a record was offered to the model this turn. A link with no label
 * becomes nothing.
 */
export function unlinkUnknownRecords(text: string, allowed: (record: RecordLink) => boolean): string {
  return replaceRecordLinks(text, link =>
    allowed({ type: link.type, id: link.id }) ? text.slice(link.start, link.end) : link.labelSource,
  );
}

/** Every record a message's text parts link, once each, in the order they first link it, with the name given it. */
export function recordLinksInParts(parts: readonly ChatPart[]): DrawnRecordLink[] {
  const byKey = new Map<string, DrawnRecordLink>();
  for (const part of parts) {
    if (part.type !== 'text' || !part.text) continue;
    for (const { type, id, label } of extractRecordLinks(part.text)) {
      const key = `${type}/${id}`;
      if (!byKey.has(key)) byKey.set(key, { type, id, label });
    }
  }
  return [...byKey.values()];
}
