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
import {
  QuickActionChipSkeleton,
  QuickActionChipFromData,
  type QuickActionThemeSpec,
  type QuickActionChip,
} from './quick-action-chip'

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

// Brick-mode padding fallback: ~14 columns of chips per row — one row copy
// overflows any sensible container, so the loop always engages. Used as the
// row-count reference, and as the pad target until the container and chip
// widths have been measured (then the per-row target adapts — see chipWidth).
const DEFAULT_MIN_CHIPS_PER_ROW = 14

// The adaptive pad target is derived from the MEASURED narrowest chip, not a
// guessed width: repeats = ceil(containerWidth / measuredChipWidth) + margin.
// Measuring (rather than assuming ~72px) is what makes it correct for a tiny
// one-word chip AND a wide multi-word one — a guess that overshoots the real
// chip under-pads and the row silently stops scrolling.
const ADAPTIVE_PAD_MARGIN = 2
// Divide-by-near-zero guard ONLY: floors a glitched sub-pixel measurement, but
// stays BELOW the narrowest real chip (padding alone is wider), so a genuinely
// tiny one-glyph chip keeps its true measured width and still gets enough
// repeats to overflow. MAX_ADAPTIVE_PAD bounds the count if the measurement is
// ever degenerate.
const MIN_MEASURED_CHIP_PX = 12
// Sanity bounds on the resulting count.
const MIN_ADAPTIVE_PAD = 4
const MAX_ADAPTIVE_PAD = 60

// Chat-agent walls (fae/mingo) cap the brick stack at 2 rows so the quick
// actions never crowd the composer; every other surface keeps the caller's
// `rows` as its cap.
const AGENT_MAX_ROWS = 2

// =============================================================================
// Types
// =============================================================================

