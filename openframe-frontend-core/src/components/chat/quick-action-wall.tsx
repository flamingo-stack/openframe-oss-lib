'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import {
  MarqueeWall,
  MarqueeWallFades,
  type MarqueeSyncController,
  type MarqueeWallFadeEdge,
  type MarqueeWallProps,
} from '../ui/marquee-wall'
import { QuickActionChipSkeleton } from './quick-action-chip'
import type { QuickActionTheme, QuickActionThemeAccents } from './quick-action-chip'
import { QuickActionChipFromData } from './chat-quick-action-row'
import type { QuickActionChip } from './chat-quick-action-row'

// =============================================================================
// Shared wall constants
// =============================================================================

/** Skeleton label widths (ch) — realistic spread, cycled. THE wall-skeleton
 *  spread, shared with the company-hub deck's ChipWall: sized so a 24-item
 *  wall overflows typical caps at any viewport width (same fill + fade as
 *  the loaded state — zero height jump when data lands). */
export const WALL_SKELETON_LABEL_CH = [17, 24, 14, 20, 15, 25, 12, 21, 16, 19, 13, 23]

/** Deterministic index-alternating merge — the mixed "one stream" pile
 *  (deck slide 3's IT+SEC blend and its Storybook mirror). Input order
 *  stable → the blend never reshuffles across renders or consumers. */
export function interleave<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== undefined) out.push(a[i])
    if (b[i] !== undefined) out.push(b[i])
  }
  return out
}

// Brick-mode padding default: ~14 columns of chips per row (~3200px) — one
// row copy overflows any sensible container, so the loop always engages.
const DEFAULT_MIN_CHIPS_PER_ROW = 14

// =============================================================================
// Types
// =============================================================================

export interface QuickActionWallProps {
  /** The wall's chips — the shared {@link QuickActionChip} shape (same as the
   *  chat rows), including per-chip `theme`/`lozenge` for mixed IT/SEC
   *  streams. Chips with `onSelect` render as buttons; without, as tags. */
  chips: ReadonlyArray<QuickActionChip>
  /** Wall-default theme (fae/mingo/it/sec) for chips without their own. */
  theme?: QuickActionTheme
  /** Server-configured per-theme accent overrides
   *  ({@link QuickActionThemeAccents}) — inject the agents' configured colors
   *  (resolve via `accentFromIdentityIcon`); the built-in theme accents are
   *  fallback-only. Per-chip `themeAccent` still wins. */
  themeAccents?: QuickActionThemeAccents
  /** `'animated'` (default): marquee + overflow fades. `'plain'`: no motion,
   *  no blur — the consumer's per-surface opt-out (forwarded to
   *  {@link MarqueeWall}; in brick mode the rows render static and the
   *  stack-level fades are skipped). */
  mode?: 'animated' | 'plain'
  /** Render every chip's theme lozenge (classification walls). Per-chip
   *  `lozenge` values still win. */
  lozenges?: boolean
  /** Marquee axis — defaults to where `fade` sits (see {@link MarqueeWall}). */
  axis?: MarqueeWallProps['axis']
  reverse?: boolean
  /** px/s. Default 40 (MarqueeWall default). */
  speed?: number
  /** Marquee on/off (auto-off when content fits / reduced motion / loading). */
  animate?: boolean
  pauseOnHover?: boolean
  fade?: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge>
  /** Color behind the wall — the fades blend into it. */
  fadeColor?: string
  fadeSize?: MarqueeWallProps['fadeSize']
  /** THE wall pitch — one value drives the chip gap, the clone-seam gap, and
   *  (in brick mode) the row-stack gap, so the courses read as a uniform wall
   *  and the seam is invisible by construction. Default
   *  `var(--spacing-system-xsf)`. */
  copyGap?: number | string
  /** Pad the track by REPEATING the chips up to this count (suffixed keys) so
   *  one copy always overflows the container and the loop engages — without
   *  it a wall whose content roughly fits its box goes static (the marquee
   *  only loops what overflows). Defaults to `rows × 14` in brick mode;
   *  unset otherwise (capped walls that always overflow, and FLIP-tracked
   *  walls where repeats would duplicate flip ids, need no padding). */
  minChips?: number
  /**
   * BRICK-WALL mode: render this many stacked independent single-row
   * marquees (chips distributed round-robin) instead of one track. Rows pack
   * their chips edge-to-edge like bricks — a grid would column-align chips
   * of different widths and leave holes — and each row loops on its own
   * wrap, so the courses stagger organically. Horizontal only; the fades
   * draw ONCE over the whole stack.
   */
  rows?: number
  /** Draw skeleton chips instead of `chips` (the shared
   *  {@link QuickActionChipSkeleton} — 1:1 geometry with loaded chips).
   *  Callers own the policy (`loading` flag vs skeleton-when-empty). */
  loading?: boolean
  skeletonCount?: number
  /** Outer container (sizing: height cap for vertical walls). */
  className?: string
  /** Per-copy layout — default a wrapping chip wall. Override for single-row
   *  marquee strips (`flex-nowrap`). */
  contentClassName?: string
  /** Pair with sibling walls under one position driver (resolve strips). */
  sync?: MarqueeSyncController
}

