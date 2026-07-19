'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { useMarqueeEngine } from '../../hooks/ui/use-marquee-engine'
import { useMediaQuery } from '../../hooks/ui/use-media-query'
import { useSuppressCloneFocus } from '../../hooks/ui/use-suppress-clone-focus'
import { NEAR_VIEWPORT_ROOT_MARGIN } from '../../hooks/use-near-viewport'

// =============================================================================
// Types
// =============================================================================

export type MarqueeWallFadeEdge = 'top' | 'bottom' | 'left' | 'right'

/** One spelling of the `fade` prop's edge-list normalization. */
function normalizeFades(
  fade: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge> | undefined,
): ReadonlyArray<MarqueeWallFadeEdge> {
  return fade ? (Array.isArray(fade) ? fade : [fade as MarqueeWallFadeEdge]) : []
}

/** @internal per-instance sync membership (transform writer + driver-role
 *  promotion callback, so a surviving member can be re-elected). */
interface MarqueeSyncMember {
  apply: (pos: number) => void
  makeDriver: () => void
}

/**
 * Pairs two (or more) <MarqueeWall> instances to ONE position driver so their
 * tracks stay pixel-locked (the FreeTrialCTA resolve strips: a pending and a
 * resolved copy of the same chips, clip-path'd at the avatar line). The first
 * mounted instance claims the driver role and runs the shared rAF; the others
 * only register their `apply` transforms. If the driver unmounts while
 * members survive, the next member is promoted — the pair must merely be
 * geometry-identical while mounted together.
 */
export interface MarqueeSyncController {
  /** @internal registered members in mount order. */
  members: Set<MarqueeSyncMember>
  /** @internal current driver member. */
  driver: MarqueeSyncMember | null
  /** @internal last driver-written position — a promoted driver's engine
   *  seeds from it, so re-election never snaps the pair back to 0. */
  position: number
}

export function useMarqueeSync(): MarqueeSyncController {
  return React.useRef<MarqueeSyncController>({ members: new Set(), driver: null, position: 0 }).current
}

// =============================================================================
// FLIP coordination — live track offsets + loop-clone helpers
// =============================================================================

export interface MarqueeTrackOffset {
  /** Applied translation (px) along each axis. */
  x: number
  y: number
  /** Loop wrap size (single copy + seam gap) along each axis; 0 on the
   *  non-scroll axis. Lets morph engines treat a chip and its loop clone as
   *  ONE identity `wrap` apart (the Swiper loop-clone model) and fly the
   *  copy the viewer actually sees. */
  wrapX: number
  wrapY: number
}

/**
 * Registry of each named wall's CURRENT applied translation, written every
 * engine frame and deliberately kept after unmount: a FLIP-across-remounts
 * morph (deck `useFlipMorph`) captures element positions at COMMIT time, so
 * chips inside a drifting marquee would fly from stale origins. With a
 * `trackId` the wall stamps `data-marquee-track` on its container and
 * publishes its offset here; the morph engine corrects captured points by
 * the wall's drift since capture (including drift accrued right up to the
 * source wall's unmount — hence the survive-unmount map).
 */
const MARQUEE_TRACK_OFFSETS = new Map<string, MarqueeTrackOffset>()

const ZERO_OFFSET: MarqueeTrackOffset = { x: 0, y: 0, wrapX: 0, wrapY: 0 }

/** Last known translation + wrap of the wall registered under `trackId`
 *  (live or already unmounted). Zeros for unknown ids / static walls. */
export function getMarqueeTrackOffset(trackId: string): MarqueeTrackOffset {
  return MARQUEE_TRACK_OFFSETS.get(trackId) ?? ZERO_OFFSET
}

/**
 * The translation ACTUALLY applied to a wall's track right now, read from the
 * DOM of the `data-marquee-track` container. Morph engines use this on the
 * CAPTURE side (never the registry): a same-id wall freshly remounted in the
 * current commit has not applied any transform yet, while the registry still
 * holds its predecessor's final drift for the flight-side lookup.
 */
export function getMarqueeAppliedOffset(trackContainer: Element): { x: number; y: number } {
  const track = trackContainer.firstElementChild
  const t = track ? getComputedStyle(track).transform : 'none'
  if (!t || t === 'none') return { x: 0, y: 0 }
  const m = new DOMMatrixReadOnly(t)
  return { x: m.e, y: m.f }
}

