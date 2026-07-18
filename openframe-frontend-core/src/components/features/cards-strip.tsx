"use client";

/**
 * <CardsStrip> — THE horizontal card-strip engine (single source of truth).
 *
 * Extracted verbatim from <VideoBitesStrip> so every strip surface shares ONE
 * marquee/chevron/seam/measure implementation ("unify means delete
 * variations"). Two input modes, one engine:
 *
 *   MODE A — render-prop (`items` + `itemKey` + `renderCard`): full control.
 *   The card receives the strip context (controlled activation, clone flag,
 *   shared player-mount gate) and owns its own clone a11y. Used by
 *   <VideoBitesStrip>. The engine adds NO cell wrapper in this mode — the
 *   card's root is the track's direct child (`scrollByCard` measures
 *   `track.firstElementChild.offsetWidth`, and the `flex items-stretch gap-4`
 *   sizing contract depends on it).
 *
 *   MODE B — children (organic): ANY card components as plain JSX children.
 *   Each child is auto-wrapped in a managed cell (fixed width, hover/keyboard
 *   marquee-pause, clone `aria-hidden` + focus-suppressed but still CLICKABLE,
 *   row-height stretch).
 *   Adding a new card type requires ZERO strip code. Contract:
 *   (a) pass an ARRAY of children (`{rows.map(...)}`) — `Children.toArray`
 *       does NOT flatten through a single <Fragment> child (it would become
 *       one giant cell; a dev-only warning fires);
 *   (b) when `autoScroll` is on, children must be ref-free / unique-DOM-id-
 *       free / mount-effect-free — the clone copy mounts the same element a
 *       second time (double-fired effects, duplicate ids, last-mounted ref).
 *
 * Activation invariant: hover/focus activation is wired in exactly ONE place —
 * the managed cell (children mode) OR the card itself (render-prop mode,
 * e.g. <VideoBiteCard>) — never both.
 *
 * Marquee state model (explicit — do not "simplify" into one timer):
 * the rAF advances only when the pause-reason set {cardHovered, offViewport,
 * tabHidden, reducedMotion} is empty AND `now > max(chevronSuppressUntil,
 * userScrollSuppressUntil)`. cardHovered means the pointer is over a CARD
 * (incl. its overlay) — leaving the card resumes the marquee immediately.
 * Chevron clicks and manual wheel/touch each set their own suppress-until
 * timestamp; any card-level leave-grace is a separate concern that never
 * touches marquee state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { NEAR_VIEWPORT_ROOT_MARGIN } from '../../hooks/use-near-viewport';
import { useMarqueeEngine } from '../../hooks/ui/use-marquee-engine';
import { useSuppressCloneFocus } from '../../hooks/ui/use-suppress-clone-focus';
import { Button } from '../ui/button';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';

// =============================================================================
// Types
// =============================================================================

/** Per-card strip context passed to `renderCard` (and used internally by the
 *  children-mode managed cell). */
export interface CardStripRenderCtx {
  /** Item index (copy-independent — the clone copy repeats the same indices). */
  index: number;
  /** `${itemKey}__${copyIndex}__${index}` — unique per rendered card, even for
   *  duplicate items (the trailing index disambiguates). */
  cardKey: string;
  isClone: boolean;
  isTouch: boolean;
  /** Engine's (max-width: 767px) media query. */
  isMobile: boolean;
  /** activeKey === cardKey (controlled hover/focus activation). */
  active: boolean;
  onActivate: (key: string) => void;
  onDeactivate: (key: string) => void;
  /** Shared-by-index 500px near-viewport gate (opt-in — only meaningful when
   *  the card registers via `rootRef`). */
  mounted: boolean;
  /** Registers the card root with the mount-gate IntersectionObserver.
   *  May return a cleanup (React 19 ref contract). */
  rootRef: (el: HTMLDivElement | null) => (() => void) | undefined;
}

