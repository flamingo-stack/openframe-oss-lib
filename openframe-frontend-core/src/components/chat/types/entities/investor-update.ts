/**
 * Investor Update entity — wire shape for the chat investor-update card
 * + the `/api/investor-updates` reads.
 *
 * Lifted from `lib/data/investor-update-utils-shared.ts` in the hub.
 * The server-side data utils + visibility filters in that file stay
 * hub-side; only the TYPES + the pure `formatInvestorUpdatePeriod`
 * formatter move here.
 */

import type { ContentRef } from './content-ref';

export interface MetricEntry {
  current: number;
  previous?: number;
  change_pct?: number;
  visibility: 'public' | 'internal';
}

export interface HighlightEntry {
  title: string;
  description?: string;
  visibility: 'public' | 'internal';
}

export interface InvestorUpdateHighlights {
  key_highlights?: HighlightEntry[];
  product_milestones?: HighlightEntry[];
  community_updates?: HighlightEntry[];
  upcoming_priorities?: HighlightEntry[];
  financial_notes?: HighlightEntry[];
}

export interface InvestorUpdate {
  id: string;
  title: string;
  slug: string;
  update_number: number | null;
  period_start: string | null;
  period_end: string | null;
  platform_id: string | null;
  content: string | null;
  video_summary: string | null;
  transcript: string | null;
  srt_content?: string | null;
  main_video_url: string | null;
  highlight_video_url: string | null;
  highlight_video_thumbnail: string | null;
  main_video_thumbnail: string | null;
  video_bites: unknown[];
  featured_image: string | null;
  strategic_update: string | null;
  financials: Record<string, MetricEntry>;
  metrics_snapshot: Record<string, MetricEntry>;
  content_refs: ContentRef[];
  highlights: InvestorUpdateHighlights | null;
  section_visibility: Record<string, 'public' | 'internal'>;
  status: string;
  published_at: string | null;
  author_id: string | null;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    email?: string | null;
  };
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_image_url: string | null;
  hubspot_email_id: string | null;
  hubspot_email_url?: string | null;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Format an investor-update period as `Mar 2025 - May 2025` (or `?` for
 * a missing endpoint). Pure formatter — no DB / state access, so it
 * moves to lib alongside the types.
 */
export function formatInvestorUpdatePeriod(
  start: string | null,
  end: string | null,
  options?: { monthFormat?: 'short' | 'long' },
): string {
  if (!start && !end) return '';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      month: options?.monthFormat || 'short',
      year: 'numeric',
    });
  const s = start ? fmt(start) : '?';
  const e = end ? fmt(end) : '?';
  return `${s} - ${e}`;
}
