/**
 * ContentRef — the unified link/embed shape stored in JSONB columns
 * across investor updates, performance baselines, and any other entity
 * that surfaces "related content" rails.
 *
 * Lifted from `lib/data/investor-update-utils-shared.ts` in the hub
 * (the server-side data utils in the same file stay hub-side; only the
 * TYPE moves here). RELOCATED from `components/chat/types/entities/`
 * to this server-safe home when `RelatedContentSection` moved into the
 * lib — the chat path re-exports from here, so there is exactly ONE
 * `ContentRef` definition package-wide.
 */

export interface ContentRef {
  type: string;
  id: string;
  slug: string;
  url: string;
  targetPlatform?: string | null;
  title: string;
  summary?: string;
  image_url?: string;
  image_bg_color?: string;
  visibility: 'public' | 'internal';
  display_order: number;
}

/**
 * A ContentRef as returned by the suggestion service (`/api/related-content`)
 * — carries the 5-tier engine's placement reason. Widened to `string` here
 * (the narrow reason union is hub-server vocabulary); data-only, never
 * rendered by the rail.
 */
export type ContentRefWithReason = ContentRef & { reason: string };