/**
 * The loop-clone twin of an element inside a wall's PRIMARY copy (same index
 * in the `data-marquee-copy="clone"` copy), or null when there is no clone /
 * the element isn't in the primary copy. Owns the wall's internal DOM shape
 * so morph engines don't hardcode it; `selector` scopes which descendants
 * count as items (default: direct structure-preserving lookup by class is the
 * caller's job — pass the item selector, e.g. `'.flipchip'`).
 */
export function getMarqueeCloneTwin(
  trackContainer: Element,
  el: Element,
  selector: string,
): HTMLElement | null {
  const primary = trackContainer.querySelector('[data-marquee-copy="primary"]')
  const clone = trackContainer.querySelector('[data-marquee-copy="clone"]')
  if (!primary || !clone || !primary.contains(el)) return null
  const idx = Array.prototype.indexOf.call(primary.querySelectorAll(selector), el)
  if (idx < 0) return null
  return (clone.querySelectorAll(selector)[idx] as HTMLElement | undefined) ?? null
}

export interface MarqueeWallProps {
  /**
   * Presentation mode — the consumer's one switch for "do I want the
   * blur + marquee here at all":
   * - `'animated'` (default): endless marquee when content overflows, with
   *   the overflow fades.
   * - `'plain'`: no motion, no fades — a plain clipped wall. All marquee
   *   machinery (engine, clone copy, fades) is skipped entirely.
   */
  mode?: 'animated' | 'plain'
  /**
   * Marquee axis. Defaults to where the fade sits — the animation's job is to
   * reveal what the fade hides: a `bottom`/`top` fade clips rows → vertical
   * (content travels bottom→top); a `left`/`right`-only fade clips columns →
   * horizontal (content travels right→left). No fade → horizontal.
   */
  axis?: 'x' | 'y'
  /** Reverse travel: `x` reversed moves content right, `y` reversed moves it
   *  down. Default false (left / up). */
  reverse?: boolean
  /** Scroll speed in px/s (the CardsStrip unit — one speed language across
   *  every marquee). Default 40: calm chip-wall drift, slower than the 60 the
   *  card strips cruise at. */
  speed?: number
  /** Master switch. Even when true the marquee auto-disables while the content
   *  fits the container and under `prefers-reduced-motion` (static wall). */
  animate?: boolean
  /** Freeze while a hover-capable pointer is anywhere over the wall — content
   *  must never move under a pointing cursor (required for interactive chip
   *  walls). Default true. */
  pauseOnHover?: boolean
  /** Opt-in MANUAL scroll: pointer-drag + horizontal wheel move the wall along
   *  its axis (transform-based — no inner scroller is created, so it stays
   *  deck-safe). The auto-marquee pauses during the interaction and briefly
   *  after, then resumes drifting from wherever the user left it. Off by
   *  default (decorative walls stay auto-only); enabled on the embeddable-chat
   *  quick-action walls so users can browse the actions by hand. */
  dragScroll?: boolean
  /** Edge fade(s) — the "there's more" affordance. ONE spelling of the
   *  clip-and-fade across every wall surface. */
  fade?: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge>
  /** The color the fades blend INTO — must match the surface behind the wall
   *  or the gradient paints a visible box. Default the page background. */
  fadeColor?: string
  /** Fade thickness: one value for all edges or a per-edge map. Defaults:
   *  40px vertical edges, 112px horizontal edges (the shipped hero-wall
   *  geometry). */
  fadeSize?: number | string | Partial<Record<MarqueeWallFadeEdge, number | string>>
  /** Gap between the two track copies — match the content's own item gap so
   *  the seam is invisible. A CSS length string (e.g. `var(--tlcl-chipgap)`)
   *  lets responsive CSS own the value; the true seam distance is MEASURED
   *  from the rendered copies either way. Default 8. */
  copyGap?: number | string
  /** Outer container class — sizing lives here (height cap for `y`, width for
   *  `x`). The container is always `relative overflow-hidden`. */
  className?: string
  /** Class on EACH track copy — the wall's own layout (e.g. a wrapping chip
   *  row `flex flex-wrap gap-2`, or a fixed-width grid). */
  contentClassName?: string
  /** Inline style on EACH track copy — for values classes can't carry (e.g.
   *  an item gap driven by the same variable as `copyGap`, so chip pitch and
   *  seam pitch stay one value by construction). */
  contentStyle?: React.CSSProperties
  /**
   * Wall content — ONE copy; the wall clones it for the endless loop (clone
   * `aria-hidden` + focus-suppressed but still clickable). Pass a render
   * callback to vary the clone copy (e.g. omit `data-flip-id`s / render
   * decorative chips). Children must be clone-safe: ref-free, unique-DOM-id-
   * free, mount-effect-free (same contract as <CardsStrip> children mode).
   */
  children: React.ReactNode | ((ctx: { isClone: boolean }) => React.ReactNode)
  /** Pair this wall with sibling walls under one shared position driver. */
  sync?: MarqueeSyncController
  /** Stable id for FLIP coordination: publishes the wall's live offset via
   *  {@link getMarqueeTrackOffset} and stamps `data-marquee-track` on the
   *  container so morph engines can drift-correct captured positions. */
  trackId?: string
}