export interface QuickActionWallProps {
  /** The wall's chips — the shared {@link QuickActionChip} shape (same as the
   *  chat rows), including per-chip `theme`/`lozenge` for mixed IT/SEC
   *  streams. Chips with `onSelect` render as buttons; without, as tags. */
  chips: ReadonlyArray<QuickActionChip>
  /** Wall-default {@link QuickActionThemeSpec} for chips without their own.
   *  Caller-supplied — the lib ships no theme registry; resolve agent colors
   *  server-side (e.g. `accentFromIdentityIcon`) and pass the spec here. */
  theme?: QuickActionThemeSpec
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
  /** Opt-in manual drag + wheel scroll (forwarded to {@link MarqueeWall}) — the
   *  auto-marquee pauses while the user drags/wheels and resumes from there.
   *  Enabled on the embeddable-chat quick-action walls. */
  dragScroll?: boolean
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
   * BRICK-WALL mode: the MAXIMUM number of stacked single-row marquees. The
   * actual row count grows with the chip supply — `ceil(chips / 14)` capped at
   * `rows` — so a short action set fills one row (padded with its own repeats)
   * instead of spreading one chip per row. The originals are split evenly
   * ACROSS the active rows first, THEN each row pads to a full course, so no
   * row is ever all-duplicates while another holds the unique chips. Rows pack
   * edge-to-edge like bricks (a grid would column-align mismatched widths and
   * leave holes) and each loops on its own wrap. Horizontal only; the fades
   * draw ONCE over the whole stack.
   */
  rows?: number
  /**
   * Chat agent this wall belongs to (`'fae'` / `'mingo'`). When set to a
   * built-in agent it caps the brick stack at {@link AGENT_MAX_ROWS} (2) so the
   * actions stay compact above the composer; any other value (or unset) leaves
   * the cap at `rows`. Optional — decorative/marketing walls omit it.
   */
  agentSlug?: string
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
  mode = 'animated',
  lozenges = false,
  axis,
  reverse,
  speed,
  animate = true,
  pauseOnHover,
  dragScroll = false,
  fade,
  fadeColor,
  fadeSize,
  copyGap,
  minChips,
  rows,
  agentSlug,
  loading = false,
  skeletonCount = 24,
  className,
  contentClassName,
  sync,
}: QuickActionWallProps) {
  // Adapt the per-row pad target to the actual geometry (brick mode only): a
  // narrow chat composer needs only a handful of repeats to overflow, a wide
  // wall needs many, and a tiny chip needs more repeats than a wide one. We
  // measure BOTH the container width and the narrowest rendered chip, then pad
  // to ceil(width / chip) + margin. Pre-measure / SSR falls back to the fixed
  // default, which overflows any width.
  const brickRef = React.useRef<HTMLDivElement>(null)
  const [brickWidth, setBrickWidth] = React.useState(0)
  const [chipWidth, setChipWidth] = React.useState(0)
  React.useEffect(() => {
    const el = brickRef.current
    if (!el) return
    // Read both widths straight off the laid-out DOM (offsetWidth is synchronous
    // and reliable — a ResizeObserver initial callback can be throttled or never
    // fire in a backgrounded/offscreen tab, which would strand the target on its
    // fallback). Chips render as buttons on interactive walls — the only case
    // that pads short sets; decorative walls keep the fallback. Converges in one
    // pass: the widths don't depend on how many repeats we then draw.
    const measure = () => {
      const w = el.offsetWidth
      if (w > 0) setBrickWidth(prev => (prev === w ? prev : w))
      const chips = [...el.querySelectorAll('button')].map(b => (b as HTMLElement).offsetWidth).filter(x => x > 0)
      if (chips.length > 0) {
        const min = Math.max(Math.min(...chips), MIN_MEASURED_CHIP_PX)
        setChipWidth(prev => (prev === min ? prev : min))
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [chips])

  // Repeat-pad the track (stable suffixed keys; repeats keep the full chip —
  // identical selected/interactive state, so every visible instance behaves
  // the same and the clone copy stays geometry-identical by construction).
  // Brick mode does its own per-row padding below, so this pads only the
  // single-track (wrap / vertical) walls.
  const padTarget = rows ? undefined : minChips
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
    // Chat-agent walls (fae/mingo) grow the stack with the chip supply and cap
    // it at AGENT_MAX_ROWS (2) so the actions stay compact above the composer.
    // Every other surface keeps exactly `rows` rows (marketing/onboarding walls
    // are sized for their design and carry far fewer than a full course/row).
    const agentCapped = agentSlug === 'fae' || agentSlug === 'mingo'
    const rowCap = agentCapped ? Math.min(rows, AGENT_MAX_ROWS) : rows
    const dataRows = agentCapped
      ? Math.min(Math.max(1, Math.ceil(chips.length / DEFAULT_MIN_CHIPS_PER_ROW)), rowCap)
      : rows
    // Skeletons hold the cap so the row count never jumps when real chips land.
    const stackRows = loading ? rowCap : dataRows
    // Per-row overflow target — how many chips one copy must hold to overflow
    // the container (so the marquee loop engages). Priority: an explicit
    // `minChips` budget wins; otherwise adapt to the MEASURED width (just enough
    // repeats to overflow — no more, so a narrow composer isn't flooded with
    // duplicates); before the first measure (or SSR) fall back to the fixed
    // default, which overflows any width.
    const adaptivePerRow =
      brickWidth > 0 && chipWidth > 0
        ? Math.min(
            Math.max(Math.ceil(brickWidth / chipWidth) + ADAPTIVE_PAD_MARGIN, MIN_ADAPTIVE_PAD),
            MAX_ADAPTIVE_PAD,
          )
        : DEFAULT_MIN_CHIPS_PER_ROW
    const perRowTarget = minChips ? Math.ceil(minChips / stackRows) : adaptivePerRow

    // Split the ORIGINAL chips evenly across the rows FIRST (each row holds
    // distinct actions), THEN pad each row to a full course with repeats of its
    // OWN chips — so a row is never all-duplicates while another carries the
    // unique ones (the old pad-then-slice split did exactly that when the chip
    // count lined up with the row count).
    const rowLists = Array.from({ length: stackRows }, (_, r) => {
      const base = chips.filter((_, i) => i % stackRows === r)
      if (base.length === 0 || base.length >= perRowTarget) return base
      const repeats = Math.ceil(perRowTarget / base.length)
      return Array.from({ length: repeats }, (_, rep) =>
        rep === 0 ? base : base.map(chip => ({ ...chip, id: `${chip.id}__r${rep}` })),
      ).flat()
    })
    const skelPerRow = Math.ceil(skeletonCount / stackRows)
    return (
      <div ref={brickRef} className={cn('relative flex flex-col overflow-hidden', className)} style={{ gap }}>
        {rowLists.map((list, r) => (
          <MarqueeWall
            key={r}
            mode={mode}
            axis="x"
            reverse={reverse}
            speed={speed}
            animate={animate && !loading}
            pauseOnHover={pauseOnHover}
            dragScroll={dragScroll}
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
      dragScroll={dragScroll}
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
