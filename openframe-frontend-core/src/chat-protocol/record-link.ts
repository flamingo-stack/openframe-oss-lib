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
 * markdown, so markdown broke them (a code span, a link, emphasis), and they carried no name. Only `./old-wire` still
 * reads them, for backends and rows from before the move.
 *
 * Server-safe: no React, no browser APIs. Mirrored by the Java agent (openframe-saas-tenant), and pinned by
 * `__tests__/record-link.test.ts`.
 */

export const RECORD_LINK_SCHEME = 'record://';

/** A record's type: a slug (`onboarding_guide`, `script`, `scheduledScript`). */
const RECORD_TYPE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** A record an answer links to. */
export interface RecordLink {
  type: string;
  id: string;
}

/** A record link found in a text, with the name it shows and where it sits. */
export interface RecordLinkMatch extends RecordLink {
  label: string;
  start: number;
  end: number;
}

/**
 * The href of a record: `record://<type>/<id>`, the id percent-encoded so a slug, a path (`docs/setup.md`), a space or
 * a `)` can never end the markdown link early: `encodeURIComponent`, plus `(` and `)`, which it leaves alone and a
 * markdown destination cannot hold. The Java agent's `RecordKey` encodes the same, pinned by one fixture
 * (`RECORD_URI_VECTORS`). Every server that offers a record to a model hands it this exact href.
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

/**
 * A record link in markdown SOURCE: `[label](record://type/id)`, the destination optionally in angle brackets. For a
 * server that has the raw text only (a stream filter, an MCP reply); the chat renderer reads the parsed markdown
 * instead. The label may hold escaped brackets; the destination is the href `recordHref` makes, which holds no space
 * and no parenthesis.
 */
export function createRecordLinkScanner(): RegExp {
  return /\[((?:\\.|[^\\[\]\n])*)\]\(<?(record:\/\/[^\s()<>]+)>?\)/g;
}

/** Every record link in a text, in order. */
export function extractRecordLinks(text: string): RecordLinkMatch[] {
  if (!text.includes(RECORD_LINK_SCHEME)) return [];
  const out: RecordLinkMatch[] = [];
  for (const match of text.matchAll(createRecordLinkScanner())) {
    const record = parseRecordHref(match[2]);
    if (!record) continue;
    const start = match.index ?? 0;
    out.push({ ...record, label: match[1].replace(/\\(.)/g, '$1'), start, end: start + match[0].length });
  }
  return out;
}

/**
 * The text with every record link the reader may not be shown turned into its plain label: the server's check before
 * an answer leaves it. `allowed` says whether a record was offered to the model this turn. A link with no label
 * becomes nothing.
 */
export function unlinkUnknownRecords(text: string, allowed: (record: RecordLink) => boolean): string {
  if (!text.includes(RECORD_LINK_SCHEME)) return text;
  return text.replace(createRecordLinkScanner(), (whole, label: string, href: string) => {
    const record = parseRecordHref(href);
    if (record && allowed(record)) return whole;
    return label;
  });
}