interface CardsStripEngineProps {
  /** Section heading. Omit `title` (or set `showTitle={false}`) to hide. */
  title?: string;
  showTitle?: boolean;
  /** Custom node rendered between the heading and the strip. */
  headerSlot?: React.ReactNode;
  /** Marquee auto-scroll. Auto-disabled on no-overflow and
   *  prefers-reduced-motion. Pass `autoScroll={false}` for chevron-style
   *  entity strips — the default stays `true` for bites-contract parity. */
  autoScroll?: boolean;
  /** Marquee speed in px/s. Default 60 — marquee libraries (e.g. GSAP marquee)
   *  default around 100px/s; 60 keeps drift lively while cards stay easy to
   *  hover-target. 60px/s ≈ 1px per 60Hz frame, the smoothest integer step. */
  autoScrollSpeed?: number;
  /** Pause the marquee while a CARD is hovered (resumes as soon as the
   *  pointer leaves the card — strip whitespace/heading never pauses). */
  pauseOnHover?: boolean;
  /** Floating prev/next buttons. Hidden automatically when nothing overflows. */
  showChevrons?: boolean;
  /** Chevron aria-labels. */
  prevLabel?: string;
  nextLabel?: string;
  /** Merged into the engine's wrapper ref (e.g. `useVideoWarmup().ref`). */
  rootRef?: (el: HTMLDivElement | null) => void;
  className?: string;
}

// The two mode interfaces hand-mirror each other's field names as `never` —
// INVARIANT: every field added to one mode gets a `never` twin in the other,
// or the XOR discrimination silently weakens (mixed-mode props become
// assignable). Same manual pattern as social-icon-row.tsx / chart.tsx.

/** MODE A — render-prop (advanced): full ctx control, no cell wrapper. */
interface RenderCardMode<T> {
  items: ReadonlyArray<T>;
  itemKey: (item: T, index: number) => string;
  renderCard: (item: T, ctx: CardStripRenderCtx) => React.ReactNode;
  children?: never;
  cardWidthDesktop?: never;
  cardWidthMobile?: never;
}

/** MODE B — children (organic): ANY card components, zero registration. */
interface ChildrenMode {
  children: React.ReactNode;
  /** Managed cell width in px per breakpoint (Figma: 400 desktop). */
  cardWidthDesktop?: number;
  cardWidthMobile?: number;
  items?: never;
  itemKey?: never;
  renderCard?: never;
}

export type CardsStripProps<T = unknown> = CardsStripEngineProps & (RenderCardMode<T> | ChildrenMode);

// =============================================================================
// Constants
// =============================================================================

// Gap between cards (px) — keep in sync with the track's `gap-4`.
const TRACK_GAP_PX = 16;
// Marquee suppression windows after manual interaction.
const CHEVRON_SUPPRESS_MS = 4000;
const USER_SCROLL_SUPPRESS_MS = 3000;

/** Single source for the strip cell width cap (shared with <VideoBiteCard>). */
export const STRIP_CELL_MAX_WIDTH = '90vw';

const EMPTY_CHILDREN: ReadonlyArray<React.ReactNode> = [];

// =============================================================================
// Children-mode managed cell
// =============================================================================

// (Clone focus suppression lives in hooks/ui/use-suppress-clone-focus — shared
// with <MarqueeWall>, which renders the same 2-copy endless-loop structure.)

/**
 * Children-mode cell: fixed width + hover/keyboard activation (wired here, never
 * on the card — the single-place activation invariant). The OUTER cell is never
 * inert/aria-hidden — an inert cell would retarget its pointer events to the
 * track and defeat the clone hover-pause; the INNER wrapper carries the clone
 * a11y treatment.
 */