// =============================================================================
// Internals
// =============================================================================

const DEFAULT_FADE_SIZE: Record<MarqueeWallFadeEdge, string> = {
  top: '40px',
  bottom: '40px',
  left: '112px',
  right: '112px',
}

const FADE_POSITION: Record<MarqueeWallFadeEdge, string> = {
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
  left: 'inset-y-0 left-0',
  right: 'inset-y-0 right-0',
}

/** The wall's edge-fade overlays — exported so composite walls (stacked row
 *  marquees) can draw ONE set of fades over the whole stack instead of
 *  per-row copies. Parent must be `relative`. Overlays sit at z-1, ABOVE
 *  FLIP flight ghosts (z-0 by contract): an in-flight chip dissolves under
 *  the blur exactly like a resting chip. */
export function MarqueeWallFades({
  fade,
  fadeColor = 'var(--color-bg)',
  fadeSize,
}: {
  fade?: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge>
  fadeColor?: string
  fadeSize?: MarqueeWallProps['fadeSize']
}) {
  return (
    <>
      {normalizeFades(fade).map(edge => {
        const size =
          (typeof fadeSize === 'object' && fadeSize !== null ? fadeSize[edge] : fadeSize) ??
          DEFAULT_FADE_SIZE[edge]
        const px = typeof size === 'number' ? `${size}px` : size
        const isY = edge === 'top' || edge === 'bottom'
        return (
          <div
            key={edge}
            aria-hidden
            // Edge marker: lets morph engines measure the fade bands when
            // they need band-aware behavior.
            data-marquee-fade={edge}
            className={cn('pointer-events-none absolute z-[1]', FADE_POSITION[edge])}
            style={{
              [isY ? 'height' : 'width']: px,
              backgroundImage: `linear-gradient(to ${edge}, transparent, ${fadeColor})`,
            }}
          />
        )
      })}
    </>
  )
}

/** Clone track copy — aria-hidden with focusable descendants suppressed (but
 *  clickable, the shared loop-clone treatment). */
