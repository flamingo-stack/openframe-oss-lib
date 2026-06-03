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
import { resolveReleaseCover } from '../../../utils/release-cover'
import {
  releaseTypeToBadgeColor,
  type ReleaseType,
  type ReleaseTypeBadgeColor,
} from '../../../utils/release-badge'

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

// ───────────────────────────────────────────────────────────────────────────
// RICH (lg-variant) builder — the DEFAULT for <ProductReleasesView>.
// ───────────────────────────────────────────────────────────────────────────

/** Minimal shape the RICH builder reads. List-API rows from `/api/releases`
 *  carry all of these; `release_type` is widened to `string` to absorb legacy
 *  non-enum values (the badge helper returns `undefined` for unknowns, which
 *  the card guards correctly with an em-dash placeholder). */
interface RichReleaseLike {
  release_date?: string | null
  release_type?: string | null
  release_status?: 'alpha' | 'beta' | 'stable' | 'deprecated' | null
  view_count?: number | null
  author?: { full_name: string; avatar_url: string | null; job_title: string | null } | null
  features_added?: unknown[] | null
  bugs_fixed?: unknown[] | null
  improvements?: unknown[] | null
  breaking_changes?: unknown[] | null
  featured_image?: string | null
  highlight_video_thumbnail?: string | null
  main_video_thumbnail?: string | null
  og_image_url?: string | null
}

export interface ProductReleaseCardDerivedProps {
  coverImage: string | null
  hasVideoCover: boolean
  formattedDate: string
  releaseType: ReleaseType | undefined
  releaseStatus: 'alpha' | 'beta' | 'stable' | 'deprecated' | undefined
  releaseTypeBadgeColor: ReleaseTypeBadgeColor | undefined
  viewCount: number
  author: { full_name: string; avatar_url: string | null; job_title: string | null } | undefined
  changelogCounts: { features: number; fixes: number; improvements: number; breaking: number }
}

const RELEASE_TYPE_ENUM: ReadonlySet<ReleaseType> = new Set(['major', 'minor', 'patch', 'beta', 'alpha'])

/**
 * The RICH `lg`-variant builder — populates the full metadata grid (Type /
 * Status / author / view count / changelog counts) the `lg` `ProductReleaseCard`
 * renders. This is the DEFAULT `buildCardProps` for `<ProductReleasesView>`, so
 * embedders get the full card config-only. (Lifted from the hub; before this,
 * the example fell back to the sm builder and the lg Type/Status/author cells
 * rendered as em-dash placeholders.) The sm chat card keeps
 * `defaultBuildProductReleaseCardProps` — it ignores the lg-only fields.
 */
export function buildProductReleaseCardProps(item: unknown): ProductReleaseCardDerivedProps {
  const release = (item ?? {}) as RichReleaseLike
  const { cover, hasVideoCover } = resolveReleaseCover(release)
  const rawType = release.release_type
  const releaseType: ReleaseType | undefined =
    rawType && RELEASE_TYPE_ENUM.has(rawType as ReleaseType) ? (rawType as ReleaseType) : undefined
  return {
    coverImage: cover,
    hasVideoCover,
    formattedDate: release.release_date ? formatReleaseDate(release.release_date) : '',
    releaseType,
    releaseStatus: release.release_status ?? undefined,
    releaseTypeBadgeColor: releaseTypeToBadgeColor(releaseType),
    viewCount: release.view_count ?? 0,
    author: release.author
      ? {
          full_name: release.author.full_name,
          avatar_url: release.author.avatar_url,
          job_title: release.author.job_title,
        }
      : undefined,
    changelogCounts: {
      features: release.features_added?.length ?? 0,
      fixes: release.bugs_fixed?.length ?? 0,
      improvements: release.improvements?.length ?? 0,
      breaking: release.breaking_changes?.length ?? 0,
    },
  }
}
