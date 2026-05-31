/**
 * Lib-side default `buildProductReleaseCardProps` for the chat dispatch.
 *
 * The compact (`size='sm'`) branch of `<ProductReleaseCard>` only reads
 * `coverImage`, `hasVideoCover`, and `formattedDate` — the rest of the
 * derived prop bundle is catalog-page (`size='lg'`) metadata. This
 * default builder satisfies the three sm-relevant fields with row data
 * the list-API already returns, so embedders that don't supply
 * `opts.extras.buildProductReleaseCardProps` still get a rendered card
 * instead of a bare text chip. Hub-side embedders pass their richer
 * builder via `extras` to get the lg-only fields (changelogCounts,
 * badge color, view count, etc.).
 */

import { formatReleaseDate } from '../../../utils/date-formatters'

interface ReleaseLike {
  release_date?: string | null
  featured_image?: string | null
  og_image_url?: string | null
  main_video_thumbnail?: string | null
  highlight_video_thumbnail?: string | null
  main_video_url?: string | null
  youtube_url?: string | null
}

interface DerivedSmProps {
  coverImage: string | null
  hasVideoCover: boolean
  formattedDate: string
}

/** Pick the first usable image URL from the row's cover-candidate fields.
 *  This is an INTENTIONALLY SIMPLER sm-subset heuristic — it does NOT mirror the
 *  hub's `resolveReleaseCover`: when a video URL is set this prefers
 *  `main_video_thumbnail` (then `highlight_video_thumbnail`) over `featured_image`,
 *  and keys `hasVideoCover` off `main_video_url`/`youtube_url` (fields the hub
 *  helper never reads). It's the builder-less default (chat sm cards + any embedder
 *  that doesn't pass its own `buildCardProps` to `ProductReleasesView`); hosts
 *  wanting hub-identical covers pass their richer builder (the hub does — see
 *  the hub's `product-release-card-props.ts` / `resolveReleaseCover`). */
function pickCover(item: ReleaseLike): string | null {
  const hasVideo = Boolean(item.main_video_url || item.youtube_url)
  if (hasVideo) {
    if (item.main_video_thumbnail) return item.main_video_thumbnail
    if (item.highlight_video_thumbnail) return item.highlight_video_thumbnail
  }
  return item.featured_image ?? item.og_image_url ?? null
}

export function defaultBuildProductReleaseCardProps(item: unknown): DerivedSmProps {
  const row = (item ?? {}) as ReleaseLike
  return {
    coverImage: pickCover(row),
    hasVideoCover: Boolean(row.main_video_url || row.youtube_url),
    // `formatReleaseDate` is TZ-safe (splits the `YYYY-MM-DD` head before
    // constructing the Date). Using `new Date(input).toLocaleDateString`
    // here would shift the date by one day west of UTC for date-only
    // inputs — the hub's own `buildProductReleaseCardProps` already uses
    // this helper, so the chat-default + hub builder agree.
    formattedDate: row.release_date ? formatReleaseDate(row.release_date) : '',
  }
}