function ManagedCell({
  item,
  ctx,
  cardWidthMobile,
  cardWidthDesktop,
}: {
  item: unknown;
  ctx: CardStripRenderCtx;
  cardWidthMobile: number;
  cardWidthDesktop: number;
}) {
  // Per-child DESKTOP cell-width hint: heterogeneous card designs need
  // heterogeneous cells (wide horizontal cards vs 400px vertical cards —
  // variable widths are native to the engine, exactly like bite ratios). Read
  // from the child ELEMENT's `data-strip-cell-width` prop; mobile keeps the
  // strip-level width (wide cards stack vertically below md anyway).
  const hintedWidth = React.isValidElement(item)
    ? (item.props as Record<string, unknown>)['data-strip-cell-width']
    : undefined;
  const desktopWidth = typeof hintedWidth === 'number' ? hintedWidth : cardWidthDesktop;
  const cloneRef = useSuppressCloneFocus(ctx.isClone);
  return (
    <div
      className="shrink-0 self-stretch"
      style={{ width: ctx.isMobile ? cardWidthMobile : desktopWidth, maxWidth: STRIP_CELL_MAX_WIDTH }}
      data-strip-card-key={ctx.cardKey}
      onPointerEnter={ctx.isTouch ? undefined : () => ctx.onActivate(ctx.cardKey)}
      onPointerLeave={ctx.isTouch ? undefined : () => ctx.onDeactivate(ctx.cardKey)}
      // Keyboard pause parity (focus bubbles from the card's anchor; WCAG 2.2.2).
      onFocus={() => ctx.onActivate(ctx.cardKey)}
      onBlur={e => {
        // Intra-cell focus moves must not blip the pause off.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        ctx.onDeactivate(ctx.cardKey);
      }}
    >
      {/* INNER: clone a11y — `aria-hidden` + focusable descendants forced out of
          the tab order (useSuppressCloneFocus), but pointer events preserved so
          a visible clone card stays clickable. Cards untouched. */}
      <div
        ref={cloneRef}
        className="h-full [&>*]:h-full [&>a>*]:h-full"
        aria-hidden={ctx.isClone || undefined}
      >
        {item as React.ReactNode}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function CardsStrip<T = unknown>(props: CardsStripProps<T>): React.ReactElement | null {
  const {
    title,
    showTitle = true,
    headerSlot,
    autoScroll = true,
    autoScrollSpeed = 60,
    pauseOnHover = true,
    showChevrons = true,
    prevLabel = 'Previous items',
    nextLabel = 'Next items',
    rootRef,
    className,
  } = props;

  // ---- input-mode normalization ---------------------------------------------
  // Children mode feeds the SAME engine path as render-prop mode — one
  // track/clone/measure/scroll implementation. Engine internals operate on the
  // erased item type (`unknown`); the only assertions live at this seam.
  const childrenMode = props.renderCard === undefined;
  const childItems = useMemo(
    () => (childrenMode ? React.Children.toArray(props.children) : EMPTY_CHILDREN),
    [childrenMode, props.children],
  );
  const items: ReadonlyArray<unknown> = childrenMode ? childItems : props.items;
  const cardWidthDesktop = childrenMode ? (props.cardWidthDesktop ?? 400) : 0;
  const cardWidthMobile = childrenMode ? (props.cardWidthMobile ?? 320) : 0;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !childrenMode) return;
    const only = childItems.length === 1 ? childItems[0] : null;
    if (React.isValidElement(only) && only.type === React.Fragment) {
      console.warn(
        '[CardsStrip] A single <Fragment> child becomes ONE giant cell — pass an array of card elements ({rows.map(...)}) instead.',
      );
    }
  }, [childrenMode, childItems]);

  const getItemKey = (item: unknown, index: number): string => {
    if (!childrenMode) {
      // Seam assertion: T is erased inside the engine; the props union
      // guarantees itemKey matches the items array.
      return (props.itemKey as (item: unknown, index: number) => string)(item, index);
    }
    // Children.toArray always assigns element keys ('.0' / '.$slug' — stable
    // across renders); explicit null-check because `&&`/`??` chaining yields
    // the string "false" for non-element children (same isValidElement guard
    // as steps.tsx).
    return React.isValidElement(item) && item.key != null ? String(item.key) : String(index);
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // ---- environment ----------------------------------------------------------
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const subs: Array<() => void> = [];
    const watch = (query: string, set: (v: boolean) => void) => {
      const mq = window.matchMedia(query);
      set(mq.matches);
      const onChange = (e: MediaQueryListEvent) => set(e.matches);
      mq.addEventListener('change', onChange);
      subs.push(() => mq.removeEventListener('change', onChange));
    };
    watch('(prefers-reduced-motion: reduce)', setReducedMotion);
    watch('(hover: none)', setIsTouch);
    watch('(max-width: 767px)', setIsMobile);
    return () => subs.forEach(fn => fn());
  }, []);

  // ---- overflow measurement ---------------------------------------------------
  // TWO overflow states on purpose: `overflows` (any real overflow) gates
  // chevrons — a strip clipping even a few px must stay navigable —
  // while `marqueeEligible` (overflow beyond the joining gap) additionally
  // gates cloning + rAF: the cloned track's physical maxScroll is
  // 2·copy − gap − viewport, so a copy overflowing by less than the gap
  // makes even the zero-buffer wrap range [0, copy) unreachable — the
  // engine would clamp at the track end and freeze. Razor-thin overflow
  // (≤16px) stays a static, chevron-navigable row instead.
  const [overflows, setOverflows] = useState(false);
  const [marqueeEligible, setMarqueeEligible] = useState(false);
  const singleCopyWidthRef = useRef(0);
  const marqueeActive = autoScroll && !reducedMotion && marqueeEligible && items.length > 0;

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    // When clones are rendered the track is 2× one copy (+ one joining gap).
    const copies = track.dataset.copies === '2' ? 2 : 1;
    const singleCopy = copies === 2 ? (track.scrollWidth - TRACK_GAP_PX) / 2 + TRACK_GAP_PX : track.scrollWidth;
    singleCopyWidthRef.current = singleCopy;
    setOverflows(singleCopy > scroller.clientWidth + 1);
    setMarqueeEligible(singleCopy > scroller.clientWidth + TRACK_GAP_PX);
  }, []);

  useEffect(() => {
    measure();
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure, items.length, marqueeActive, isMobile]);

  // ---- pause-reason set + suppress timestamps ---------------------------------
  // (Card hover — the only hover-based pause reason — lives in activeKeyRef below.)
  const chevronSuppressUntilRef = useRef(0);
  const userScrollSuppressUntilRef = useRef(0);

  // Two-way viewport gate (unlike the fire-once `useNearViewport`): STATE,
  // not a pause reason — it gates the engine's `active` so the rAF fully
  // stops while the strip is far off-screen (a paused engine would keep
  // scheduling frames forever), and because the velocity envelope persists
  // across engine restarts, scrolling back resumes at cruise speed instantly.
  const [nearViewport, setNearViewport] = useState(true);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => setNearViewport(entries[0]?.isIntersecting ?? true),
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- hover / overlay state -----------------------------------------------------
  // activeKey identifies the hovered/tap-activated CARD (copy-aware so hovering
  // a clone near the wrap seam works too). It only drives per-card `active`
  // state — any heavier behavior (players, overlays) is the card's concern.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Ref mirror for the rAF loop: the marquee pauses ONLY while a CARD is
  // hovered (activeKey set) — hovering strip whitespace/heading does not
  // pause, and leaving a card resumes immediately.
  const activeKeyRef = useRef<string | null>(null);
  const activate = useCallback((key: string) => {
    activeKeyRef.current = key;
    setActiveKey(key);
  }, []);
  const deactivate = useCallback((key: string) => {
    // Ref write hoisted OUT of the state updater: React re-invokes queued
    // updaters at render time, so an impure updater could re-null the ref
    // AFTER a same-batch activate(B) already set it (leave(A)+enter(B) in one
    // dispatch when the pointer jumps directly between cells) — stranding the
    // rAF pause check while a card is visibly hovered.
    if (activeKeyRef.current === key) activeKeyRef.current = null;
    setActiveKey(current => (current === key ? null : current));
  }, []);

  // ---- container-level hover pause + pointer-tracked activation sync ---------
  // TWO separate concerns, deliberately decoupled (matches how production
  // marquees — react-fast-marquee, GSAP — behave):
  //
  // 1. MARQUEE PAUSE is container-level: `hoverPointerRef.inside` is true
  //    whenever a hover-capable pointer is over the SCROLLER (the cards row).
  //    The rAF freezes on it, so content NEVER auto-moves under a pointing
  //    cursor — which is what made per-card boundary pausing feel flaky
  //    (cards sliding under/away from a stationary pointer don't emit
  //    pointerenter/leave, gaps caused stutter-steps, seam warps swapped the
  //    hovered card's identity mid-playback).
  //
  // 2. CARD ACTIVATION (overlay + video playback) stays per-card: the card/
  //    cell pointer handlers are the zero-latency path, and the
  //    elementFromPoint sync below re-resolves the card under the pointer
  //    whenever the track moves WHILE the pointer is inside (user wheel
  //    scroll, chevron glide, seam warp) — scoped to THIS strip's scroller so
  //    stacked strips can never activate/pause each other.
  const hoverPointerRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const lastHoverSyncScrollRef = useRef(-1);
  const syncHoverToPointer = useCallback(() => {
    const p = hoverPointerRef.current;
    if (!p.inside) return;
    const el = typeof document !== 'undefined' ? document.elementFromPoint(p.x, p.y) : null;
    const cardEl = el?.closest?.('[data-strip-card-key]') as HTMLElement | null;
    // Strip-scoped: a card from ANOTHER CardsStrip under the tracked point
    // must read as "no card here" (stacked strips share the viewport).
    const scoped = cardEl && scrollerRef.current?.contains(cardEl) ? cardEl : null;
    const key = scoped?.getAttribute('data-strip-card-key') ?? null;
    const current = activeKeyRef.current;
    if (key === current) return;
    if (current !== null) deactivate(current);
    if (key !== null) activate(key);
  }, [activate, deactivate]);
  // Hover-capable pointers only (mouse/pen) — touch drags must not fake hover.
  const onHoverPointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    hoverPointerRef.current = { x: e.clientX, y: e.clientY, inside: true };
  }, []);
  const onHoverPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    hoverPointerRef.current = { x: e.clientX, y: e.clientY, inside: true };
  }, []);
  const onHoverPointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    hoverPointerRef.current.inside = false;
    // The pointer left the whole scroller — no card can be hovered anymore
    // (covers leave events swallowed by DOM churn under the cursor).
    const current = activeKeyRef.current;
    if (current !== null) deactivate(current);
  }, [deactivate]);
  /** Re-sync hover only when the track actually moved under the pointer.
   *  KNOWN HOT-PATH COST (intentional): while the marquee runs with the
   *  pointer parked over strip whitespace (no card → not paused), scrollLeft
   *  changes every frame, so this invokes `document.elementFromPoint` ~60×/s
   *  — a synchronous hit-test. It's inherent to detecting a card sliding
   *  under a stationary cursor; any throttle trades hover latency for it.
   *  Revisit only if profiling flags it on pages with many stacked strips. */
  const syncHoverIfScrolled = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (scroller.scrollLeft === lastHoverSyncScrollRef.current) return;
    lastHoverSyncScrollRef.current = scroller.scrollLeft;
    syncHoverToPointer();
  }, [syncHoverToPointer]);

  // ---- marquee rAF engine (shared core) ---------------------------------------
  // Position/envelope/wrap/glide live in `useMarqueeEngine` — THE marquee
  // animation, shared with <MarqueeWall> (quick-action walls, chip marquees).
  // CardsStrip contributes the scroller driver (apply/readBack on scrollLeft:
  // the user can also drag this surface) and its pause-reason set: container-
  // level hover (industry-standard — content must never move under a pointing
  // cursor; per-card activeKey still pauses for keyboard focus), hidden tab,
  // and the chevron / user-scroll suppress windows. Chevron GLIDE
  // runs through the engine too: browser `scrollBy({behavior:'smooth'})`
  // animates toward an ABSOLUTE target, so a seam warp mid-animation made it
  // lunge a full copy-width to catch up, warp again, and oscillate.
  // Seam-warp BUFFER: the re-center zones sit this far inside the physical
  // track edges. An exact-edge check (`scrollLeft <= 0`) is racy against the
  // engine — the rAF nudges the scroller off 0 before the scroll handler
  // samples it, so a user scrolling left "sticks" 1–2px from the edge and
  // the loop never wraps. The engine's wrap range is aligned to
  // [buffer, buffer + copy) so engine-written positions can never enter a
  // zone and ping-pong with the handler. The buffer is ALSO capped by the
  // physical slack (copy − viewport − gap): the range's upper end
  // buffer + copy must stay reachable below maxScroll = 2·copy − gap −
  // viewport, or a barely-overflowing strip clamps at the track end and the
  // wrap threshold is never crossed — a permanently frozen marquee.
  const seamBuffer = useCallback(() => {
    const half = singleCopyWidthRef.current;
    const viewport = scrollerRef.current?.clientWidth ?? 0;
    return Math.max(0, Math.min(200, half / 4, half - viewport - TRACK_GAP_PX - 1));
  }, []);

  const { posRef: marqueePosRef, glideBy } = useMarqueeEngine({
    // Viewport gates `active` (the rAF fully stops off-screen — a paused
    // engine would keep scheduling frames forever), same treatment as
    // <MarqueeWall>; the envelope persists, so re-entry resumes at cruise.
    active: marqueeActive && nearViewport,
    speed: autoScrollSpeed,
    isPaused: now =>
      (pauseOnHover && (hoverPointerRef.current.inside || activeKeyRef.current !== null)) ||
      document.visibilityState === 'hidden' ||
      now < Math.max(chevronSuppressUntilRef.current, userScrollSuppressUntilRef.current),
    getWrapSize: () => singleCopyWidthRef.current,
    getWrapMin: seamBuffer,
    apply: pos => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollLeft = pos;
    },
    readBack: () => scrollerRef.current?.scrollLeft ?? 0,
    onAfterFrame: syncHoverIfScrolled,
  });

  // ---- shared card-mount gate (by ITEM index, across both copies) -------------
  // A card and its clone show identical content half a copy-width apart. If
  // each card gated its own expensive content (e.g. video players), a seam warp
  // instantly swapped the visible copy for cards whose content was NOT mounted
  // yet — every wrap crossing flashed placeholders. Mounting by INDEX (near in
  // EITHER copy → both copies mount) makes the warp pixel-identical. Opt-in:
  // cards that never register via ctx.rootRef incur no per-card observation.
  const [mountedIdx, setMountedIdx] = useState<ReadonlySet<number>>(() => new Set());
  const cardObserverRef = useRef<IntersectionObserver | null>(null);
  const cardElIdxRef = useRef(new Map<Element, number>());
  const cardElNearRef = useRef(new Map<Element, boolean>());
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) cardElNearRef.current.set(e.target, e.isIntersecting);
      const next = new Set<number>();
      cardElNearRef.current.forEach((near, el) => {
        if (!near) return;
        const idx = cardElIdxRef.current.get(el);
        if (idx !== undefined) next.add(idx);
      });
      setMountedIdx(prev => {
        if (prev.size === next.size) {
          let same = true;
          next.forEach(i => { if (!prev.has(i)) same = false; });
          if (same) return prev;
        }
        return next;
      });
    }, { rootMargin: NEAR_VIEWPORT_ROOT_MARGIN });
    cardObserverRef.current = io;
    cardElIdxRef.current.forEach((_idx, el) => io.observe(el));
    return () => { io.disconnect(); cardObserverRef.current = null; };
  }, []);
  // Stable per-index ref callbacks (a fresh closure per render would detach/
  // re-attach the observer every render). React 19 ref-cleanup unregisters.
  const cardRefFnsRef = useRef(new Map<number, (el: HTMLDivElement | null) => (() => void) | undefined>());
  const getCardRef = useCallback((idx: number) => {
    let fn = cardRefFnsRef.current.get(idx);
    if (!fn) {
      fn = (el: HTMLDivElement | null) => {
        if (!el) return undefined;
        cardElIdxRef.current.set(el, idx);
        cardObserverRef.current?.observe(el);
        return () => {
          cardElIdxRef.current.delete(el);
          cardElNearRef.current.delete(el);
          cardObserverRef.current?.unobserve(el);
        };
      };
      cardRefFnsRef.current.set(idx, fn);
    }
    return fn;
  }, []);

  // ---- manual navigation -----------------------------------------------------------
  const scrollByCard = useCallback((dir: 1 | -1) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const step = (firstCard?.offsetWidth ?? 320) + TRACK_GAP_PX;
    chevronSuppressUntilRef.current = performance.now() + CHEVRON_SUPPRESS_MS;
    if (marqueeActiveRef.current) {
      // Wrap-aware glide via the rAF engine (see engine comment) — clicks
      // accumulate distance instead of racing browser smooth-scroll targets.
      glideBy(dir * step);
    } else {
      // No clones/seam without the marquee — native smooth scroll is safe.
      scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
  }, [glideBy]);

  const onUserScrollIntent = useCallback(() => {
    userScrollSuppressUntilRef.current = performance.now() + USER_SCROLL_SUPPRESS_MS;
  }, []);
  // Suppress ONLY on genuine horizontal-scroll intent. Vertical page-scroll
  // wheel events over the strip and plain clicks (pointerdown) used to arm the
  // 3s suppression — the "marquee resumes only after a delay" bug.
  const onWheelIntent = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) onUserScrollIntent();
  }, [onUserScrollIntent]);
  const onPointerDownIntent = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') onUserScrollIntent();
  }, [onUserScrollIntent]);

  // Never-ending strip: re-center across the clone seam on EVERY scroll
  // (manual wheel/drag/chevron included — the rAF only wraps while the
  // marquee runs, so without this a user scrolling during a pause/suppress
  // window hits the physical track edges). Both copies render identical
  // content, so a ±half jump is pixel-invisible. ZONES, not exact edges:
  // below `buffer` warp forward (+half, lands under half+buffer — outside
  // the other zone, so the pair is hysteresis-stable), at/above
  // half+buffer warp back (−half, lands at ≥buffer). The user can never
  // reach a physical edge in either direction, and the racy "observe
  // exactly 0" check that stuck leftward scrolling is gone. Initial rest at
  // 0 warps once to `half` — pixel-identical, and it buys leftward headroom
  // immediately.
  const marqueeActiveRef = useRef(false);
  marqueeActiveRef.current = marqueeActive;
  const onSeamWarp = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Every scroll (native wheel/drag, smooth chevron scroll, marquee) moves
    // cards under a possibly-stationary pointer — re-resolve hover regardless
    // of marquee state (pointerenter/leave never fire for track motion).
    syncHoverIfScrolled();
    if (!marqueeActiveRef.current) return;
    const half = singleCopyWidthRef.current;
    if (half <= 0) return;
    const buffer = seamBuffer();
    let sl = scroller.scrollLeft;
    if (sl >= half + buffer) {
      sl -= half;
      scroller.scrollLeft = sl;
      marqueePosRef.current = sl;
    } else if (sl < buffer) {
      sl += half;
      scroller.scrollLeft = sl;
      marqueePosRef.current = sl;
    }
  }, [syncHoverIfScrolled, seamBuffer]);

  // ---- render ----------------------------------------------------------------

  const renderItem = (item: unknown, ctx: CardStripRenderCtx): React.ReactNode => {
    if (!childrenMode) {
      // Seam assertion (see normalization comment above).
      return (props.renderCard as (item: unknown, ctx: CardStripRenderCtx) => React.ReactNode)(item, ctx);
    }
    // Managed cell — the ONLY place cell width / activation / clone a11y are
    // encoded for children mode (extracted to a component so the clone
    // focus-suppression hook can run per cell; see ManagedCell).
    return (
      <ManagedCell
        item={item}
        ctx={ctx}
        cardWidthMobile={cardWidthMobile}
        cardWidthDesktop={cardWidthDesktop}
      />
    );
  };

  if (items.length === 0) return null;

  const copies = marqueeActive ? 2 : 1;

  return (
    <div
      ref={node => { wrapperRef.current = node; rootRef?.(node); }}
      className={cn('flex flex-col gap-6 w-full min-w-0', className)}
    >
      {showTitle && title && (
        <h2 className={`${SECTION_HEADING_CLASS} break-words`}>{title}</h2>
      )}
      {headerSlot}

      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={onWheelIntent}
          onTouchStart={onUserScrollIntent}
          onPointerDown={onPointerDownIntent}
          onPointerEnter={onHoverPointerEnter}
          onPointerMove={onHoverPointerMove}
          onPointerLeave={onHoverPointerLeave}
          onScroll={onSeamWarp}
        >
          <div ref={trackRef} data-copies={copies} className="flex w-max items-stretch gap-4">
            {Array.from({ length: copies }, (_, copyIndex) =>
              items.map((item, i) => {
                const key = `${getItemKey(item, i)}__${copyIndex}__${i}`;
                const isClone = copyIndex === 1;
                return (
                  // Clone copy a11y (aria-hidden + no focusable descendants —
                  // WCAG) is the card's job in render-prop mode (via
                  // ctx.isClone) and the managed cell's job in children mode.
                  // The engine itself adds no wrapper here in render-prop mode
                  // so the card root stays the track's direct child.
                  <React.Fragment key={key}>
                    {renderItem(item, {
                      index: i,
                      cardKey: key,
                      isClone,
                      isTouch,
                      isMobile,
                      active: activeKey === key,
                      onActivate: activate,
                      onDeactivate: deactivate,
                      mounted: mountedIdx.has(i),
                      rootRef: getCardRef(i),
                    })}
                  </React.Fragment>
                );
              }),
            )}
          </div>
        </div>

        {showChevrons && overflows && (
          <>
            {/* Shared design-system Button: outline surface (ods-card + border,
                the Figma button-icon look) + the square `icon` size, which owns
                the centered 24px glyph. Icon-only → aria-label required. */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={prevLabel}
              onClick={() => scrollByCard(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
              leftIcon={<Chevron02LeftIcon />}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={nextLabel}
              onClick={() => scrollByCard(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
              leftIcon={<Chevron02RightIcon />}
            />
          </>
        )}
      </div>
    </div>
  );
}