function CloneCopy({
  className,
  style,
  children,
}: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const ref = useSuppressCloneFocus(true)
  return (
    <div ref={ref} aria-hidden data-marquee-copy="clone" className={className} style={style}>
      {children}
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

/**
 * <MarqueeWall> — THE endless-scroll wall container: a clipped area whose
 * content loops as a marquee along either axis, fading out where the clip
 * cuts. Built on the same `useMarqueeEngine` core as <CardsStrip> (the news /
 * logo / bites strips) with a TRANSFORM driver instead of a scroller — no
 * inner scrollable area is created, so it is safe inside surfaces that forbid
 * nested scrollers (the deck's mobile single-fold panels).
 *
 * Static by circumstance, not by variant: when the content fits the container
 * (or `prefers-reduced-motion`) the wall renders a single static copy with
 * its fades — byte-identical to the old non-animated walls.
 */
export function MarqueeWall({
  mode = 'animated',
  axis: axisProp,
  reverse = false,
  speed = 40,
  animate = true,
  pauseOnHover = true,
  dragScroll = false,
  fade,
  fadeColor = 'var(--color-bg)',
  fadeSize,
  copyGap = 8,
  className,
  contentClassName,
  contentStyle,
  children,
  sync,
  trackId,
}: MarqueeWallProps) {
  const fades = React.useMemo(() => normalizeFades(fade), [fade])
  const axis = axisProp ?? (fades.includes('top') || fades.includes('bottom') ? 'y' : 'x')

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const copyRef = React.useRef<HTMLDivElement | null>(null)

  // ---- environment -----------------------------------------------------------
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)') ?? false

  // ---- overflow + seam measurement -------------------------------------------
  // One copy vs the container along the axis decides overflow (no overflow →
  // nothing hidden → no marquee, no clone). The WRAP size — the loop's seam
  // distance — is MEASURED as the offset delta between the two rendered
  // copies, so it is exact whatever produced the gap (numeric prop or a
  // responsive CSS variable); before the clone mounts it falls back to
  // copy size + numeric gap, corrected on the next measure.
  const [overflows, setOverflows] = React.useState(false)
  const copySizeRef = React.useRef(0)
  const wrapSizeRef = React.useRef(0)
  const measure = React.useCallback(() => {
    const container = containerRef.current
    const copy = copyRef.current
    if (!container || !copy) return
    const size = axis === 'y' ? copy.offsetHeight : copy.offsetWidth
    copySizeRef.current = size
    const clone = trackRef.current?.querySelector<HTMLElement>('[data-marquee-copy="clone"]')
    wrapSizeRef.current = clone
      ? axis === 'y'
        ? clone.offsetTop - copy.offsetTop
        : clone.offsetLeft - copy.offsetLeft
      : size + (typeof copyGap === 'number' ? copyGap : 0)
    const avail = axis === 'y' ? container.clientHeight : container.clientWidth
    setOverflows(size > avail + 1)
  }, [axis, copyGap])
  // Structural gate — the wall IS a marquee (clone copy + transform driver
  // mounted) whenever its content overflows and motion is allowed, INDEPENDENT
  // of the per-beat `animate` run-gate. Keeping it mounted across a pause lets
  // the wall FREEZE in place (rAF stops, transform + clone stay put) instead of
  // snapping the track back to its origin — that reset read as a flicker every
  // time a stepped slide advanced past a wall's active beat, or the deck-wide
  // WCAG pause toggled. Only genuinely going static (content now fits, or
  // reduced-motion) unmounts the clone and clears the transform.
  const marqueeMounted = mode === 'animated' && !reducedMotion && overflows
  // Run-gate — the rAF drives the track only while this wall's beat is active.
  // Toggling it (step-gate / deck-wide pause / off-screen) freezes and resumes
  // in place; the velocity envelope persists so resume is at cruise, not a
  // 0→speed ramp (same contract as the `nearViewport` gate below).
  const marqueeActive = marqueeMounted && animate
  React.useEffect(() => {
    measure()
    const container = containerRef.current
    const copy = copyRef.current
    if (!container || !copy || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(copy)
    return () => ro.disconnect()
    // marqueeMounted: the clone mounts with it — re-measure for the true seam.
  }, [measure, marqueeMounted])

  // Viewport gates `active` (rAF fully stops off-screen) instead of being a
  // pause REASON: the velocity envelope persists across engine restarts, so
  // scrolling a wall back into view resumes at cruise speed instantly — a
  // pause-reason resume would ramp 0→speed over ~250ms, a visible
  // stopped-then-start on every slide/section entry.
  const [nearViewport, setNearViewport] = React.useState(true)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      entries => setNearViewport(entries[0]?.isIntersecting ?? true),
      { rootMargin: NEAR_VIEWPORT_ROOT_MARGIN },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // ---- pause-reason set ------------------------------------------------------
  const pointerInsideRef = React.useRef(false)
  const clearPointerInside = React.useCallback(() => {
    pointerInsideRef.current = false
  }, [])
  const onPointerEnter = React.useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    pointerInsideRef.current = true
  }, [])
  const onPointerLeave = React.useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    pointerInsideRef.current = false
  }, [])
  // Stale-flag self-heal: a `pointerleave` can be MISSED (tab blur, an overlay
  // mounting under the cursor, an interrupted pointer) — leaving `inside` stuck
  // true so the wall freezes forever. Reset it whenever the tab hides or the
  // window loses focus (the pointer is effectively gone); the next real
  // pointer/enter re-arms it. Can only UN-stick, never cause motion under a
  // genuinely-present cursor.
  React.useEffect(() => {
    const reset = () => clearPointerInside()
    const onVis = () => { if (document.visibilityState === 'hidden') reset() }
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [clearPointerInside])

  // ---- manual drag / wheel scroll (opt-in via `dragScroll`) ------------------
  // Transform-based (no inner scroller → deck-safe): drag/wheel move the
  // engine's float position directly; `draggingRef` + a short suppress window
  // pause the auto-marquee during and just after the interaction so it resumes
  // drifting from where the user left it. Refs declared here (before the engine)
  // so `isPaused` can read them; the handlers (which need the engine's `wrap`)
  // are defined after the engine call.
  const draggingRef = React.useRef(false)
  const dragSuppressUntilRef = React.useRef(0)

  // ---- transform driver ------------------------------------------------------
  const applyTransform = React.useCallback(
    (pos: number) => {
      const track = trackRef.current
      if (!track) return
      const wrapSize = wrapSizeRef.current
      const t = reverse ? pos - wrapSize : -pos
      track.style.transform = axis === 'y' ? `translate3d(0, ${t}px, 0)` : `translate3d(${t}px, 0, 0)`
      if (trackId) {
        MARQUEE_TRACK_OFFSETS.set(
          trackId,
          axis === 'y'
            ? { x: 0, y: t, wrapX: 0, wrapY: wrapSize }
            : { x: t, y: 0, wrapX: wrapSize, wrapY: 0 },
        )
      }
    },
    [axis, reverse, trackId],
  )
  // Clear any residual offset only when the marquee turns off STRUCTURALLY
  // (content shrank so it fits, reduced-motion flipped) — the static wall must
  // sit at its natural origin. A mere run-gate pause (`animate` false) does NOT
  // clear it: the frozen track stays exactly where it stopped (no flicker). The
  // engine position resets with it (below the engine call) so a later
  // re-activation re-seeds consistently.
  React.useEffect(() => {
    if (marqueeMounted) return
    const track = trackRef.current
    if (track) track.style.transform = ''
    if (trackId) MARQUEE_TRACK_OFFSETS.set(trackId, ZERO_OFFSET)
  }, [marqueeMounted, trackId])
  // NOTE deliberately no reset of the registry entry on mount: when a layout
  // change remounts the SAME trackId in one commit, the morph engine must
  // still read the OLD wall's final drift for that commit's flight origins.
  // The new wall's first applied frame (rAF, after all layout effects)
  // overwrites it. Capture-side reads take the translation from the DOM
  // ({@link getMarqueeAppliedOffset}), so a stale registry value can never
  // leak into captured points.

  // ---- sync pairing (driver election by mount order, with re-election) -------
  const [isDriver, setIsDriver] = React.useState(!sync)
  React.useEffect(() => {
    if (!sync) {
      setIsDriver(true)
      return
    }
    const member: MarqueeSyncMember = { apply: applyTransform, makeDriver: () => setIsDriver(true) }
    sync.members.add(member)
    if (sync.driver === null) sync.driver = member
    setIsDriver(sync.driver === member)
    return () => {
      sync.members.delete(member)
      if (sync.driver === member) {
        // Promote the next surviving member so the pair never goes driverless
        // (a driverless pair would freeze — nothing runs the shared rAF).
        const next = sync.members.values().next()
        sync.driver = next.done ? null : next.value
        sync.driver?.makeDriver()
      }
    }
  }, [sync, applyTransform])

  const { posRef, wrap } = useMarqueeEngine({
    active: marqueeActive && nearViewport && isDriver,
    speed,
    isPaused: now =>
      (pauseOnHover && pointerInsideRef.current) ||
      draggingRef.current ||
      now < dragSuppressUntilRef.current ||
      document.visibilityState === 'hidden',
    getWrapSize: () => wrapSizeRef.current,
    apply: sync
      ? pos => {
          sync.position = pos
          sync.members.forEach(m => m.apply(pos))
        }
      : applyTransform,
    // Synced pairs: a re-elected driver resumes from the pair's live position
    // (engine seeds from readBack on activation) instead of restarting at 0.
    readBack: sync ? () => sync.position : undefined,
  })
  // REVERSE-travel continuity: an unstyled track (t = 0) corresponds to
  // pos = wrapSize, not pos = 0 — seed the position on activation so the
  // engine's first frame continues from the freshly-painted state instead of
  // teleporting the track a full wrap upward. Without this, a FLIP morph
  // capturing against the mount paint saw every chip (and every in-flight
  // ghost target) jump a copy-height on the next frame — the "chips pour in
  // from the top instead of flying between panels" breakage.
  React.useLayoutEffect(() => {
    if (!marqueeMounted) {
      posRef.current = 0
      return
    }
    if (reverse && posRef.current === 0) {
      posRef.current = Math.max(0, wrapSizeRef.current - 0.01)
    }
  }, [marqueeMounted, reverse, posRef])

  // ---- manual drag / wheel handlers (only wired when `dragScroll`) -----------
  const DRAG_RESUME_MS = 1200
  const dragStartRef = React.useRef({ coord: 0, pos: 0 })
  const dragMovedRef = React.useRef(false)
  const suppressClickRef = React.useRef(false)
  const dragCoord = (e: React.PointerEvent) => (axis === 'y' ? e.clientY : e.clientX)

  const onDragPointerDown = React.useCallback((e: React.PointerEvent) => {
    if (!marqueeMounted) return
    draggingRef.current = true
    dragMovedRef.current = false
    dragStartRef.current = { coord: axis === 'y' ? e.clientY : e.clientX, pos: posRef.current }
    try { containerRef.current?.setPointerCapture(e.pointerId) } catch { /* capture is best-effort */ }
  }, [marqueeMounted, axis, posRef])

  const onDragPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const delta = (axis === 'y' ? e.clientY : e.clientX) - dragStartRef.current.coord
    if (Math.abs(delta) > 3) dragMovedRef.current = true
    // Track follows the pointer. `applyTransform` maps pos→translate as
    // `-pos` (forward) / `pos-wrap` (reverse), so a rightward/downward drag
    // (delta > 0) must DECREASE pos on a forward wall and INCREASE it on a
    // reverse one.
    posRef.current = wrap(dragStartRef.current.pos + (reverse ? delta : -delta))
    applyTransform(posRef.current)
    dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS
  }, [axis, reverse, wrap, posRef, applyTransform])

  const onDragPointerUp = React.useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    // A real drag ends over a chip → swallow the synthetic click so the drag
    // doesn't fire the chip's action.
    if (dragMovedRef.current) suppressClickRef.current = true
    dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS
    try { containerRef.current?.releasePointerCapture(e.pointerId) } catch { /* best-effort */ }
  }, [])

  const onDragClickCapture = React.useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const onDragWheel = React.useCallback((e: React.WheelEvent) => {
    if (!marqueeMounted) return
    // Along-axis wheel intent only: an x-wall ignores vertical page-scroll
    // wheels (and vice-versa) so the surrounding page still scrolls.
    const primary = axis === 'y' ? e.deltaY : (Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : 0)
    if (primary === 0) return
    posRef.current = wrap(posRef.current + (reverse ? -primary : primary))
    applyTransform(posRef.current)
    dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS
  }, [marqueeMounted, axis, reverse, wrap, posRef, applyTransform])

  // ---- render ----------------------------------------------------------------
  const renderContent = (isClone: boolean) =>
    typeof children === 'function' ? children({ isClone }) : children

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        dragScroll && marqueeMounted && 'cursor-grab active:cursor-grabbing select-none',
        className,
      )}
      // x-walls let vertical page-scroll pass (`pan-y`) and own horizontal
      // drags; y-walls the reverse. Only when drag is actually live.
      style={dragScroll && marqueeMounted ? { touchAction: axis === 'y' ? 'pan-x' : 'pan-y' } : undefined}
      data-marquee-track={trackId}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={dragScroll ? onDragPointerDown : undefined}
      onPointerMove={dragScroll ? onDragPointerMove : undefined}
      onPointerUp={dragScroll ? onDragPointerUp : undefined}
      onPointerCancel={dragScroll ? onDragPointerUp : undefined}
      onClickCapture={dragScroll ? onDragClickCapture : undefined}
      onWheel={dragScroll ? onDragWheel : undefined}
    >
      <div
        ref={trackRef}
        className={cn(
          axis === 'y' ? 'flex w-full flex-col' : 'flex w-max items-stretch',
          // Keyed on the STRUCTURAL state so the compositor layer + seam gap
          // stay put while the wall is frozen (paused) — dropping them on pause
          // would repaint the frozen track and re-promote it on resume.
          marqueeMounted && 'will-change-transform',
        )}
        style={marqueeMounted ? { gap: copyGap } : undefined}
      >
        <div
          ref={copyRef}
          data-marquee-copy="primary"
          className={cn(axis === 'x' && 'w-max shrink-0', contentClassName)}
          style={contentStyle}
        >
          {renderContent(false)}
        </div>
        {marqueeMounted && (
          <CloneCopy className={cn(axis === 'x' && 'w-max shrink-0', contentClassName)} style={contentStyle}>
            {renderContent(true)}
          </CloneCopy>
        )}
      </div>
      {/* A fade means "there's more": it only paints while the content
          actually overflows the container. A wall taller than its content
          (e.g. a flex-filled panel) must show every chip crisp — a veil over
          real rows and empty surface reads as a rendering bug. Plain mode
          skips fades entirely (the consumer opted out of blur + marquee). */}
      {mode === 'animated' && overflows && (
        <MarqueeWallFades fade={fade} fadeColor={fadeColor} fadeSize={fadeSize} />
      )}
    </div>
  )
}
