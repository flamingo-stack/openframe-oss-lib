'use client'

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'

/**
 * THE marquee animation core (single source of truth) — extracted verbatim
 * from <CardsStrip> so every endless-scroll surface (card strips, logo strips,
 * quick-action walls, chip marquees) shares ONE rAF position engine ("unify
 * means delete variations").
 *
 * The engine is axis- and driver-agnostic: it owns a FLOAT position ref, a
 * velocity envelope, seam wrapping, and an optional chevron-style glide; the
 * caller decides what a position "means" via `apply` — writing
 * `scroller.scrollLeft` (CardsStrip: a real scroller the user can also drag)
 * or a `translate` transform (MarqueeWall: decorative tracks, incl. vertical —
 * mandatory inside surfaces that forbid inner scrollers, e.g. the deck's
 * mobile single-fold panels).
 *
 * Engine semantics (do not "simplify"):
 * - Position lives in a FLOAT ref, never read-modify-write from the DOM:
 *   scrollLeft reads back rounded values, so sub-pixel increments
 *   (speed/fps < 1px) get eaten by rounding — stutter + measurably slower
 *   than the configured speed.
 * - Velocity envelope (~250ms time constant) eases between 0 and `speed`
 *   instead of binary stop/start — pause decelerates, resume accelerates from
 *   the current position (GSAP-marquee behavior; hard cuts read as jank).
 * - Glide consumes a signed remaining-distance, wrapping modulo the copy size
 *   each frame, so seam warps are invisible to it (browser smooth-scroll
 *   animates toward an ABSOLUTE target and lunges after a warp).
 * - `isPaused` is evaluated every frame — the caller owns the pause-reason
 *   set (hover, viewport, tab visibility, suppress windows); the engine only
 *   turns it into a smooth velocity target.
 */
export interface MarqueeEngineOptions {
  /** Master switch — the rAF runs only while true. On (re)activation the
   *  position resyncs from `readBack` when provided. */
  active: boolean
  /** Cruise speed in px/s. */
  speed: number
  /** Per-frame pause verdict (caller-owned reason set). `now` is the rAF
   *  timestamp, for suppress-until comparisons. */
  isPaused: (now: number) => boolean
  /** Single-copy size in px (the wrap modulus). Return <= 0 to disable
   *  wrapping (position advances unwrapped — callers should size tracks so
   *  this never happens while active). */
  getWrapSize: () => number
  /** Lower bound of the wrap range: positions stay in
   *  [wrapMin, wrapMin + wrapSize). Default 0. Scroller drivers with USER
   *  scrolling pass their seam-warp buffer here so engine-written positions
   *  never enter the re-center zones — an exact-edge warp check is racy
   *  against the rAF (the engine nudges the scroller off the edge before the
   *  scroll handler samples it → "stuck at the left edge"). */
  getWrapMin?: () => number
  /** Write the position to the DOM (scrollLeft assignment or transform). */
  apply: (pos: number) => void
  /** Read the externally-mutated position back (real scrollers: user drag /
   *  native smooth scroll move scrollLeft under the engine). Omit for
   *  transform drivers — nothing external can move them. */
  readBack?: () => number
  /** Called at the end of every frame (e.g. hover re-resolution after the
   *  track moved under a stationary pointer). */
  onAfterFrame?: () => void
}

export interface MarqueeEngineHandle {
  /** The engine's float position (px along the axis, 0 ≤ pos < wrap while
   *  wrapping). Callers may write it together with their own DOM write (seam
   *  warp on manual scroll). */
  posRef: MutableRefObject<number>
  /** Accumulate a signed glide distance (chevron navigation). Runs through
   *  the engine's own tween — never native smooth scroll while wrapping. */
  glideBy: (px: number) => void
  /** Wrap an arbitrary position into [0, wrapSize). */
  wrap: (pos: number) => number
}

// Resync threshold (px): external movement beyond this adopts the DOM value.
const RESYNC_EPSILON = 1.5

export function useMarqueeEngine(options: MarqueeEngineOptions): MarqueeEngineHandle {
  const posRef = useRef(0)
  const glideRemainingRef = useRef(0)
  const speedEnvRef = useRef(0)

  // Latest-options ref: the rAF loop always reads current values without the
  // effect restarting on every render.
  const optsRef = useRef(options)
  optsRef.current = options

  const wrap = useCallback((pos: number) => {
    const half = optsRef.current.getWrapSize()
    if (half <= 0) return pos
    const min = optsRef.current.getWrapMin?.() ?? 0
    while (pos >= min + half) pos -= half
    while (pos < min) pos += half
    return pos
  }, [])

  const glideBy = useCallback((px: number) => {
    glideRemainingRef.current += px
  }, [])

  const active = options.active
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    const readBack = optsRef.current.readBack
    if (readBack) posRef.current = readBack()

    const tick = (now: number) => {
      const opts = optsRef.current
      const dt = Math.min(now - last, 100) / 1000 // clamp tab-wake jumps
      last = now

      const paused = opts.isPaused(now)
      // Ease the velocity toward its target (0 when paused) — smooth decel on
      // pause, smooth accel on resume, always from the CURRENT position.
      const targetSpeed = paused ? 0 : opts.speed
      speedEnvRef.current += (targetSpeed - speedEnvRef.current) * Math.min(1, dt / 0.25)
      if (targetSpeed === 0 && speedEnvRef.current < 0.5) speedEnvRef.current = 0

      const external = opts.readBack ? opts.readBack() : null
      const resync = () => {
        if (external !== null && Math.abs(external - posRef.current) > RESYNC_EPSILON) {
          posRef.current = external
        }
      }

      const glide = glideRemainingRef.current
      if (glide !== 0) {
        // Ease-out toward the glide target; runs even while "paused" (the
        // interaction that queued it sets its own suppress window).
        resync()
        const speed = Math.max(Math.abs(glide) * 6, 240) // px/s, proportional
        const step = Math.sign(glide) * Math.min(Math.abs(glide), speed * dt)
        glideRemainingRef.current = Math.abs(glide - step) < 0.5 ? 0 : glide - step
        posRef.current = wrap(posRef.current + step)
        opts.apply(posRef.current)
      } else if (speedEnvRef.current > 0) {
        // Resync after external movement (user scroll, seam warp).
        resync()
        posRef.current = wrap(posRef.current + speedEnvRef.current * dt)
        opts.apply(posRef.current)
      } else if (external !== null) {
        // Idle: follow external movement so resumes start from where the
        // user left the scroller.
        posRef.current = external
      }
      opts.onAfterFrame?.()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, wrap])

  return { posRef, glideBy, wrap }
}
