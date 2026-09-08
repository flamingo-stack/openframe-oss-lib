'use client';

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useMarqueeEngine } from '../../hooks/ui/use-marquee-engine';
import { useMediaQuery } from '../../hooks/ui/use-media-query';
import { useResetOnPageHidden } from '../../hooks/ui/use-reset-on-page-hidden';
import { useSuppressCloneFocus } from '../../hooks/ui/use-suppress-clone-focus';
import { NEAR_VIEWPORT_ROOT_MARGIN } from '../../hooks/use-near-viewport';
import { cn } from '../../utils/cn';

// =============================================================================
// Types
// =============================================================================

export type MarqueeWallFadeEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * One spelling of the `fade` prop's edge-list normalization.
 *
 * Discriminated on `typeof fade === 'string'` rather than `Array.isArray`:
 * `Array.isArray`'s guard is `arg is any[]`, which narrows a `ReadonlyArray`
 * union member to `any[]` and hands the caller back an `any`-element array —
 * and it forced the single-edge branch through an `as` to undo the narrowing
 * on the other side.
 */
function normalizeFades(
  fade: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge> | undefined,
): ReadonlyArray<MarqueeWallFadeEdge> {
  if (fade === undefined) return [];
  return typeof fade === 'string' ? [fade] : fade;
}

/** @internal per-instance sync membership — just the wall's transform writer.
 *  The object's IDENTITY is the wall's seat token in the election; a wall keeps
 *  one for its whole life (the writer itself is reached through a ref), so a
 *  changed axis/reverse/trackId refreshes what the pair applies without
 *  unregistering and re-electing. */
interface MarqueeSyncMember {
  apply: (pos: number) => void;
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
  /** @internal Join the pair: registers `member`'s transform writer and claims
   *  the driver role if the seat is empty. Returns the unregister, which
   *  re-elects a survivor when the leaver was the driver. */
  register: (member: MarqueeSyncMember) => () => void;
  /** @internal `useSyncExternalStore` subscription: fires whenever the driver
   *  seat changes hands, so members re-read {@link isDriver}. */
  subscribe: (onElectionChange: () => void) => () => void;
  /** @internal Whether `member` currently holds the driver seat. */
  isDriver: (member: MarqueeSyncMember) => boolean;
  /** @internal Publish a driver-written position to the whole pair: records it
   *  and fans it out to every member's transform. Called once per rAF frame —
   *  a plain call on instance-lifetime closure state, so it costs exactly what
   *  the direct field write it replaced cost and triggers no render. */
  publish: (pos: number) => void;
  /** @internal Last published position — a promoted driver's engine seeds from
   *  it, so re-election never snaps the pair back to 0. */
  readPosition: () => number;
}

/**
 * The controller's mutable parts — the member set, the driver seat and the
 * live position — are CLOSURE state of this factory, never fields on the
 * object walls receive. A wall calls `publish` / `register`; it never writes
 * through the `sync` prop, so the pair's invariants (one driver, promotion on
 * unmount) are enforced in one place instead of by each wall's effect. Module
 * scope, so the state is not created during a render.
 *
 * The election is published as a `useSyncExternalStore` source rather than
 * pushed into each wall with a `setIsDriver` callback: promotion then happens
 * by React re-reading a snapshot, so a cleanup can never call setState on a
 * peer that is unmounting in the same commit.
 */
