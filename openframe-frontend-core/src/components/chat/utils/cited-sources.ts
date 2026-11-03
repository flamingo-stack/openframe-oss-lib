import { type ChatPart, type ChatSourcePart, isSourcePart } from '../../../chat-protocol/chat-message';
import { citationNumbers } from '../../../chat-protocol/citations';
import { parseCollectionHref, parseRecordHref, recordHref } from '../../../chat-protocol/record-link';
import { platformOfUrl } from '../../../platform-domains';
import { canonicalContentRefType } from '../../../utils/list-url';
import { groupSourcesByTable, type SourceGroup, type SourceRow } from '../../../utils/source-grouping';
import { defaultTableIdForDocumentType } from '../../../utils/source-icons';
import { recordLinksInParts } from '../record-links-in';
import type { SourceRowInput } from './source-row-cta';

/** How many retrieved sources to show when the answer cited none of them. */
export const FALLBACK_TOP_RETRIEVED = 3;

export interface CitedSources {
  /** The chips of the sources the answer cited or linked, in the order the reader meets them. */
  cited: SourceGroup[];
  /** The chips of everything retrieved but not referenced, in the order supplied. */
  uncited: SourceGroup[];
}

/** A source's identity across spellings: its record URI in the canonical vocabulary, or its id as given. */
function sourceKey(sourceId: string): string {
  const record = parseRecordHref(sourceId);
  return record ? recordHref(canonicalContentRefType(record.type), record.id) : sourceId;
}

/** A video is drawn by its card and a collection is no record: neither is ever a row of the strip. */
function isDrawnAsRow(sourceId: string): boolean {
  return parseCollectionHref(sourceId) === null && parseRecordHref(sourceId)?.type !== 'video';
}

/**
 * Split an answer's sources into the ones it referenced and the ones it did not.
 *
 * Reading order, not list order: the strip is a legend for the sentences above it. Cited = the citations' sources in
 * reading order, then the records the text links, then the records its cards show, each once: an answer cites what its
 * cards show, and a card has no number or link of its own to say so. A cited collection (`record://blog_post`, a citation
 * on a table's header) marks its type's records cited only when no record of that type is individually cited, linked or
 * carded, each answering to the collection's number.
 *
 * Each half is then grouped by table: AFTER the split, because a table whose rows were only partly cited is honestly two
 * chips, the cited rows under "Sources" and the rest behind the expander.
 */
export function splitCitedSources(parts: readonly ChatPart[]): CitedSources {
  const rows = new Map<string, ChatSourcePart>();
  for (const part of parts) {
    if (!isSourcePart(part) || !isDrawnAsRow(part.sourceId)) continue;
    const key = sourceKey(part.sourceId);
    if (!rows.has(key)) rows.set(key, part);
  }
  if (rows.size === 0) return { cited: [], uncited: [] };

  const numbers = citationNumbers(parts);
  const linked = recordLinksInParts(parts).map(record => recordHref(canonicalContentRefType(record.type), record.id));
  const carded = parts.flatMap(part => (part.type === 'data-record-cards' ? part.data.records.map(sourceKey) : []));

  // The types a record was individually referenced for, which a cited collection of that type then leaves alone.
  const individually = new Set<string>();
  for (const uri of [...numbers.keys(), ...linked, ...carded]) {
    const record = parseRecordHref(uri);
    if (record && rows.has(sourceKey(uri))) individually.add(canonicalContentRefType(record.type));
  }

  const cited = new Map<string, SourceRow>();
  const cite = (key: string, number: number | undefined) => {
    const row = rows.get(key);
    if (row && !cited.has(key)) cited.set(key, number === undefined ? row : { ...row, number });
  };
  for (const [uri, number] of numbers) {
    const collection = parseCollectionHref(uri);
    if (!collection) {
      cite(sourceKey(uri), number);
      continue;
    }
    const type = canonicalContentRefType(collection.type);
    if (individually.has(type)) continue;
    for (const key of rows.keys()) {
      const record = parseRecordHref(key);
      if (record && canonicalContentRefType(record.type) === type) cite(key, number);
    }
  }
  for (const key of [...linked, ...carded]) cite(key, undefined);

  const uncited = [...rows].filter(([key]) => !cited.has(key)).map(([, row]) => row);
  return { cited: groupSourcesByTable([...cited.values()]), uncited: groupSourcesByTable(uncited) };
}

/** What a source part is called: its title, else its record's id. */
export function sourceTitleOf(source: ChatSourcePart): string {
  return source.title ?? parseRecordHref(source.sourceId)?.id ?? source.sourceId;
}

/** A source part, in the words the one row resolver (`resolveSourceRowCTA`) reads. */
export function sourceRowInputOf(source: ChatSourcePart): SourceRowInput {
  const record = parseRecordHref(source.sourceId);
  const url = source.type === 'source-url' ? source.url : null;
  return {
    sourceRepo: record ? defaultTableIdForDocumentType(record.type) : null,
    documentType: record?.type ?? null,
    id: record?.id ?? null,
    title: sourceTitleOf(source),
    externalUrl: url,
    targetPlatform: platformOfUrl(url),
    // TODO(CU-17tkuw61kfy): an old doc source arrives with no url and its tree path as `filename`.
    path: source.type === 'source-document' ? (source.filename ?? null) : null,
  };
}

/**
 * A grouped chip's dropdown row label. A row prints its citation number only to tell rows of different citations apart;
 * when every row was cited by the same number, the chip already shows it and each row printing it again is noise.
 */
export function groupedRowLabels(rows: readonly SourceRow[]): string[] {
  const numbers = new Set(rows.flatMap(row => (row.number === undefined ? [] : [row.number])));
  return rows.map(row => {
    const title = sourceTitleOf(row);
    return numbers.size > 1 && row.number !== undefined ? `[${row.number}] ${title}` : title;
  });
}
