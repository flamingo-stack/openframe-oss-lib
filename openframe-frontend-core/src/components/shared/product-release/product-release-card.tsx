'use client'

import React from 'react'
import Image from '../../../embed-shims/next-image'
import { InteractiveCard } from '../../ui/interactive-card'
import { StatusBadge } from '../../ui/status-badge'
import { SquareAvatar } from '../../ui/square-avatar'
import {
  AlertTriangle,
  Eye,
  Package,
  Play,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { cn } from '../../../utils/cn'

/**
 * Card density. Two variants, both actively used across openframe + flamingo
 * apps and the related-content rail:
 *
 * - `lg`: rich large card used everywhere a product release is the focal
 *   item — openframe's `/releases` catalog row, flamingo's DevCenter tab,
 *   investor-update related-content section. Three zones — hero (16:9 cover
 *   + version pill + title + summary), changelog stats strip (icons +
 *   counts), metadata grid footer (Type · Status · Released · Author). The
 *   grid mirrors the hub's `<EntityAuthorCard>` byte-for-byte (see lg
 *   branch comment).
 *
 * - `sm`: compact horizontal layout (~80px tall) for inline rendering inside
 *   chat messages and other tight surfaces. Drops `<h3>` (block-only,
 *   illegal inside markdown `<p>`) for `<span>` text, swaps the outer
 *   `InteractiveCard` for a `<span>`-anchored link, and collapses to:
 *   56px icon + 1-line title + 1-line meta (version · date).
 *
 * A previous `default` variant (vertical title+description / version+date
 * column) was deleted in the 2026-05 DRY pass — it had a single consumer
 * (the hub's RelatedContentSection) that has since moved to `lg`.
 */
export type ProductReleaseCardSize = 'lg' | 'sm'

/**
 * Minimal structural `<a>` prop bundle the consumer composes (typically
 * via the hub's `useNavLink` hook — single source of truth for click
 * routing). Kept structural here so the OSS lib has zero hub coupling;
 * the consumer's `NavLinkProps` is type-compatible by shape.
 *
 * When supplied, the outer element renders as `<a {...anchorProps}>` so
 * the SAME routing decision (modifier-click → browser default, cross-
 * origin → new tab, same-origin → `router.push`) runs identically to
 * every other entity card. When absent, the legacy `onClick` branch is
 * used (back-compat for the public `/releases` page).
 */
export interface ProductReleaseCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface ProductReleaseCardProps {
  /** Release title */
  title: string
  /** Release summary/description */
  summary?: string | null
  /** Version string (e.g., "1.2.0") */
  version: string
  /** Formatted date string for display */
  formattedDate: string
  /**
   * Legacy click handler — kept for back-compat with public-page callers
   * (e.g. `/releases` tab) that route via `router.push()` directly. When
   * `anchorProps` is also supplied, `anchorProps` wins and this is
   * ignored.
   */
  onClick?: () => void
  /**
   * `<a>` prop bundle from the consumer's `useNavLink` (or equivalent).
   * When provided, the card's outer element renders as a real anchor so
   * routing (cross-origin → new tab, same-origin → soft RSC nav,
   * modifier-click → browser default) is owned by the hook — the card
   * writes NO click logic of its own. This is the path every other
   * entity card uses; `onClick` is only kept for the one legacy caller.
   */
  anchorProps?: ProductReleaseCardAnchorProps
  /** Additional CSS classes */
  className?: string
  /** Card density. Defaults to `'lg'` (the canonical large card). */
  size?: ProductReleaseCardSize

  // ─── Catalog-only props (ignored by `default` / `sm` branches) ─────────
  /** Cover image URL. Falls back to a neutral `Package`-icon placeholder. */
  coverImage?: string | null
  /** Drives the Play overlay on the cover. Caller sets `true` when the cover
   *  came from a `*_video_thumbnail` field. */
  hasVideoCover?: boolean
  /** Release type for the metadata grid's first cell. */
  releaseType?: 'major' | 'minor' | 'patch' | 'beta' | 'alpha'
  /** Release status for the metadata grid's second cell. */
  releaseStatus?: 'alpha' | 'beta' | 'stable' | 'deprecated'
  /** Pre-computed `StatusBadge` colorScheme for the release-type chip. The
   *  hub consumer maps `release_type → colorScheme` via its local helper so
   *  the OSS card stays mapping-agnostic. */
  releaseTypeBadgeColor?: 'error' | 'cyan' | 'success' | 'warning'
  /** View count for the optional microline below the metadata grid. Hidden
   *  when zero or undefined. */
  viewCount?: number
  /** Hydrated author (from the hub DAL's `hydrateAuthor`). When present,
   *  renders as the last cell of the metadata grid. */
  author?: {
    full_name: string
    avatar_url: string | null
    job_title: string | null
  }
  /** Per-category counts for the changelog stats strip. The whole strip
   *  is hidden when total === 0. */
  changelogCounts?: {
    features: number
    fixes: number
    improvements: number
    breaking: number
  }
}

export function ProductReleaseCard({
  title,
  summary,
  version,
  formattedDate,
  onClick,
  anchorProps,
  className,
  size = 'lg',
  coverImage,
  hasVideoCover,
  releaseType,
  releaseStatus,
  releaseTypeBadgeColor,
  viewCount,
  author,
  changelogCounts,
}: ProductReleaseCardProps) {
  // ----- LG branch (rich /releases catalog row + related-content rail) -----
  // The card has THREE zones:
  //   1. Hero — cover image LEFT, version pill + title + summary RIGHT.
  //   2. Changelog strip — icons + counts (hidden when total === 0).
  //   3. Metadata grid footer — bordered grid of [Type | Status | Released
  //      | Author] cells. This grid INLINES the hub's <EntityAuthorCard>
  //      visual treatment by hand (SAME bordered grid with value-cell +
  //      author-cell shapes, byte-for-byte). The OSS lib has zero hub
  //      coupling by design; we cannot import the hub's
  //      <EntityAuthorCard>. This is the SAME inline-duplication policy
  //      documented for the COMPACT_CARD_* string set in the chat-card
  //      file. If the hub's <EntityAuthorCard> visual changes (cell
  //      padding, divider styles, avatar size, etc.), update this branch
  //      in lockstep.
  if (size === 'lg') {
    const totalChangelog =
      (changelogCounts?.features ?? 0) +
      (changelogCounts?.fixes ?? 0) +
      (changelogCounts?.improvements ?? 0) +
      (changelogCounts?.breaking ?? 0)

    // Build the metadata-grid cell array — mirrors the hub's
    // EntityAuthorCard composition. ALWAYS render all 3 value cells
    // (Type / Status / Released) — missing values render as a plain
    // em-dash + label so the grid keeps a fixed 4-cell shape (matching
    // the skeleton). The Author cell is also always rendered below
    // (effectiveAuthor falls back to a placeholder shape). This is
    // load-to-resolve baseline parity: any conditional cell would
    // introduce a reflow when the skeleton resolves.
    //
    // Plan note: em-dash placeholders read as plain text (NOT a colored
    // StatusBadge for the Type cell) so empty badges don't look broken
    // next to populated badges.
    type ValueCell = {
      value: string
      label: string
      uppercase: boolean
      colorScheme?: 'error' | 'cyan' | 'success' | 'warning'
    }
    const valueCells: ValueCell[] = [
      releaseType && releaseTypeBadgeColor
        ? {
            value: releaseType.toUpperCase(),
            label: 'Type',
            uppercase: true,
            colorScheme: releaseTypeBadgeColor,
          }
        : { value: '—', label: 'Type', uppercase: false },
      releaseStatus
        ? {
            value: releaseStatus.toUpperCase(),
            label: 'Status',
            uppercase: true,
          }
        : { value: '—', label: 'Status', uppercase: false },
      formattedDate
        ? {
            value: formattedDate,
            label: 'Released',
            uppercase: false,
          }
        : { value: '—', label: 'Released', uppercase: false },
    ]
    // EMPTY_AUTHOR_PLACEHOLDER shape — mirrors the hub's
    // EMPTY_AUTHOR_PLACEHOLDER constant exported from
    // components/shared/entity-author-card.tsx (hub can't be imported
    // here; the two are kept in lockstep per the inline-duplication
    // policy documented in the catalog branch comment above).
    const effectiveAuthor = author?.full_name
      ? author
      : { full_name: '—', avatar_url: null, job_title: 'Unknown' }
    // Fixed 4-cell grid (Type / Status / Released / Author) so the
    // skeleton's shape matches the loaded card exactly. The earlier
    // dynamic `gridColsClass` ternary collapsed missing cells and
    // caused 28-56px reflow on resolve.
    const gridColsClass = 'md:grid-cols-4'
    const dividerClass = 'border-b md:border-b-0 md:border-r border-ods-border'

    const frameClass = cn(
      'group bg-ods-card border border-ods-border rounded-lg overflow-hidden',
      'flex flex-col p-6 gap-4',
      'transition-all duration-300 ease-out transform hover:translate-y-[-2px]',
      'hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-bg',
      'no-underline',
      className,
    )

    const innerLayout = (
      <>
        {/* HERO ZONE — cover LEFT + version pill + title + summary RIGHT */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-[256px] flex-shrink-0">
            <div className="relative rounded-lg overflow-hidden w-full aspect-[1200/630] bg-ods-bg">
              {coverImage ? (
                <Image
                  src={coverImage}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 256px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-ods-text-secondary">
                  <Package className="w-8 h-8" />
                </div>
              )}
              {hasVideoCover && coverImage && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="w-10 h-10 text-ods-text-on-dark" fill="white" />
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono font-semibold text-lg text-ods-text-primary truncate">
                v{version}
              </span>
            </div>
            {/* Title — reserve a fixed 2-line height so cards with
                1-line titles don't shrink and the catalog skeleton-to-
                content transition is shift-free. Mirrors the
                onboarding-guide catalog card. */}
            <div className="min-h-[60px] md:min-h-[72px] flex items-start mb-3">
              <h3 className="font-['Azeret_Mono'] font-semibold text-xl md:text-2xl text-ods-text-primary leading-tight line-clamp-2">
                {title}
              </h3>
            </div>
            {/* Summary — fixed 3-line height. `line-clamp-3` caps long
                summaries at 3 lines; `min-h` reserves the same vertical
                space when content is shorter, so the catalog grid stays
                row-consistent regardless of per-card content length.
                Heights derived from text-sm md:text-base × leading-relaxed
                (1.625): 14×1.625×3 ≈ 68 px mobile, 16×1.625×3 ≈ 78 px desktop. */}
            <div className="min-h-[68px] md:min-h-[78px]">
              <p className="font-['DM_Sans'] text-sm md:text-base text-ods-text-secondary leading-relaxed line-clamp-3">
                {summary ?? ''}
              </p>
            </div>
          </div>
        </div>

        {/* CHANGELOG STRIP — ALWAYS rendered so the skeleton's
            always-on changelog placeholder matches the loaded shape
            (zero reflow on resolve). When `totalChangelog === 0`, an
            empty-state line takes the same vertical space as the
            populated row. */}
        <div className="border-t border-ods-border pt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-h6 text-ods-text-secondary">
          {totalChangelog > 0 && changelogCounts ? (
            <>
              {changelogCounts.features > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {changelogCounts.features} {changelogCounts.features === 1 ? 'feature' : 'features'}
                </span>
              )}
              {changelogCounts.fixes > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  {changelogCounts.fixes} {changelogCounts.fixes === 1 ? 'fix' : 'fixes'}
                </span>
              )}
              {changelogCounts.improvements > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {changelogCounts.improvements} {changelogCounts.improvements === 1 ? 'improvement' : 'improvements'}
                </span>
              )}
              {changelogCounts.breaking > 0 && (
                <span className="inline-flex items-center gap-1.5 text-ods-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {changelogCounts.breaking} breaking
                </span>
              )}
            </>
          ) : (
            <span className="text-ods-text-secondary">No changelog entries yet</span>
          )}
        </div>

        {/* METADATA GRID FOOTER — fixed 4-cell shape (Type / Status /
            Released / Author) so the skeleton mirrors the loaded card
            exactly. Empty value cells render em-dash + label (plain
            text, no colored badge — em-dash badges read as broken next
            to populated ones); the Author cell falls back to the
            EMPTY_AUTHOR_PLACEHOLDER shape declared above. */}
        <div
          className={cn(
            'grid grid-cols-1',
            gridColsClass,
            'border border-ods-border rounded-md overflow-hidden w-full',
          )}
        >
          {valueCells.map((cell, i) => (
            <div
              key={`${cell.label}-${i}`}
              className={cn('bg-ods-card p-4 flex flex-col gap-3', dividerClass)}
            >
              <div className="flex flex-col gap-0">
                {cell.colorScheme ? (
                  <StatusBadge
                    text={cell.value}
                    variant="card"
                    colorScheme={cell.colorScheme}
                    singleLine
                    className="self-start"
                  />
                ) : (
                  <p
                    className={cn(
                      'text-h4',
                      // Em-dash placeholder reads as secondary text;
                      // populated values stay primary.
                      cell.value === '—' ? 'text-ods-text-secondary' : 'text-ods-text-primary',
                    )}
                  >
                    {cell.uppercase ? cell.value.toLocaleUpperCase() : cell.value}
                  </p>
                )}
                <p className="text-h6 text-ods-text-secondary">
                  {cell.label}
                </p>
              </div>
            </div>
          ))}
          <div className="bg-ods-card p-4 flex items-center gap-3">
            <SquareAvatar
              src={effectiveAuthor.avatar_url ?? undefined}
              alt={effectiveAuthor.full_name}
              fallback={effectiveAuthor.full_name.charAt(0).toUpperCase()}
              size="md"
              variant="round"
            />
            <div className="flex flex-col gap-0 flex-1 min-w-0">
              <p className="text-h3 tracking-[-0.36px] text-ods-text-primary truncate">
                {effectiveAuthor.full_name}
              </p>
              <p className="text-h6 text-ods-text-secondary">
                {effectiveAuthor.job_title || 'Author'}
              </p>
            </div>
          </div>
        </div>

        {typeof viewCount === 'number' && viewCount > 0 && (
          <div className="flex items-center gap-1.5 text-h6 text-ods-text-secondary">
            <Eye className="w-3.5 h-3.5" />
            <span>{viewCount.toLocaleString()} views</span>
          </div>
        )}
      </>
    )

    // Outer-element three-branch decision tree, matching the existing
    // `default` branch precedence at lines ~200-241. PRECEDENCE:
    // anchorProps WINS over onClick.
    if (anchorProps) {
      return (
        <a {...anchorProps} className={frameClass} aria-label={`Open ${title}`}>
          {innerLayout}
        </a>
      )
    }
    if (onClick) {
      return (
        <InteractiveCard clickable onClick={onClick} className={frameClass}>
          {innerLayout}
        </InteractiveCard>
      )
    }
    // Non-interactive fallback — strip the hover lift / accent-border so
    // the cursor doesn't lie about clickability.
    return (
      <div
        className={cn(
          frameClass
            .replace('hover:border-ods-accent', '')
            .replace('hover:translate-y-[-2px]', ''),
        )}
      >
        {innerLayout}
      </div>
    )
  }

  // ----- COMPACT branch (chat / tight surfaces) ------------------------------
  // Outer must be a phrasing-content element (`<a>` or `<span>`) — block
  // elements like `<div>`/`<h3>` are illegal inside markdown `<p>`, so we
  // cannot reuse `InteractiveCard` (a `<div>`).
  //
  // - When `anchorProps` is set, render as a real `<a>` so the consumer's
  //   click hook (`useNavLink`) owns routing identically to every other
  //   entity card — cross-origin → new tab, same-origin → soft RSC nav.
  // - Else fall back to legacy `<span role="button">` behavior driven by
  //   `onClick` (kept for the public `/releases` page caller).
  // - When neither is set, render a static non-interactive span.
  //
  // Inner layout mirrors BlogCard/CaseStudyCard compact: 56px square slot +
  // primary text + 1-line meta + optional summary clamp.
  if (size === 'sm') {
    const handleKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!onClick) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    }
    const isInteractive = !!anchorProps || !!onClick
    const outerClassName = cn(
      // The base frame (`my-1.5 flex … no-underline`) mirrors the
      // hub's `COMPACT_CARD_OUTER` in `components/shared/compact-
      // card/compact-card-classes.ts` byte-for-byte. The OSS lib
      // can't import from the consumer, so the two strings are
      // kept identical by hand — if you edit one, edit the other.
      //
      // The interactive branch ADDS `cursor-pointer` + a focus-
      // visible ring. The `<a>` form would normally get focus styling
      // from the browser, but `no-underline` strips the default
      // affordance, so explicit ring styles match the `<span role>` form.
      'my-1.5 flex items-start gap-3 w-full p-2',
      'rounded-lg border border-ods-border bg-ods-card no-underline',
      isInteractive
        ? 'transition-colors hover:border-ods-text-secondary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ods-card'
        : 'cursor-default',
      className,
    )
    const innerChildren = (
      <>
        {/* 56×56 cover slot. Mirrors BlogCard / ProgramCard / OnboardingGuide
            sm slots — when `coverImage` is set, render the actual image
            (object-contain to keep landscape thumbs visible); fall back to
            the `Package` icon when no cover is provided. Play overlay
            fires only when `hasVideoCover` is true AND a cover image was
            actually supplied (matches the catalog variant's overlay rule). */}
        <span className="relative flex h-14 w-14 aspect-square shrink-0 self-start items-center justify-center overflow-hidden rounded-md bg-ods-bg text-ods-accent">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={title}
              fill
              sizes="56px"
              className="object-contain"
              unoptimized
            />
          ) : (
            <Package className="h-5 w-5" />
          )}
          {hasVideoCover && coverImage && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-4 w-4 text-ods-text-on-dark" fill="white" />
            </span>
          )}
        </span>
        {/* Text column structure must mirror the hub's
            `COMPACT_CARD_TEXT_COL` + `COMPACT_CARD_TITLE_ROW` +
            `COMPACT_CARD_META_ROW_BOX` byte-for-byte. The OSS lib can't
            import from the consumer, so the strings are duplicated by
            hand — if you edit them in the hub's compact-card-classes.ts,
            edit them here too. Per-row heights are fixed (h-5 / h-4 / h-4)
            so a skeleton placeholder occupies the SAME pixel position
            as the loaded text — zero load-to-resolve baseline shift. */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 min-h-14">
          <span className="flex items-center gap-2 min-w-0 h-5">
            <span className="truncate text-sm font-semibold leading-5 text-ods-text-primary min-w-0" title={title}>
              {title}
            </span>
            {version ? (
              <span className="shrink-0 rounded bg-ods-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ods-accent">
                {version}
              </span>
            ) : null}
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="truncate text-[11px] leading-4 text-ods-text-secondary">
              {formattedDate || 'Product release'}
            </span>
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="truncate text-[11px] leading-4 text-ods-text-secondary/80" title={summary || undefined}>
              {/* The literal between the curly-quote string is U+00A0
                  (NBSP). The hub's `COMPACT_CARD_ROW_FILLER` is also
                  NBSP; ASCII space here would let React collapse the
                  child to zero content, breaking baseline parity with
                  the skeleton. Keep these in lockstep. */}
              {summary || ' '}
            </span>
          </span>
        </span>
      </>
    )
    // Anchor variant — consumer's `useNavLink` (or equivalent) owns the
    // click decision; the card just spreads the prop bundle and renders
    // a real `<a>` so cmd/ctrl-click new-tab + middle-click work without
    // any extra JS. This is the SAME pattern BlogCard / CaseStudyCard /
    // ProgramCard / etc. use across the consumer codebase.
    if (anchorProps) {
      return (
        <a {...anchorProps} className={outerClassName}>
          {innerChildren}
        </a>
      )
    }
    // Legacy fallback — `onClick` (no href). Keeps the public `/releases`
    // page's existing `router.push(...)` flow working unchanged. When
    // neither `anchorProps` nor `onClick` is set, renders a static
    // non-interactive span.
    return (
      <span
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKey : undefined}
        className={outerClassName}
      >
        {innerChildren}
      </span>
    )
  }

  // Unreachable — `size` is typed `'lg' | 'sm'` and both branches return
  // above. Kept as a defensive throw so a future variant addition that
  // forgets to return doesn't silently render `undefined`.
  throw new Error(`ProductReleaseCard: unsupported size '${size as string}'`)
}
