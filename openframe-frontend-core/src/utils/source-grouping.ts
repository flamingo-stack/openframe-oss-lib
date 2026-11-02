/**
 * The sources strip's grouping: THE one owner.
 *
 * "ClickUp Tasks (14 records)" with a per-row dropdown is built in exactly one place, `groupSourcesByTable`, over flat
 * source parts (`chat-protocol/chat-message`): a message's sources are flat, one part per record, and grouping is
 * presentation, derived at render. A part's table comes from its record URI (`defaultTableIdForDocumentType`): a type
 * names its table exactly.
 *
 * Server-safe: no React, no browser APIs. The hub imports it from the `utils` barrel next to `getSourceLabel`.
 */

import type { ChatSourcePart } from '../chat-protocol/chat-message';
import { parseRecordHref } from '../chat-protocol/record-link';
import { defaultTableIdForDocumentType, getSourceLabel } from './source-icons';

/**
 * Doc-table documentTypes: whole documents with their own viewer (markdown =
 * product docs, data_room_doc = data room). They carry an in-app `path` (handed
 * to the host's composer as the slug), and a server never folds them
 * into one citation (`groupsByTable`); the strip still draws them as one chip
 * per table. The hub's per-source contract test pins this list to its
 * doc-table configs.
 */
export const DOC_TABLE_TYPES = ['markdown', 'data_room_doc'] as const;

/**
 * Which tables a SERVER gives the model as one search result: rows of a knowledge
 * table reach the model as one table unless they are whole documents, which are
 * read in full. Decided by `documentType`, the one fact every producer has.
 *
 * This is not the strip's rule. The strip (`groupSourcesByTable`) draws ONE chip
 * per table for every source, documents included.
 */
export function groupsByTable(documentType: string | null | undefined): boolean {
  return !(DOC_TABLE_TYPES as readonly string[]).includes(documentType ?? '');
}

/** `(1 record)` / `(14 records)`: the count every grouped chip states. */
export function recordCountLabel(count: number): string {
  return `(${count} ${count === 1 ? 'record' : 'records'})`;
}

/** One row of the strip: a source part, and the number it answers to when the answer cited it. */
export type SourceRow = ChatSourcePart & { number?: number };

/** One chip of the strip. */
export interface SourceGroup {
  /** The first row's URI: unique within a strip. */
  key: string;
  /** The rows' table. Null for a row whose type names none: a chip of its own, never grouped. */
  tableId: string | null;
  /** `Blog posts (37 records)`, or a table-less row's own title. */
  label: string;
  rows: SourceRow[];
}

/** A source's table, from its record URI. */
function tableIdOf(source: ChatSourcePart): string | null {
  const record = parseRecordHref(source.sourceId);
  return record ? defaultTableIdForDocumentType(record.type) : null;
}

/**
 * Flat sources in, the strip's chips out: ONE chip per table, where its table first appeared, so the strip keeps the
 * order it was handed (reading order for cited sources). A lone record is a chip of its table too, and each row keeps
 * the number it was given, so `[3]` in the answer still resolves inside the group. Only a row whose type names no table
 * stands alone. First occurrence wins per record.
 */
export function groupSourcesByTable(sources: readonly SourceRow[]): SourceGroup[] {
  const groups: SourceGroup[] = [];
  const byTable = new Map<string, SourceGroup>();
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.sourceId)) continue;
    seen.add(source.sourceId);
    const tableId = tableIdOf(source);
    const group = tableId ? byTable.get(tableId) : undefined;
    if (group) {
      group.rows.push(source);
      continue;
    }
    const label = source.title ?? parseRecordHref(source.sourceId)?.id ?? source.sourceId;
    const created: SourceGroup = { key: source.sourceId, tableId, label, rows: [source] };
    if (tableId) byTable.set(tableId, created);
    groups.push(created);
  }
  for (const group of groups) {
    if (group.tableId) group.label = `${getSourceLabel(group.tableId)} ${recordCountLabel(group.rows.length)}`;
  }
  return groups;
}

/**
 * The citation numbers a chip answers to, as compact text: `1-3, 7`.
 *
 * A chip stands for every number its rows were cited by, so it shows all of
 * them. Consecutive numbers fold into a range, which keeps a 25-row group
 * readable.
 */
export function formatCitationIndices(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    runs.push(end === start ? `${sorted[start]}` : `${sorted[start]}-${sorted[end]}`);
    start = end + 1;
  }
  return runs.join(', ');
}
