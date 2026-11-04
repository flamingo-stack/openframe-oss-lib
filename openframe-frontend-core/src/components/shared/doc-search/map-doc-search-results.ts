/**
 * Map RAG `/api/docs/search` wire results into the `<DocSearchBar>`
 * dropdown's row shape, collapsing entity-table rows into grouped
 * results so the dropdown lists ONE "Cap Table (12 records)" row
 * instead of 12 individual rows.
 *
 * Pure transform — no telemetry, no navigation, no React deps. Lifted
 * from the hub's `hooks/use-docs.ts:mapDocSearchResults` (the hub's
 * `traceCompose` call was hub-only telemetry and is intentionally
 * dropped — callers that want logging can wrap this helper).
 */

import { parseRecordHref } from '../../../chat-protocol/record-link';
import { recordCountLabel } from '../../../utils/source-grouping';
import { defaultTableIdForDocumentType, getSourceLabel } from '../../../utils/source-icons';
import type { SearchResult } from '../../ui/search-input';
import type { DocSearchResult } from './types';

/** Source tables that should be collapsed into grouped results in the search bar.
 *  A SEARCH rule, deliberately narrower than the chat strip's `groupsByTable`:
 *  a search result is a destination, so only rows that share one are folded.
 *  Only financial tables (all rows link to the same admin page).
 *  Content tables (blog, webinar, podcast, etc.) stay individual since each has a unique URL. */
const SEARCH_GROUP_TABLES = new Set([
  'financial-cap-table',
  'financial-kpis',
  'financial-pnl',
  'financial-balance-sheet',
  'financial-cash-flow',
]);

/** A row's table, from its record URI. */
function tableIdOf(doc: DocSearchResult): string | null {
  const record = parseRecordHref(doc.sourceId);
  return record ? defaultTableIdForDocumentType(record.type) : null;
}

export function mapDocSearchResults(docs: DocSearchResult[]): SearchResult[] {
  const entityGroups = new Map<string, DocSearchResult[]>();
  // Track insertion order: groups appear where the FIRST row of that table appeared in the response.
  const order: Array<{ type: 'entity'; table: string } | { type: 'doc'; doc: DocSearchResult }> = [];

  for (const doc of docs) {
    const table = tableIdOf(doc);
    if (table && SEARCH_GROUP_TABLES.has(table)) {
      const group = entityGroups.get(table);
      if (group) {
        group.push(doc);
      } else {
        entityGroups.set(table, [doc]);
        order.push({ type: 'entity', table });
      }
    } else {
      order.push({ type: 'doc', doc });
    }
  }

  const results: SearchResult[] = [];
  for (const entry of order) {
    if (entry.type === 'entity') {
      // An 'entity' entry is only pushed AFTER its group lands in the map, so
      // a miss is unreachable, but dropping one group beats throwing away the
      // whole search dropdown if that ever stops holding.
      const rows = entityGroups.get(entry.table);
      if (!rows || rows.length === 0) continue;
      results.push({
        id: `group-${entry.table}`,
        // Same table label and count as the chat's grouped chip: one owner each.
        title: `${getSourceLabel(entry.table)} ${recordCountLabel(rows.length)}`,
        type: 'file',
        metadata: {
          ...(rows[0].url ? { url: rows[0].url } : {}),
          ...(rows[0].sourceId ? { sourceId: rows[0].sourceId } : {}),
          isGroup: true,
        },
      });
    } else {
      const { doc } = entry;
      const record = parseRecordHref(doc.sourceId);
      const isNonMarkdown = !!record && record.type !== 'markdown';
      // A doc is keyed by its tree path, which is what its row shows under the title.
      const path = record?.type === 'markdown' ? record.id : undefined;
      results.push({
        id: doc.sourceId ?? path ?? doc.title,
        title: doc.title,
        description: isNonMarkdown ? doc.title : doc.snippet,
        ...(path ? { path } : {}),
        type: doc.type,
        metadata: {
          matchType: doc.matchType,
          ...(doc.url ? { url: doc.url } : {}),
          ...(doc.sourceId ? { sourceId: doc.sourceId } : {}),
        },
      });
    }
  }

  return results;
}
