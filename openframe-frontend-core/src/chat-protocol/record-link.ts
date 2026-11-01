/**
 * A chat answer names a record with an ordinary markdown link whose href is the record's address:
 *
 *     The [Mac onboarding guide](record://onboarding_guide/mac-guide) walks you through it.
 *
 * The link text is the name the reader sees, so nothing is typed twice. The chat draws the link as a chip (the
 * record's icon and that name) inside the sentence, and every record the answer links also gets its full card under
 * the answer. A server that knows which records a turn loaded checks each link before it reaches the reader and turns
 * one it never offered into plain text (`unlinkUnknownRecords`).
 *
 * It replaced two private tokens a model typed into its text, one for a card and one for a chip. Those were not
 * markdown, so markdown broke them (a code span, a link, emphasis), and they carried no name. Stored messages were
 * rewritten to record links, and nothing reads the old tokens.
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
 * a `)` can never end the markdown link early. Every server that offers a record to a model hands it this exact href.
 */
export function recordHref(type: string, id: string): string {
  return `${RECORD_LINK_SCHEME}${type}/${encodeURIComponent(id)}`;
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

/**
 * A record link as markdown: `[label](record://type/id)`. The label is escaped so a bracket in a name cannot end the
 * link early; an empty label falls back to the id. What a composer writes for a picked record and a server for a
 * record it names.
 */
export function recordLinkMarkdown(record: RecordLink, label: string): string {
  const text = label.trim() || record.id;
  return `[${text.replace(/([\\[\]])/g, '\\$1')}](${recordHref(record.type, record.id)})`;
}

/** The key of a record, as the servers' lists of offered records hold it. */
export function recordKey(record: RecordLink): string {
  return `${record.type}:${record.id}`;
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