function createMarqueeSyncController(): MarqueeSyncController {
  const members = new Set<MarqueeSyncMember>();
  const listeners = new Set<() => void>();
  let driver: MarqueeSyncMember | null = null;
  let position = 0;
  const elect = (next: MarqueeSyncMember | null) => {
    if (driver === next) return;
    driver = next;
    listeners.forEach(l => {
      l();
    });
  };
  return {
    register(member) {
      members.add(member);
      if (driver === null) elect(member);
      return () => {
        members.delete(member);
        if (driver !== member) return;
        // Promote the next surviving member so the pair never goes driverless
        // (a driverless pair would freeze — nothing runs the shared rAF).
        const next = members.values().next();
        elect(next.done ? null : next.value);
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isDriver: member => driver === member,
    publish(pos) {
      position = pos;
      members.forEach(m => {
        m.apply(pos);
      });
    },
    readPosition: () => position,
  };
}

/** Module-scope so their identity is stable across renders — a fresh
 *  `subscribe` every render would make `useSyncExternalStore` tear down and
 *  re-establish the subscription on each commit. Used by an UNPAIRED wall,
 *  which has no store to watch and is its own driver by definition; the second
 *  also serves as the server snapshot (there is no rAF during SSR either way,
 *  and the value never reaches the markup). */
const subscribeNever = () => () => {};
const alwaysDriver = () => true;

export function useMarqueeSync(): MarqueeSyncController {
  // An instance-lifetime object, so `useState`'s lazy initialiser rather than a
  // ref unwrapped during render — which additionally built a throwaway
  // controller (and a throwaway `Set`) on every single render.
  const [controller] = useState(createMarqueeSyncController);
  return controller;
}

// =============================================================================
// FLIP coordination — live track offsets + loop-clone helpers
// =============================================================================

export interface MarqueeTrackOffset {
  /** Applied translation (px) along each axis. */
  x: number;
  y: number;
  /** Loop wrap size (single copy + seam gap) along each axis; 0 on the
   *  non-scroll axis. Lets morph engines treat a chip and its loop clone as
   *  ONE identity `wrap` apart (the Swiper loop-clone model) and fly the
   *  copy the viewer actually sees. */
  wrapX: number;
  wrapY: number;
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
const MARQUEE_TRACK_OFFSETS = new Map<string, MarqueeTrackOffset>();

const ZERO_OFFSET: MarqueeTrackOffset = { x: 0, y: 0, wrapX: 0, wrapY: 0 };

/** Last known translation + wrap of the wall registered under `trackId`
 *  (live or already unmounted). Zeros for unknown ids / static walls. */
export function getMarqueeTrackOffset(trackId: string): MarqueeTrackOffset {
  return MARQUEE_TRACK_OFFSETS.get(trackId) ?? ZERO_OFFSET;
}

/**
 * The translation ACTUALLY applied to a wall's track right now, read from the
 * DOM of the `data-marquee-track` container. Morph engines use this on the
 * CAPTURE side (never the registry): a same-id wall freshly remounted in the
 * current commit has not applied any transform yet, while the registry still
 * holds its predecessor's final drift for the flight-side lookup.
 */
export function getMarqueeAppliedOffset(trackContainer: Element): { x: number; y: number } {
  const track = trackContainer.firstElementChild;
  const t = track ? getComputedStyle(track).transform : 'none';
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(t);
  return { x: m.e, y: m.f };
}

/**
 * The loop-clone twin of an element inside a wall's PRIMARY copy (same index
 * in the `data-marquee-copy="clone"` copy), or null when there is no clone /
 * the element isn't in the primary copy. Owns the wall's internal DOM shape
 * so morph engines don't hardcode it; `selector` scopes which descendants
 * count as items (default: direct structure-preserving lookup by class is the
 * caller's job — pass the item selector, e.g. `'.flipchip'`).
 */
export function getMarqueeCloneTwin(trackContainer: Element, el: Element, selector: string): HTMLElement | null {
  const primary = trackContainer.querySelector('[data-marquee-copy="primary"]');
  const clone = trackContainer.querySelector('[data-marquee-copy="clone"]');
  if (!primary || !clone || !primary.contains(el)) return null;
  const idx = Array.prototype.indexOf.call(primary.querySelectorAll(selector), el);
  if (idx < 0) return null;
  return (clone.querySelectorAll(selector)[idx] as HTMLElement | undefined) ?? null;
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
  mode?: 'animated' | 'plain';
  /**
   * Marquee axis. Defaults to where the fade sits — the animation's job is to
   * reveal what the fade hides: a `bottom`/`top` fade clips rows → vertical
   * (content travels bottom→top); a `left`/`right`-only fade clips columns →
   * horizontal (content travels right→left). No fade → horizontal.
   */
  axis?: 'x' | 'y';
  /** Reverse travel: `x` reversed moves content right, `y` reversed moves it
   *  down. Default false (left / up). */
  reverse?: boolean;
  /** Scroll speed in px/s (the CardsStrip unit — one speed language across
   *  every marquee). Default 40: calm chip-wall drift, slower than the 60 the
   *  card strips cruise at. */
  speed?: number;
  /** Master switch. Even when true the marquee auto-disables while the content
   *  fits the container and under `prefers-reduced-motion` (static wall). */
  animate?: boolean;
  /** Freeze while a hover-capable pointer is anywhere over the wall — content
   *  must never move under a pointing cursor (required for interactive chip
   *  walls). Default true. */
  pauseOnHover?: boolean;
  /** Opt-in MANUAL scroll: pointer-drag + horizontal wheel move the wall along
   *  its axis (transform-based — no inner scroller is created, so it stays
   *  deck-safe). The auto-marquee pauses during the interaction and briefly
   *  after, then resumes drifting from wherever the user left it. Off by
   *  default (decorative walls stay auto-only); enabled on the embeddable-chat
   *  quick-action walls so users can browse the actions by hand. */
  dragScroll?: boolean;
  /** Edge fade(s) — the "there's more" affordance. ONE spelling of the
   *  clip-and-fade across every wall surface. */
  fade?: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge>;
  /** The color the fades blend INTO — must match the surface behind the wall
   *  or the gradient paints a visible box. Default the page background. */
  fadeColor?: string;
  /** Fade thickness: one value for all edges or a per-edge map. Defaults:
   *  40px vertical edges, 112px horizontal edges (the shipped hero-wall
   *  geometry). */
  fadeSize?: number | string | Partial<Record<MarqueeWallFadeEdge, number | string>>;
  /** Gap between the two track copies — match the content's own item gap so
   *  the seam is invisible. A CSS length string (e.g. `var(--tlcl-chipgap)`)
   *  lets responsive CSS own the value; the true seam distance is MEASURED
   *  from the rendered copies either way. Default 8. */
  copyGap?: number | string;
  /** Outer container class — sizing lives here (height cap for `y`, width for
   *  `x`). The container is always `relative overflow-hidden`. */
  className?: string;
  /** Class on EACH track copy — the wall's own layout (e.g. a wrapping chip
   *  row `flex flex-wrap gap-2`, or a fixed-width grid). */
  contentClassName?: string;
  /** Inline style on EACH track copy — for values classes can't carry (e.g.
   *  an item gap driven by the same variable as `copyGap`, so chip pitch and
   *  seam pitch stay one value by construction). */
  contentStyle?: CSSProperties;
  /**
   * Wall content — ONE copy; the wall clones it for the endless loop (clone
   * `aria-hidden` + focus-suppressed but still clickable). Pass a render
   * callback to vary the clone copy (e.g. omit `data-flip-id`s / render
   * decorative chips). Children must be clone-safe: ref-free, unique-DOM-id-
   * free, mount-effect-free (same contract as <CardsStrip> children mode).
   */
  children: ReactNode | ((ctx: { isClone: boolean }) => ReactNode);
  /** Pair this wall with sibling walls under one shared position driver. */
  sync?: MarqueeSyncController;
  /** Stable id for FLIP coordination: publishes the wall's live offset via
   *  {@link getMarqueeTrackOffset} and stamps `data-marquee-track` on the
   *  container so morph engines can drift-correct captured positions. */
  trackId?: string;
}

// =============================================================================
// Internals
// =============================================================================

const DEFAULT_FADE_SIZE: Record<MarqueeWallFadeEdge, string> = {
  top: '40px',
  bottom: '40px',
  left: '112px',
  right: '112px',
};

const FADE_POSITION: Record<MarqueeWallFadeEdge, string> = {
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
  left: 'inset-y-0 left-0',
  right: 'inset-y-0 right-0',
};

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
  fade?: MarqueeWallFadeEdge | ReadonlyArray<MarqueeWallFadeEdge>;
  fadeColor?: string;
  fadeSize?: MarqueeWallProps['fadeSize'];
}) {
  return (
    <>
      {normalizeFades(fade).map(edge => {
        const size =
          (typeof fadeSize === 'object' && fadeSize !== null ? fadeSize[edge] : fadeSize) ?? DEFAULT_FADE_SIZE[edge];
        const px = typeof size === 'number' ? `${size}px` : size;
        const isY = edge === 'top' || edge === 'bottom';
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
        );
      })}
    </>
  );
}

