/**
 * Grouped source chips: THE one owner, for every producer.
 *
 * "ClickUp Tasks (14 records)" with a per-row dropdown is built in exactly one
 * place, `buildGroupedSource`, and WHICH rows group is decided in exactly one
 * place, `groupsByTable`. Three producers call them:
 *
 *   1. the hub's web chat (`buildSourcesMeta`), server-side, over the rows it
 *      retrieved;
 *   2. the hub's side-channel chips (my-tickets / my-tasks), server-side, over
 *      rows a strategy injected;
 *   3. this chat's strip, client-side, over the FLAT sources a remote MCP tool
 *      returns (`groupSourcesByTable`).
 *
 * Why the third one is client-side: an MCP tool result is one self-describing
 * citation per record, which is what a citation contract should be, and a turn
 * that calls several tools yields several flat lists only the client ever sees
 * merged. Grouping is presentation. It is the SAME presentation everywhere
 * because it is the same two functions everywhere.
 *
 * Server-safe: no React, no browser APIs. The hub imports it from the `utils`
 * barrel next to `getSourceLabel`.
 */

import type { ChatSource } from '../components/chat/types/message.types';
import { getSourceLabel } from './source-icons';

/**
 * Doc-table documentTypes: whole documents with their own viewer (markdown =
 * product docs, data_room_doc = data room). They carry an in-app `path`, an
 * embedder keys `docPlatformTargets` by them, and they NEVER group: one chip
 * per document. The hub's per-source contract test pins this list to its
 * doc-table configs.
 */
export const DOC_TABLE_TYPES = ['markdown', 'data_room_doc'] as const;

/** THE rule: rows of a knowledge table share one chip unless they are whole
 *  documents. Decided by `documentType`, the one fact every producer has. */
export function groupsByTable(documentType: string | null | undefined): boolean {
  return !(DOC_TABLE_TYPES as readonly string[]).includes(documentType ?? '');
}

/** `(1 record)` / `(14 records)`: the count every grouped chip states. */
export function recordCountLabel(count: number): string {
  return `(${count} ${count === 1 ? 'record' : 'records'})`;
}

type GroupedItem = NonNullable<ChatSource['items']>[number];

/** One row of a group. `index` is set only when the row was cited on its own
 *  (a flat MCP source); a server-grouped row shares the group's number. */
export type GroupedSourceRow = GroupedItem;

/**
 * THE grouped-chip constructor. Order-preserving: a producer that wants its
 * dropdown by date sorts `rows` first.
 *
 * `items` is ALWAYS populated, rows without a public URL included: per-row
 * `id` + `documentType` is what gives every dropdown row its Ask action, and a
 * chip with `items` never navigates to `path`, which for an entity table is
 * mapper bookkeeping and not a route.
 */
export function buildGroupedSource(spec: {
  /** The chip's citation number (and React key). */
  index: number;
  sourceRepo: string;
  rows: GroupedSourceRow[];
  /** Chip-level link, when it is not the first row's own. */
  externalUrl?: string;
  targetPlatform?: string | null;
}): ChatSource {
  const first = spec.rows[0];
  const externalUrl = spec.externalUrl ?? first?.externalUrl;
  const targetPlatform = spec.targetPlatform !== undefined ? spec.targetPlatform : first?.targetPlatform;
  return {
    index: spec.index,
    name: `${getSourceLabel(spec.sourceRepo)} ${recordCountLabel(spec.rows.length)}`,
    path: first?.path ?? '',
    documentType: first?.documentType ?? '',
    ...(externalUrl ? { externalUrl } : {}),
    targetPlatform: targetPlatform ?? null,
    sourceRepo: spec.sourceRepo,
    items: spec.rows,
  };
}

type TableSource = ChatSource & { sourceRepo: string };

/** A chip the server already grouped (it carries `items`). */
function isGroupedChip(source: ChatSource): boolean {
  return !!source.items && source.items.length > 0;
}

/** A source that belongs to its table's chip: it names its table and is not a
 *  whole document. Both shapes qualify, a flat row AND a chip the server
 *  already grouped, so one table is never drawn twice. A flat row with no `id`
 *  still joins (as the hub's server-side chips do), as an Open-only dropdown
 *  row: leaving it out would split one table across a group AND a stray chip. */
function joinsTableChip(source: ChatSource): source is TableSource {
  if (!source.sourceRepo || !source.documentType) return false;
  return groupsByTable(source.documentType);
}

/** A source's dropdown rows: a grouped chip's own items, or the flat row itself. */
function rowsOf(source: TableSource): GroupedSourceRow[] {
  if (isGroupedChip(source)) return source.items ?? [];
  return [
    {
      index: source.index,
      id: source.id ?? '',
      documentType: source.documentType,
      name: source.name,
      ...(source.externalUrl ? { externalUrl: source.externalUrl } : {}),
      targetPlatform: source.targetPlatform ?? null,
      path: source.path || null,
    },
  ];
}

/** First occurrence wins per record, so a record that arrived both inside a
 *  server chip and as a flat row is one dropdown row. Id-less rows cannot be
 *  told apart and are all kept. */
function uniqueRows(rows: GroupedSourceRow[]): GroupedSourceRow[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row.id) return true;
    const identity = `${row.documentType}:${row.id}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

/**
 * Flat sources in, the strip's chips out: ONE chip per table.
 *
 * Every row that names its table joins that table's chip, a lone record and an
 * id-less row included, exactly as the hub's web chat draws it. Each flat row
 * keeps the citation number it was given, so `[3]` in the answer still
 * resolves inside the group. The chip sits where its table first appeared and
 * takes that source's `index` (unique, members are disjoint), so the strip
 * keeps the order it was handed: reading order for cited sources.
 *
 * A chip the server already grouped passes through UNTOUCHED when it is its
 * table's only source. When flat rows of the same table arrive beside it (a
 * hub-injected chip plus MCP-cited rows in one answer), they merge into it:
 * its rows first, its chip-level link kept, the count restated. Whole
 * documents and rows naming no table pass through as their own chips.
 */
export function groupSourcesByTable(sources: ChatSource[]): ChatSource[] {
  const membersByTable = new Map<string, TableSource[]>();
  for (const source of sources) {
    if (!joinsTableChip(source)) continue;
    const members = membersByTable.get(source.sourceRepo) ?? [];
    members.push(source);
    membersByTable.set(source.sourceRepo, members);
  }

  const emitted = new Set<string>();
  const chips: ChatSource[] = [];
  for (const source of sources) {
    if (!joinsTableChip(source)) {
      chips.push(source);
      continue;
    }
    if (emitted.has(source.sourceRepo)) continue;
    emitted.add(source.sourceRepo);

    const members = membersByTable.get(source.sourceRepo) ?? [];
    if (members.length === 1 && isGroupedChip(source)) {
      chips.push(source);
      continue;
    }
    // A server chip may carry a chip-level link that is not its first row's.
    const serverChip = members.find(isGroupedChip);
    chips.push(
      buildGroupedSource({
        index: source.index,
        sourceRepo: source.sourceRepo,
        rows: uniqueRows(members.flatMap(rowsOf)),
        ...(serverChip?.externalUrl ? { externalUrl: serverChip.externalUrl } : {}),
        ...(serverChip && serverChip.targetPlatform !== undefined ? { targetPlatform: serverChip.targetPlatform } : {}),
      }),
    );
  }
  return chips;
}

/**
 * The citation numbers a chip answers to, as compact text: `1-3, 7`.
 *
 * A chip grouped from flat sources stands for several `[N]` markers, so it
 * shows all of them. Consecutive numbers fold into a range, which keeps a
 * 25-row group readable.
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
