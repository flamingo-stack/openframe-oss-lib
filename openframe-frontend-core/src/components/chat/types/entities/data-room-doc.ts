/**
 * Data Room Doc entity — wire shape for the chat data-room-doc card.
 *
 * Lifted from `components/shared/data-room/data-room-doc-card.tsx`.
 * Covers both `data_room_documents` rows and `openframe-docs` markdown
 * rows — the card differentiates via `sourceRepo` and routes the click
 * via the shared `resolveSourceRowCTA` helper.
 */

export interface DataRoomDocCardItem {
  /** Data-room doc UUID (the `external_id` / `id` from data_room_documents) */
  id: string;
  /** Display title — the doc's `name` */
  title: string;
  /** Path within the data room — e.g. `legal/fundraising/seed/executed/vertex-vii-3.5m-safe` */
  path?: string | null;
  /** Optional content preview (up to ~200 chars) */
  preview?: string | null;
  /** Resolved URL (typically `/data-room/<path>`) — null when not resolvable */
  url?: string | null;
  /** RagTableConfig.id (e.g. `'openframe-docs'`, `'data-room-docs'`) — drives
   *  the badge label via `SOURCE_LABELS_BY_TABLE`. Falls back to "Data room"
   *  when missing. */
  sourceRepo?: string | null;
}