/** Clone track copy — aria-hidden with focusable descendants suppressed (but
 *  clickable, the shared loop-clone treatment). */
function CloneCopy({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useSuppressCloneFocus(true);
  return (
    <div ref={ref} aria-hidden data-marquee-copy="clone" className={className} style={style}>
      {children}
    </div>
  );
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
  const fades = useMemo(() => normalizeFades(fade), [fade]);
  const axis = axisProp ?? (fades.includes('top') || fades.includes('bottom') ? 'y' : 'x');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);

  // ---- environment -----------------------------------------------------------
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)') ?? false;

  // ---- overflow + seam measurement -------------------------------------------
  // One copy vs the container along the axis decides overflow (no overflow →
  // nothing hidden → no marquee, no clone). The WRAP size — the loop's seam
  // distance — is MEASURED as the offset delta between the two rendered
  // copies, so it is exact whatever produced the gap (numeric prop or a
  // responsive CSS variable); before the clone mounts it falls back to
  // copy size + numeric gap, corrected on the next measure.
  const [overflows, setOverflows] = useState(false);
  const copySizeRef = useRef(0);
  const wrapSizeRef = useRef(0);
  const measure = useCallback(() => {
    const container = containerRef.current;
    const copy = copyRef.current;
    if (!container || !copy) return;
    const size = axis === 'y' ? copy.offsetHeight : copy.offsetWidth;
    copySizeRef.current = size;
    const clone = trackRef.current?.querySelector<HTMLElement>('[data-marquee-copy="clone"]');
    wrapSizeRef.current = clone
      ? axis === 'y'
        ? clone.offsetTop - copy.offsetTop
        : clone.offsetLeft - copy.offsetLeft
      : size + (typeof copyGap === 'number' ? copyGap : 0);
    const avail = axis === 'y' ? container.clientHeight : container.clientWidth;
    setOverflows(size > avail + 1);
  }, [axis, copyGap]);
  // Structural gate — the wall IS a marquee (clone copy + transform driver
  // mounted) whenever its content overflows and motion is allowed, INDEPENDENT
  // of the per-beat `animate` run-gate. Keeping it mounted across a pause lets
  // the wall FREEZE in place (rAF stops, transform + clone stay put) instead of
  // snapping the track back to its origin — that reset read as a flicker every
  // time a stepped slide advanced past a wall's active beat, or the deck-wide
  // WCAG pause toggled. Only genuinely going static (content now fits, or
  // reduced-motion) unmounts the clone and clears the transform.
  const marqueeMounted = mode === 'animated' && !reducedMotion && overflows;
  // Run-gate — the rAF drives the track only while this wall's beat is active.
  // Toggling it (step-gate / deck-wide pause / off-screen) freezes and resumes
  // in place; the velocity envelope persists so resume is at cruise, not a
  // 0→speed ramp (same contract as the `nearViewport` gate below).
  const marqueeActive = marqueeMounted && animate;
  useEffect(() => {
    measure();
    const container = containerRef.current;
    const copy = copyRef.current;
    if (!container || !copy || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(copy);
    return () => ro.disconnect();
    // marqueeMounted: the clone mounts with it — re-measure for the true seam.
  }, [measure, marqueeMounted]);

  // Viewport gates `active` (rAF fully stops off-screen) instead of being a
  // pause REASON: the velocity envelope persists across engine restarts, so
  // scrolling a wall back into view resumes at cruise speed instantly — a
  // pause-reason resume would ramp 0→speed over ~250ms, a visible
  // stopped-then-start on every slide/section entry.
  const [nearViewport, setNearViewport] = useState(true);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(entries => setNearViewport(entries[0]?.isIntersecting ?? true), {
      rootMargin: NEAR_VIEWPORT_ROOT_MARGIN,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- pause-reason set ------------------------------------------------------
  const pointerInsideRef = useRef(false);
  const clearPointerInside = useCallback(() => {
    pointerInsideRef.current = false;
  }, []);
  const onPointerEnter = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    pointerInsideRef.current = true;
  }, []);
  const onPointerLeave = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    pointerInsideRef.current = false;
  }, []);
  // Stale-flag self-heal (shared SSOT): if a `pointerleave` is MISSED (tab blur,
  // overlay under the cursor, interrupted pointer), `inside` stays stuck true and
  // the wall freezes forever — so un-stick it whenever the tab hides / the window
  // loses focus. The next real pointer/enter re-arms it.
  useResetOnPageHidden(clearPointerInside);

  // ---- manual drag / wheel scroll (opt-in via `dragScroll`) ------------------
  // Transform-based (no inner scroller → deck-safe): drag/wheel move the
  // engine's float position directly; `draggingRef` + a short suppress window
  // pause the auto-marquee during and just after the interaction so it resumes
  // drifting from where the user left it. Refs declared here (before the engine)
  // so `isPaused` can read them; the handlers (which need the engine's `wrap`)
  // are defined after the engine call.
  const draggingRef = useRef(false);
  const dragSuppressUntilRef = useRef(0);

  // ---- transform driver ------------------------------------------------------
  const applyTransform = useCallback(
    (pos: number) => {
      const track = trackRef.current;
      if (!track) return;
      const wrapSize = wrapSizeRef.current;
      const t = reverse ? pos - wrapSize : -pos;
      track.style.transform = axis === 'y' ? `translate3d(0, ${t}px, 0)` : `translate3d(${t}px, 0, 0)`;
      if (trackId) {
        MARQUEE_TRACK_OFFSETS.set(
          trackId,
          axis === 'y' ? { x: 0, y: t, wrapX: 0, wrapY: wrapSize } : { x: t, y: 0, wrapX: wrapSize, wrapY: 0 },
        );
      }
    },
    [axis, reverse, trackId],
  );
  // Sync-aware position writer — THE single entry point for every position
  // update (the engine's rAF apply AND the manual drag/wheel handlers). With a
  // `sync` controller it publishes to the shared position and drives every peer
  // wall's transform; without one it just writes our own. Routing drag/wheel
  // through here (instead of raw `applyTransform`) keeps a wall that is both
  // `sync`-ed and `dragScroll`-ed in lockstep with its peers — a direct
  // `applyTransform` would move only this wall and leave the shared position +
  // peers stale. Members' own `apply` stays the raw `applyTransform` (no
  // re-publish), so the controller's fan-out can't recurse.
  const applyPos = useCallback(
    (pos: number) => {
      if (sync) {
        sync.publish(pos);
      } else {
        applyTransform(pos);
      }
    },
    [sync, applyTransform],
  );
  // Clear any residual offset only when the marquee turns off STRUCTURALLY
  // (content shrank so it fits, reduced-motion flipped) — the static wall must
  // sit at its natural origin. A mere run-gate pause (`animate` false) does NOT
  // clear it: the frozen track stays exactly where it stopped (no flicker). The
  // engine position resets with it (below the engine call) so a later
  // re-activation re-seeds consistently.
  useEffect(() => {
    if (marqueeMounted) return;
    const track = trackRef.current;
    if (track) track.style.transform = '';
    if (trackId) MARQUEE_TRACK_OFFSETS.set(trackId, ZERO_OFFSET);
  }, [marqueeMounted, trackId]);
  // NOTE deliberately no reset of the registry entry on mount: when a layout
  // change remounts the SAME trackId in one commit, the morph engine must
  // still read the OLD wall's final drift for that commit's flight origins.
  // The new wall's first applied frame (rAF, after all layout effects)
  // overwrites it. Capture-side reads take the translation from the DOM
  // ({@link getMarqueeAppliedOffset}), so a stale registry value can never
  // leak into captured points.

  // ---- sync pairing (driver election by mount order, with re-election) -------
  // This wall's seat token, stable for its whole life. `apply` goes through a
  // ref so a changed axis/reverse/trackId swaps the transform writer WITHOUT
  // leaving and rejoining the pair — re-registering would drop this wall to the
  // back of the queue and silently hand the driver seat to its peer.
  const applyTransformRef = useRef(applyTransform);
  useEffect(() => {
    applyTransformRef.current = applyTransform;
  });
  const [member] = useState<MarqueeSyncMember>(() => ({
    apply: pos => {
      applyTransformRef.current(pos);
    },
  }));
  // The election lives in the shared controller — external state, read during
  // render. That is exactly `useSyncExternalStore`'s job, and it keeps
  // promotion out of the peer's effect cleanup: a re-elected wall re-reads the
  // snapshot instead of being handed a setState. Unpaired means self-driven
  // always — a fact about the PROP, not an election result, so it is a constant
  // snapshot rather than a value written back into state.
  const isDriver = useSyncExternalStore(
    sync ? sync.subscribe : subscribeNever,
    sync ? () => sync.isDriver(member) : alwaysDriver,
    alwaysDriver,
  );
  useEffect(() => {
    if (!sync) return undefined;
    return sync.register(member);
  }, [sync, member]);

  const { posRef, wrap } = useMarqueeEngine({
    active: marqueeActive && nearViewport && isDriver,
    speed,
    isPaused: now =>
      (pauseOnHover && pointerInsideRef.current) ||
      draggingRef.current ||
      now < dragSuppressUntilRef.current ||
      document.visibilityState === 'hidden',
    getWrapSize: () => wrapSizeRef.current,
    apply: applyPos,
    // Synced pairs: a re-elected driver resumes from the pair's live position
    // (engine seeds from readBack on activation) instead of restarting at 0.
    readBack: sync ? () => sync.readPosition() : undefined,
  });
  // REVERSE-travel continuity: an unstyled track (t = 0) corresponds to
  // pos = wrapSize, not pos = 0 — seed the position on activation so the
  // engine's first frame continues from the freshly-painted state instead of
  // teleporting the track a full wrap upward. Without this, a FLIP morph
  // capturing against the mount paint saw every chip (and every in-flight
  // ghost target) jump a copy-height on the next frame — the "chips pour in
  // from the top instead of flying between panels" breakage.
  useLayoutEffect(() => {
    if (!marqueeMounted) {
      posRef.current = 0;
      return;
    }
    if (reverse && posRef.current === 0) {
      posRef.current = Math.max(0, wrapSizeRef.current - 0.01);
    }
  }, [marqueeMounted, reverse, posRef]);

  // ---- manual drag / wheel handlers (only wired when `dragScroll`) -----------
  const DRAG_RESUME_MS = 1200;
  const dragStartRef = useRef({ coord: 0, pos: 0 });
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const onDragPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!marqueeMounted) return;
      draggingRef.current = true;
      dragMovedRef.current = false;
      // Clear any click-suppress left armed by a prior drag that ended WITHOUT a
      // synthetic click on this container (pointercancel, or the pointer released
      // off the wall) — otherwise `onDragClickCapture` would swallow this fresh
      // tap's action. A new press is unambiguously a new intent.
      suppressClickRef.current = false;
      dragStartRef.current = { coord: axis === 'y' ? e.clientY : e.clientX, pos: posRef.current };
      // NOTE deliberately NO setPointerCapture here — capture is taken LAZILY in
      // `onDragPointerMove`, once the press is proven to be a drag. Capturing on
      // pointerdown retargets the compatibility mouse events (mouseup, and hence
      // `click`, which fires at the nearest common ancestor of down/up) from the
      // pressed element to this container — so a plain tap on a quick-action chip
      // never reaches the chip's own onClick and the whole wall reads as dead.
    },
    [marqueeMounted, axis, posRef],
  );

  const onDragPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const delta = (axis === 'y' ? e.clientY : e.clientX) - dragStartRef.current.coord;
      if (Math.abs(delta) > 3 && !dragMovedRef.current) {
        dragMovedRef.current = true;
        // Past the threshold this IS a drag: capture so the gesture keeps
        // tracking once the pointer leaves the wall. Retargeting click is now
        // WANTED — the trailing synthetic click is suppressed below anyway.
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* best-effort */
        }
      }
      // Track follows the pointer. `applyPos` maps pos→translate as `-pos`
      // (forward) / `pos-wrap` (reverse), so a rightward/downward drag (delta > 0)
      // must DECREASE pos on a forward wall and INCREASE it on a reverse one.
      // Via `applyPos` (not raw `applyTransform`) so synced peer walls follow.
      posRef.current = wrap(dragStartRef.current.pos + (reverse ? delta : -delta));
      applyPos(posRef.current);
      dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS;
    },
    [axis, reverse, wrap, posRef, applyPos],
  );

  const onDragPointerUp = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // A real drag ends over a chip → swallow the synthetic click so the drag
    // doesn't fire the chip's action.
    if (dragMovedRef.current) suppressClickRef.current = true;
    dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS;
    // Only ever captured past the drag threshold (see `onDragPointerMove`).
    if (dragMovedRef.current) {
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* best-effort */
      }
    }
  }, []);

  // Pre-threshold presses hold NO pointer capture, so a pointer that leaves the
  // wall before becoming a drag would never deliver its `pointerup` here and
  // `draggingRef` would stay stuck true — freezing the marquee forever. End the
  // gesture on leave; a captured (real) drag keeps running, capture guarantees
  // its own pointerup.
  const onDragPointerLeave = useCallback(
    (e: PointerEvent) => {
      onPointerLeave(e);
      if (draggingRef.current && !dragMovedRef.current) draggingRef.current = false;
    },
    [onPointerLeave],
  );

  const onDragClickCapture = useCallback((e: MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Along-axis wheel → move the wall. Wired as a NATIVE non-passive listener
  // (not React's `onWheel`, which React attaches passively so `preventDefault`
  // is a no-op): once WE consume an along-axis wheel we must `preventDefault` to
  // suppress the browser's horizontal history-swipe (two-finger trackpad) on an
  // x-wall. An x-wall ignores vertical page-scroll wheels (and vice-versa) so the
  // surrounding page still scrolls normally.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !dragScroll || !marqueeMounted) return undefined;
    const onWheel = (e: WheelEvent) => {
      // Only claim the DOMINANT-axis wheel (per axis), so a cross-axis wheel
      // still scrolls the page: an x-wall ignores vertical wheels, a y-wall
      // ignores horizontal ones.
      const primary =
        axis === 'y'
          ? Math.abs(e.deltaY) >= Math.abs(e.deltaX)
            ? e.deltaY
            : 0
          : Math.abs(e.deltaX) >= Math.abs(e.deltaY)
            ? e.deltaX
            : 0;
      if (primary === 0) return;
      e.preventDefault();
      // Via `applyPos` (not raw `applyTransform`) so synced peer walls follow.
      posRef.current = wrap(posRef.current + (reverse ? -primary : primary));
      applyPos(posRef.current);
      dragSuppressUntilRef.current = performance.now() + DRAG_RESUME_MS;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dragScroll, marqueeMounted, axis, reverse, wrap, posRef, applyPos]);

  // ---- render ----------------------------------------------------------------
  const renderContent = (isClone: boolean) => (typeof children === 'function' ? children({ isClone }) : children);

  // Reduced-motion static fallback: when the marquee does NOT mount (chiefly
  // prefers-reduced-motion) but the content OVERFLOWS, the drag/transform path
  // is inert — so on a `dragScroll` wall fall back to NATIVE
  // overflow scroll along the axis. Otherwise the overflowing chips would be
  // clipped by `overflow-hidden` with no way to reach them (a11y regression vs
  // the old wrapping row). The scrollbar itself stays hidden (`scrollbar-hide`)
  // so the static wall matches the marquee's chrome-free look — native wheel
  // and touch scrolling still work (the transform-based drag path is gated on
  // `marqueeMounted`, so pointer drag is marquee-only). No engine needed — the
  // browser scrolls the single static track.
  const staticScrollable = dragScroll && overflows && !marqueeMounted;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative',
        staticScrollable ? (axis === 'y' ? 'overflow-y-auto' : 'overflow-x-auto') : 'overflow-hidden',
        staticScrollable && 'scrollbar-hide',
        dragScroll && marqueeMounted && 'cursor-grab select-none active:cursor-grabbing',
        className,
      )}
      // x-walls let vertical page-scroll pass (`pan-y`) and own horizontal
      // drags; y-walls the reverse. Only when drag is actually live.
      style={dragScroll && marqueeMounted ? { touchAction: axis === 'y' ? 'pan-x' : 'pan-y' } : undefined}
      data-marquee-track={trackId}
      onPointerEnter={onPointerEnter}
      onPointerLeave={dragScroll ? onDragPointerLeave : onPointerLeave}
      onPointerDown={dragScroll ? onDragPointerDown : undefined}
      onPointerMove={dragScroll ? onDragPointerMove : undefined}
      onPointerUp={dragScroll ? onDragPointerUp : undefined}
      onPointerCancel={dragScroll ? onDragPointerUp : undefined}
      onClickCapture={dragScroll ? onDragClickCapture : undefined}
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
      {mode === 'animated' && overflows && <MarqueeWallFades fade={fade} fadeColor={fadeColor} fadeSize={fadeSize} />}
    </div>
  );
}
