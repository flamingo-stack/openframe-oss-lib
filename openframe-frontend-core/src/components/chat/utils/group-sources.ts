import type { ChatSource } from '../types/message.types';
import { getSourceLabel } from './source-icons';
import { DOC_TABLE_TYPES } from './source-row-cta';

/**
 * Collapse flat sources of one knowledge table into a single grouped chip
 * ("ClickUp Tasks (14 records)" with a per-row dropdown).
 *
 * WHY HERE, and not on the wire. The two transports deliver sources in two
 * shapes. The hub's own SSE chat groups entity-table rows server-side
 * (`buildSourcesMeta`) and ships them with `items`. A remote MCP tool result is
 * FLAT, one self-describing citation per document, which is what a citation
 * contract should be: `[N]` names one record, a foreign model can cite it, and
 * a turn that calls several tools yields several flat lists that only the
 * client ever sees merged (`mergeSourceMetadata`). Grouping is presentation, so
 * it happens where the chips are drawn, and both transports end up with the
 * same strip.
 *
 * THE RULE is the hub's own, stated with what the client can see:
 *   - rows group by `sourceRepo` (the knowledge-table id);
 *   - doc-table rows (`DOC_TABLE_TYPES`) never group: each is a whole document
 *     with its own viewer, and the hub keeps one chip per document too;
 *   - a source that already carries `items` was grouped upstream and passes
 *     through untouched;
 *   - a row needs `id` + `documentType` to become a dropdown item (Open and Ask
 *     both resolve from them), otherwise it stays its own chip;
 *   - a lone record stays its own chip under its own title. "Webinars
 *     (1 record)" hides the one name the reader wants.
 *
 * Each item keeps the citation number it was given, so `[3]` in the answer
 * still resolves to a row inside the group. The group takes its first member's
 * position and `index` (unique, since members are disjoint), which keeps the
 * strip in the order it was handed: reading order for cited sources.
 */
export function groupSourcesByTable(sources: ChatSource[]): ChatSource[] {
  const membersByTable = new Map<string, GroupableSource[]>();
  for (const source of sources) {
    if (!isGroupable(source)) continue;
    const members = membersByTable.get(source.sourceRepo) ?? [];
    members.push(source);
    membersByTable.set(source.sourceRepo, members);
  }

  const emitted = new Set<string>();
  const grouped: ChatSource[] = [];
  for (const source of sources) {
    const members = isGroupable(source) ? membersByTable.get(source.sourceRepo) : undefined;
    if (!isGroupable(source) || !members || members.length < 2) {
      grouped.push(source);
      continue;
    }
    if (emitted.has(source.sourceRepo)) continue;
    emitted.add(source.sourceRepo);

    grouped.push({
      index: source.index,
      name: `${getSourceLabel(source.sourceRepo)} (${members.length} records)`,
      path: source.path,
      documentType: source.documentType,
      ...(source.externalUrl ? { externalUrl: source.externalUrl } : {}),
      ...(source.targetPlatform !== undefined ? { targetPlatform: source.targetPlatform } : {}),
      sourceRepo: source.sourceRepo,
      items: members.map(member => ({
        index: member.index,
        id: member.id,
        documentType: member.documentType,
        name: member.name,
        ...(member.externalUrl ? { externalUrl: member.externalUrl } : {}),
        ...(member.targetPlatform !== undefined ? { targetPlatform: member.targetPlatform } : {}),
        path: member.path || null,
      })),
    });
  }
  return grouped;
}

type GroupableSource = ChatSource & { sourceRepo: string; id: string };

function isGroupable(source: ChatSource): source is GroupableSource {
  if (source.items && source.items.length > 0) return false;
  if (!source.sourceRepo || !source.id || !source.documentType) return false;
  return !(DOC_TABLE_TYPES as readonly string[]).includes(source.documentType);
}

/**
 * The citation numbers a chip answers to, as compact text: `1-3, 7`.
 *
 * A grouped chip stands for several `[N]` markers, so it shows all of them.
 * Consecutive numbers fold into a range, which keeps a 25-row group readable.
 */
export function formatCitationIndices(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let start = 0; start < sorted.length; ) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    runs.push(end === start ? `${sorted[start]}` : `${sorted[start]}-${sorted[end]}`);
    start = end + 1;
  }
  return runs.join(', ');
}