// =============================================================================
// Component
// =============================================================================

/**
 * <QuickActionWall> — THE quick-action chip wall: a themed pile of the shared
 * chip on the shared {@link MarqueeWall} engine. One component for every
 * surface that shows "the work the agents do" — homepage hero tabs, deck
 * panels, marketing strips — whether static-with-fade or endlessly scrolling
 * (axis follows the fade), interactive or decorative.
 *
 * Clone-copy chips stay INTERACTIVE (pointer cursor + working click) — the
 * loop paints clones inside the viewport (reverse walls even START on the
 * clone copy), and a visible chip that ignores clicks reads as broken. A11y
 * holds via the clone wrapper: aria-hidden + focus suppression (the standard
 * Swiper/Splide loop-clone treatment, same as CardsStrip). `pauseOnHover`
 * (default on) freezes the track under a pointing cursor so chips never
 * dodge a click.
 */
export function QuickActionWall({
  chips,
  theme,
  themeAccents,
  mode = 'animated',
  lozenges = false,
  axis,
  reverse,
  speed,
  animate = true,
  pauseOnHover,
  fade,
  fadeColor,
  fadeSize,
  copyGap,
  minChips,
  rows,
  loading = false,
  skeletonCount = 24,
  className,
  contentClassName,
  sync,
}: QuickActionWallProps) {
  // Repeat-pad the track (stable suffixed keys; repeats keep the full chip —
  // identical selected/interactive state, so every visible instance behaves
  // the same and the clone copy stays geometry-identical by construction).
  const padTarget = minChips ?? (rows ? rows * DEFAULT_MIN_CHIPS_PER_ROW : undefined)
  const track = React.useMemo(() => {
    if (!padTarget || chips.length === 0 || chips.length >= padTarget) return chips
    const repeats = Math.ceil(padTarget / chips.length)
    return Array.from({ length: repeats }, (_, r) =>
      r === 0 ? chips : chips.map(chip => ({ ...chip, id: `${chip.id}__r${r}` })),
    ).flat()
  }, [chips, padTarget])

  const renderSkeletons = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => (
      <QuickActionChipSkeleton
        key={i}
        lozenge={lozenges}
        labelCh={WALL_SKELETON_LABEL_CH[(offset + i) % WALL_SKELETON_LABEL_CH.length]}
      />
    ))

  const renderChipNodes = (list: ReadonlyArray<QuickActionChip>) =>
    list.map(chip => (
      <QuickActionChipFromData
        key={chip.id}
        chip={chip}
        defaultTheme={theme}
        themeAccents={themeAccents}
        defaultLozenge={lozenges}
        interactive={!!chip.onSelect}
        className="max-w-full"
      />
    ))

  const renderChips = () => (loading ? renderSkeletons(skeletonCount) : renderChipNodes(track))

  // ONE pitch for chips, clone seams, and (brick mode) the row stack — a
  // custom `copyGap` moves all three together, so no seam can ever disagree
  // with the chip gap.
  const gap = copyGap ?? 'var(--spacing-system-xsf)'

  // ---- BRICK-WALL mode: stacked independent row marquees ---------------------
  if (rows && rows > 0) {
    const rowLists = Array.from({ length: rows }, (_, r) => track.filter((_, i) => i % rows === r))
    const skelPerRow = Math.ceil(skeletonCount / rows)
    return (
      <div className={cn('relative flex flex-col overflow-hidden', className)} style={{ gap }}>
        {rowLists.map((list, r) => (
          <MarqueeWall
            key={r}
            mode={mode}
            axis="x"
            reverse={reverse}
            speed={speed}
            animate={animate && !loading}
            pauseOnHover={pauseOnHover}
            copyGap={gap}
            contentClassName={cn('flex items-center', contentClassName)}
            contentStyle={{ gap }}
          >
            {loading ? renderSkeletons(skelPerRow, r * 3) : renderChipNodes(list)}
          </MarqueeWall>
        ))}
        {mode === 'animated' && (
          <MarqueeWallFades fade={fade} fadeColor={fadeColor} fadeSize={fadeSize} />
        )}
      </div>
    )
  }

  return (
    <MarqueeWall
      mode={mode}
      axis={axis}
      reverse={reverse}
      speed={speed}
      // Skeleton walls stay put — the marquee starts when real chips land.
      animate={animate && !loading}
      pauseOnHover={pauseOnHover}
      fade={fade}
      fadeColor={fadeColor}
      fadeSize={fadeSize}
      copyGap={gap}
      className={className}
      contentClassName={cn('flex flex-wrap content-start items-start', contentClassName)}
      contentStyle={{ gap }}
      sync={sync}
    >
      {renderChips()}
    </MarqueeWall>
  )
}
