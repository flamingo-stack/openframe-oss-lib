/**
 * ContentRef — the unified link/embed shape stored in JSONB columns
 * across investor updates, performance baselines, and any other entity
 * that surfaces "related content" rails.
 *
 * Lifted from `lib/data/investor-update-utils-shared.ts` in the hub
 * (the server-side data utils in the same file stay hub-side; only the
 * TYPE moves here).
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
