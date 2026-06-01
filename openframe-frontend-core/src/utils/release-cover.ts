/**
 * Single source of truth for the ProductReleaseCard cover-image fallback
 * priority. Every surface that renders a `<ProductReleaseCard>` (catalog row,
 * chat-inline dispatcher, chat wrapper) computes the cover via this helper —
 * adding a new fallback source or reordering the priority is ONE edit.
 *
 * **Priority** (intentional):
 *   1. `featured_image` — editor-curated cover, always wins.
 *   2. `highlight_video_thumbnail` — AI-generated highlight reel thumb.
 *   3. `main_video_thumbnail` — full-release video thumb.
 *   4. `og_image_url` — SEO fallback.
 *   5. `null` — caller renders the entity placeholder.
 *
 * **`hasVideoCover`** fires ONLY when the active cover is a video thumb
 * (priority 2 or 3). When the editor configured a still `featured_image`, a
 * Play overlay would be misleading and is suppressed.
 *
 * Operator note: `||` (not `??`) so empty-string DB values fall through to the
 * next fallback rather than rendering `<Image src="">`.
 *
 * (Lifted from the hub so the rich `buildProductReleaseCardProps` works in the
 * lib / any embedder, not just the hub.)
 */

export interface ReleaseCoverSource {
  featured_image?: string | null
  highlight_video_thumbnail?: string | null
  main_video_thumbnail?: string | null
  og_image_url?: string | null
}

export interface ReleaseCoverResult {
  cover: string | null
  hasVideoCover: boolean
}

export function resolveReleaseCover(r: ReleaseCoverSource): ReleaseCoverResult {
  const cover =
    r.featured_image ||
    r.highlight_video_thumbnail ||
    r.main_video_thumbnail ||
    r.og_image_url ||
    null
  const hasVideoCover = !r.featured_image && !!(r.highlight_video_thumbnail || r.main_video_thumbnail)
  return { cover, hasVideoCover }
}
