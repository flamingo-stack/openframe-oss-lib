import { citedSourceNumbers } from '../../../chat-protocol/citation-chip';
import type { RecordLink } from '../../../chat-protocol/record-link';
import { canonicalContentRefType } from '../../../utils/list-url';
import { groupSourcesByTable } from '../../../utils/source-grouping';
import { recordLinksIn } from '../record-links-in';
import type { ChatSource } from '../types/message.types';

/** How many retrieved sources to show when the answer cited none of them. */
export const FALLBACK_TOP_RETRIEVED = 3;

export interface CitedSources {
  /** Sources the answer referenced, in the order the answer first referenced
   *  them — NOT in `index` order. */
  cited: ChatSource[];
  /** Everything retrieved but not referenced, in the order supplied. */
  uncited: ChatSource[];
}

/** Fenced blocks and inline code spans. */
const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g;

/**
 * Blank out code before looking for citations.
 *
 * `$items[1]`, `argv[1]`, `matrix[0][1]` — array indexing is not a citation,
 * and this assistant answers with scripts constantly. Left in, a snippet marks
 * a source as cited that the prose never mentions, and worse, seeds the reading
 * order from a position inside a code block.
 *
 * Replaced with spaces rather than removed so nothing outside the block shifts
 * — only whether a marker is inside one is being decided here.
 */
function withoutCode(content: string): string {
  return content.replace(CODE, block => ' '.repeat(block.length));
}

/**
 * Split an answer's sources into the ones it cited and the ones it did not.
 *
 * Reading order, not numeric order: the strip is a legend for the sentences
 * above it, so the chip for the citation the reader meets first comes first,
 * even when the model numbered it `[3]`. A number cited twice is placed once,
 * at its first mention.
 *
 * Each half is then grouped by knowledge table (`groupSourcesByTable`): AFTER
 * the split, because cited-ness belongs to a citation number, and a table whose
 * rows were only partly cited is honestly two chips, the cited rows under
 * "Sources" and the rest behind the expander.
 *
 * `content` is the flat answer text. A segmented message has to be flattened by
 * the caller — citation markers live in text segments, and this function
 * deliberately does not know what a segment is.
 */
export function splitCitedSources(sources: ChatSource[] | undefined, content: string): CitedSources {
  if (!sources || sources.length === 0) return { cited: [], uncited: [] };

  // An answer that links records cites the records it links: those are what it names, and their cards are under it.
  // An answer whose links name no retrieved record (a record from an earlier turn) falls back to its numbers.
  const byLinks = splitByRecords(sources, recordLinksIn(content));
  if (byLinks.cited.length > 0) return byLinks;

  const firstMentionAt = new Map(citedSourceNumbers(withoutCode(content)).map((index, order) => [index, order]));

  const cited = sources
    .filter(source => firstMentionAt.has(source.index))
    .sort((a, b) => (firstMentionAt.get(a.index) ?? 0) - (firstMentionAt.get(b.index) ?? 0));
  const uncited = sources.filter(source => !firstMentionAt.has(source.index));
  return { cited: groupSourcesByTable(cited), uncited: groupSourcesByTable(uncited) };
}

/** One record of a source, as a flat source: a flat source itself, or one row of a grouped source (keeping its own
 *  citation number when it has one, else the group's). */
function recordsOf(source: ChatSource): ChatSource[] {
  if (!source.items || source.items.length === 0) return [source];
  return source.items.map(item => ({
    index: item.index ?? source.index,
    id: item.id,
    name: item.name,
    path: item.path ?? '',
    documentType: item.documentType,
    ...(item.externalUrl ? { externalUrl: item.externalUrl } : {}),
    targetPlatform: item.targetPlatform ?? null,
    ...(source.sourceRepo ? { sourceRepo: source.sourceRepo } : {}),
  }));
}

/** The key of a record, in the canonical vocabulary record links use. A document is keyed by its id, or
 *  by its path when it carries no id (doc rows are keyed by path). */
function recordKey(record: ChatSource): string | null {
  const id = record.id || record.path;
  return record.documentType && id ? `${canonicalContentRefType(record.documentType)}:${id}` : null;
}

/** Cited = the records the answer links, in link order; uncited = every other record. Both halves are then grouped
 *  by table, so a table's chip counts exactly its linked records. */
function splitByRecords(sources: ChatSource[], links: RecordLink[]): CitedSources {
  const records = sources.flatMap(recordsOf);
  const byKey = new Map<string, ChatSource>();
  for (const record of records) {
    const key = recordKey(record);
    if (key && !byKey.has(key)) byKey.set(key, record);
  }
  const cited: ChatSource[] = [];
  for (const link of links) {
    const record = byKey.get(`${canonicalContentRefType(link.type)}:${link.id}`);
    if (record && !cited.includes(record)) cited.push(record);
  }
  const uncited = records.filter(record => !cited.includes(record));
  return { cited: groupSourcesByTable(cited), uncited: groupSourcesByTable(uncited) };
}

/**
 * A grouped chip's dropdown row label. A row prints its citation number only to tell rows of different citations
 * apart (a client-built group of several numbers); when every row was cited by the same number, the chip already
 * shows it and each row printing it again is noise.
 */
export function groupedRowLabels(items: ReadonlyArray<{ name: string; index?: number }>): string[] {
  const numbers = new Set(items.flatMap(item => (item.index === undefined ? [] : [item.index])));
  return items.map(item => (numbers.size > 1 && item.index !== undefined ? `[${item.index}] ${item.name}` : item.name));
}
