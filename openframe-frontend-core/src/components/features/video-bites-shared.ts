/**
 * video-bites-shared — SERVER-SAFE leaf for the video-bites surface.
 *
 * No React imports, no 'use client'. Published as its own subpath
 * (`@flamingo-stack/openframe-frontend-core/components/features/video-bites-shared`)
 * so server-side consumers (the hub's featured-video-bites DAL) can import the
 * title constant, profile adapter, and sort comparator WITHOUT pulling the
 * 'use client' strip/MuxPlayer module graph into a server bundle — same
 * pattern (and reason) as `mux-origins.ts`.
 *
 * Client components (`<VideoBitesStrip>`, the features barrel) re-export from
 * here; there must never be a second definition of any of these.
 */

import type { VideoTeaser } from '../../types/video-processing';

/** Single exported home for the unified public bites-section title. */
export const DEFAULT_VIDEO_BITES_TITLE = 'Key Moments';

/**
 * Profile rendered in the strip's hover overlay. Structurally identical to
 * `UserDisplayProps` — the overlay renders it via `<UserDisplay>` 1:1.
 */
export interface VideoBiteStripProfile {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
}

/**
 * Adapter SSoT: builds a strip profile from the repo-wide author/user shape
 * (`profiles` rows and hydrated authors all expose full_name / avatar_url /
 * job_title). ALL strip call sites and the featured DAL's mapProfile route
 * through this — never hand-roll the mapping.
 *
 * Returns NULL (never `{name: ''}`) when `full_name` is null/empty: callers
 * rely on `profile ?? fallback` chains, and some producers (e.g. the release
 * kit) pass null-field author stubs.
 */
export function toStripProfile(
  p?: { full_name?: string | null; avatar_url?: string | null; job_title?: string | null } | null,
  fallbackSubtitle?: string | null,
): VideoBiteStripProfile | null {
  if (!p?.full_name) return null;
  return {
    name: p.full_name,
    avatarUrl: p.avatar_url ?? null,
    subtitle: p.job_title ?? fallbackSubtitle ?? null,
  };
}

/**
 * Null-safe created_at-desc COMPARATOR (missing dates sort last).
 * Call as `[...arr].sort(sortBitesByCreatedAtDesc)` — shared by the strip,
 * the hub admin editor, and the hub featured DAL.
 */
export function sortBitesByCreatedAtDesc(a: VideoTeaser, b: VideoTeaser): number {
  if (!a.created_at && !b.created_at) return 0;
  if (!a.created_at) return 1;
  if (!b.created_at) return -1;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * FEATURED-recency comparator: `featured_at` DESC — the stamp every featured
 * bite carries (written by the admin star toggle; pre-existing featured bites
 * were backfilled 2026-08-19, so there is no date-fallback ranking). The
 * comparator FEATURED surfaces (the cross-entity aggregation + its strips)
 * must use — ranking those surfaces by `created_at` made featuring any older
 * bite a silent no-op once the surface cap filled with newer bites. A missing
 * stamp (only possible from a stale mid-deploy writer) sorts last.
 */
export function sortBitesByFeaturedAtDesc(a: VideoTeaser, b: VideoTeaser): number {
  if (!a.featured_at && !b.featured_at) return 0;
  if (!a.featured_at) return 1;
  if (!b.featured_at) return -1;
  return new Date(b.featured_at).getTime() - new Date(a.featured_at).getTime();
}
