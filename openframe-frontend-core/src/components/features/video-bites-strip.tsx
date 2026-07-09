"use client";

/**
 * <VideoBitesStrip> — THE unified public video-bites surface (Figma
 * "Hero Section" node 4033-90364). Replaces the old aspect-ratio grid
 * (`<VideoBitesDisplay>` is now a deprecated shim over this).
 *
 * One horizontal strip of uniform-height cards:
 *   - continuous marquee auto-scroll (rAF over native `scrollLeft` so the
 *     position stays scrubbable for chevrons + mid-track pause; the CSS
 *     keyframe engine in `quick-action-marquee.tsx` can't do either — we
 *     reuse ONLY its WCAG clone pattern: track rendered twice, clone copy
 *     `aria-hidden` with no focusable descendants)
 *   - hover = bottom-docked detail overlay + muted chromeless autoplay
 *     preview + marquee pause
 *   - profile / description-slot / navigation injection via props
 *   - the `<Video>` Mux SSoT is the only player primitive used
 *
 * Perf contract: each card renders the REAL player (first frame + center
 * play control — every card looks and behaves like any other video surface)
 * while the card is within ~500px of the viewport, via a TWO-WAY
 * IntersectionObserver: players mount as cards approach and UNMOUNT again
 * once the marquee carries them far off-screen. Live player count is
 * therefore bounded by the visible strip width (+margin), not by list
 * length or clone count. Playback itself starts only on hover
 * (`<Video playOnHover>` — sound at 50%, muted fallback).
 *
 * Marquee state model (explicit — do not "simplify" into one timer):
 * the rAF advances only when the pause-reason set {cardHovered, offViewport,
 * tabHidden, reducedMotion} is empty AND `now > max(chevronSuppressUntil,
 * userScrollSuppressUntil)`. cardHovered means the pointer is over a CARD
 * (incl. its overlay) — leaving the card resumes the marquee immediately. Chevron clicks and manual wheel/touch each set
 * their own suppress-until timestamp; the player leave-grace is a separate
 * concern that never touches marquee state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Video } from './video';
import { useVideoWarmup } from './use-video-warmup';
import { detectAspectRatio, RATIO_TO_CSS_ASPECT, ratioToCategory } from './video-ratio-tabs';
import type { VideoTeaserWithRatio } from './video-ratio-tabs';
import {
  DEFAULT_VIDEO_BITES_TITLE,
  sortBitesByCreatedAtDesc,
  toStripProfile,
  type VideoBiteStripProfile,
} from './video-bites-shared';
import { UserDisplay } from '../user-display';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';

// NOTE: the title constant / profile adapter / sort comparator live in the
// server-safe leaf `video-bites-shared.ts` (its own published subpath). The
// features barrel exports both modules — do NOT re-export the leaf from here
// (duplicate `export *` names make the barrel exports ambiguous).

// =============================================================================
// Types
// =============================================================================

/** Extends VideoTeaserWithRatio — aspect_ratio is INHERITED, never re-declared. */
export interface VideoBiteStripItem extends VideoTeaserWithRatio {
  /** Per-bite profile override (falls back to the section-level `profile`). */
  profile?: VideoBiteStripProfile | null;
  /** Navigation target — overlay chevron renders an anchor. */
  href?: string;
  /** Navigation callback — used when `href` is absent (overlay chevron = button). */
  onNavigate?: () => void;
}

export interface VideoBitesStripProps {
  bites: ReadonlyArray<VideoBiteStripItem>;
  /** Section heading. Default: DEFAULT_VIDEO_BITES_TITLE ('Key Moments'). */
  title?: string;
  showTitle?: boolean;
  /** Filter to `published === true` bites. Default true. */
  filterPublished?: boolean;
  /** Section-level profile applied to bites without their own. */
  profile?: VideoBiteStripProfile | null;
  /** Section-level navigation target applied to bites without their own
   *  `href` — the hover overlay links to the entity the bites originated from. */
  href?: string;
  /** Custom node rendered between the heading and the strip (description slot). */
  headerSlot?: React.ReactNode;
  /** Marquee auto-scroll. Auto-disabled on no-overflow and prefers-reduced-motion. */
  autoScroll?: boolean;
  /** Marquee speed in px/s. Default 60 — marquee libraries (e.g. GSAP marquee)
   *  default around 100px/s; 60 keeps drift lively while cards stay easy to
   *  hover-target. 60px/s ≈ 1px per 60Hz frame, the smoothest integer step. */
  autoScrollSpeed?: number;
  /** Pause the marquee while a CARD is hovered (resumes as soon as the
   *  pointer leaves the card — strip whitespace/heading never pauses). */
  pauseOnHover?: boolean;
  /** Card height in px per breakpoint (Figma: 416 desktop). */
  cardHeightDesktop?: number;
  cardHeightMobile?: number;
  /** Floating prev/next buttons. Hidden automatically when nothing overflows. */
  showChevrons?: boolean;
  /** Section-level navigation fallback (per-bite `href`/`onNavigate` win). */
  onBiteNavigate?: (bite: VideoBiteStripItem, index: number) => void;
  className?: string;
}

// Gap between cards (px) — keep in sync with the track's `gap-4`.
const TRACK_GAP_PX = 16;
// Marquee suppression windows after manual interaction.
const CHEVRON_SUPPRESS_MS = 4000;
const USER_SCROLL_SUPPRESS_MS = 3000;

// =============================================================================
// Component
// =============================================================================

export function VideoBitesStrip({
  bites,
  title = DEFAULT_VIDEO_BITES_TITLE,
  showTitle = true,
  filterPublished = true,
  profile = null,
  href,
  headerSlot,
  autoScroll = true,
  autoScrollSpeed = 60,
  pauseOnHover = true,
  cardHeightDesktop = 416,
  cardHeightMobile = 300,
  showChevrons = true,
  onBiteNavigate,
  className,
}: VideoBitesStripProps): React.ReactElement | null {
  const items = useMemo(() => {
    const filtered = filterPublished ? bites.filter(b => b.published) : [...bites];
    return filtered.sort(sortBitesByCreatedAtDesc);
  }, [bites, filterPublished]);

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
  // `overflows` gates chevrons; `marqueeActive` additionally gates cloning + rAF.
  const [overflows, setOverflows] = useState(false);
  const singleCopyWidthRef = useRef(0);
  const marqueeActive = autoScroll && !reducedMotion && overflows && items.length > 0;

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    // When clones are rendered the track is 2× one copy (+ one joining gap).
    const copies = track.dataset.copies === '2' ? 2 : 1;
    const singleCopy = copies === 2 ? (track.scrollWidth - TRACK_GAP_PX) / 2 + TRACK_GAP_PX : track.scrollWidth;
    singleCopyWidthRef.current = singleCopy;
    setOverflows(singleCopy > scroller.clientWidth + 1);
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
  const nearViewportRef = useRef(true);
  const chevronSuppressUntilRef = useRef(0);
  const userScrollSuppressUntilRef = useRef(0);

  // Two-way viewport gate (unlike the fire-once `useNearViewport`): the rAF
  // should stop again when the strip scrolls far off-screen.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => { nearViewportRef.current = entries[0]?.isIntersecting ?? true; },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- marquee rAF engine ------------------------------------------------------
  // Position lives in a FLOAT ref, not in scrollLeft read-modify-write: reading
  // scrollLeft back each frame returns a rounded value, so sub-pixel increments
  // (speed/fps < 1px) get eaten by rounding — the old engine both stuttered AND
  // ran measurably slower than the configured speed because of it.
  //
  // Chevron GLIDE also runs through this engine (glideRemainingRef): browser
  // `scrollBy({behavior:'smooth'})` animates toward an ABSOLUTE target, so a
  // seam warp mid-animation made it lunge a full copy-width to catch up, warp
  // again, and oscillate — rapid chevron clicks left every card flickering.
  // The rAF tween consumes a signed remaining-distance instead, wrapping
  // modulo the copy width each frame, so warps are invisible to it.
  const marqueePosRef = useRef(0);
  const glideRemainingRef = useRef(0);
  useEffect(() => {
    if (!marqueeActive) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    let last = performance.now();
    marqueePosRef.current = scroller.scrollLeft;
    const wrap = (pos: number) => {
      const half = singleCopyWidthRef.current;
      if (half <= 0) return pos;
      while (pos >= half) pos -= half;
      while (pos < 0) pos += half;
      return pos;
    };
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000; // clamp tab-wake jumps
      last = now;
      const paused =
        (pauseOnHover && activeKeyRef.current !== null) ||
        !nearViewportRef.current ||
        document.visibilityState === 'hidden' ||
        now < Math.max(chevronSuppressUntilRef.current, userScrollSuppressUntilRef.current);
      const glide = glideRemainingRef.current;
      if (glide !== 0) {
        // Ease-out toward the chevron target; runs even while "paused"
        // (the chevron click itself sets the suppress window).
        if (Math.abs(scroller.scrollLeft - marqueePosRef.current) > 1.5) {
          marqueePosRef.current = scroller.scrollLeft;
        }
        const speed = Math.max(Math.abs(glide) * 6, 240); // px/s, proportional
        const step = Math.sign(glide) * Math.min(Math.abs(glide), speed * dt);
        glideRemainingRef.current = Math.abs(glide - step) < 0.5 ? 0 : glide - step;
        marqueePosRef.current = wrap(marqueePosRef.current + step);
        scroller.scrollLeft = marqueePosRef.current;
      } else if (!paused) {
        // Resync after external movement (user scroll, seam warp).
        if (Math.abs(scroller.scrollLeft - marqueePosRef.current) > 1.5) {
          marqueePosRef.current = scroller.scrollLeft;
        }
        marqueePosRef.current = wrap(marqueePosRef.current + autoScrollSpeed * dt);
        scroller.scrollLeft = marqueePosRef.current;
      } else {
        marqueePosRef.current = scroller.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [marqueeActive, autoScrollSpeed, pauseOnHover]);

  // ---- hover / overlay state -----------------------------------------------------
  // activeKey identifies the hovered/tap-activated CARD (copy-aware so hovering
  // a clone near the wrap seam works too). It only drives OVERLAY visibility —
  // the player is mounted per-card via near-viewport gating and plays on hover
  // through <Video playOnHover> (normal controls, no chrome fork).
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
    setActiveKey(current => {
      const next = current === key ? null : current;
      activeKeyRef.current = next;
      return next;
    });
  }, []);

  // Preconnect Mux/Supabase origins once so first hover starts fast.
  const warmup = useVideoWarmup<HTMLDivElement>({ videoUrl: items[0]?.url || null });

  // ---- shared player-mount gate (by ITEM index, across both copies) -----------
  // A card and its clone show identical content half a copy-width apart. If
  // each card gated its own player, a seam warp instantly swapped the visible
  // copy for cards whose players were NOT mounted yet — every wrap crossing
  // flashed placeholders. Mounting by INDEX (near in EITHER copy → both copies
  // mount) makes the warp pixel-identical. Live players stay bounded: ~2× the
  // visible strip width.
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
    }, { rootMargin: '500px' });
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
      glideRemainingRef.current += dir * step;
    } else {
      // No clones/seam without the marquee — native smooth scroll is safe.
      scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
  }, []);

  const onUserScrollIntent = useCallback(() => {
    userScrollSuppressUntilRef.current = performance.now() + USER_SCROLL_SUPPRESS_MS;
  }, []);

  // Never-ending strip: warp across the clone seam on EVERY scroll (manual
  // wheel/drag/chevron included — the rAF only wraps while the marquee runs,
  // so without this a user scrolling during a pause/suppress window hits the
  // physical track edges). Both copies render identical content, so a ±half
  // jump is pixel-invisible. Backward warp only when arriving AT the left
  // edge from the right (never on initial rest at 0).
  const lastScrollLeftRef = useRef(0);
  const marqueeActiveRef = useRef(false);
  marqueeActiveRef.current = marqueeActive;
  const onSeamWarp = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !marqueeActiveRef.current) return;
    const half = singleCopyWidthRef.current;
    if (half <= 0) return;
    let sl = scroller.scrollLeft;
    if (sl >= half) {
      sl -= half;
      scroller.scrollLeft = sl;
      marqueePosRef.current = sl;
    } else if (sl <= 0 && lastScrollLeftRef.current > 0.5) {
      sl += half;
      scroller.scrollLeft = sl;
      marqueePosRef.current = sl;
    }
    lastScrollLeftRef.current = sl;
  }, []);

  if (items.length === 0) return null;

  const cardHeight = isMobile ? cardHeightMobile : cardHeightDesktop;
  const copies = marqueeActive ? 2 : 1;

  return (
    <div
      ref={node => { wrapperRef.current = node; warmup.ref(node); }}
      className={cn('flex flex-col gap-6 w-full min-w-0', className)}
    >
      {showTitle && (
        <h2 className={`${SECTION_HEADING_CLASS} break-words`}>{title}</h2>
      )}
      {headerSlot}

      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={onUserScrollIntent}
          onTouchStart={onUserScrollIntent}
          onPointerDown={onUserScrollIntent}
          onScroll={onSeamWarp}
        >
          <div ref={trackRef} data-copies={copies} className="flex w-max items-stretch gap-4">
            {Array.from({ length: copies }, (_, copyIndex) =>
              items.map((bite, i) => {
                const key = `${bite.url}__${copyIndex}__${i}`;
                const isClone = copyIndex === 1;
                return (
                  // Clone copy: aria-hidden + no focusable descendants (WCAG —
                  // same rule as quick-action-marquee). Clones stay pointer-
                  // interactive (briefly visible near the wrap seam).
                  <VideoBiteCard
                    key={key}
                    bite={bite}
                    index={i}
                    cardKey={key}
                    isClone={isClone}
                    isTouch={isTouch}
                    height={cardHeight}
                    active={activeKey === key}
                    onActivate={activate}
                    onDeactivate={deactivate}
                    playerMounted={mountedIdx.has(i)}
                    rootRef={getCardRef(i)}
                    profile={bite.profile ?? profile ?? null}
                    sectionHref={href}
                    onBiteNavigate={onBiteNavigate}
                  />
                );
              }),
            )}
          </div>
        </div>

        {showChevrons && overflows && (
          <>
            {/* Solid Figma button-icon look (bg #212121 = ods-card, border soft-grey). */}
            <button
              type="button"
              aria-label="Previous videos"
              onClick={() => scrollByCard(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-md bg-ods-card border border-ods-border text-ods-text-primary hover:border-ods-accent transition-colors"
            >
              <Chevron02LeftIcon className="w-6 h-6" />
            </button>
            <button
              type="button"
              aria-label="Next videos"
              onClick={() => scrollByCard(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-md bg-ods-card border border-ods-border text-ods-text-primary hover:border-ods-accent transition-colors"
            >
              <Chevron02RightIcon className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Card — THE bite card (exported). One component for every surface: the
// public strip passes controlled hover/mount state; the admin bites editor
// renders it standalone (self-managed hover, grid-cell sizing, action slots,
// inline title editing) so the admin sees EXACTLY the public card.
// =============================================================================

export interface VideoBiteCardProps {
  bite: VideoBiteStripItem;
  index: number;
  profile?: VideoBiteStripProfile | null;
  sectionHref?: string;
  onBiteNavigate?: (bite: VideoBiteStripItem, index: number) => void;
  /** Fixed card height (strip). Omit → width-driven: card fills its grid
   *  cell and the aspect-ratio derives the height (editor grids). */
  height?: number;
  /** Controlled hover-activation (strip). Omit → the card manages its own
   *  hover/focus state. */
  active?: boolean;
  onActivate?: (key: string) => void;
  onDeactivate?: (key: string) => void;
  cardKey?: string;
  isClone?: boolean;
  isTouch?: boolean;
  /** Controlled player mount (the strip's shared-by-index gate). Omit → the
   *  card runs its own two-way near-viewport observer. */
  playerMounted?: boolean;
  /** Root-element ref hook (strip observer registration). May return a
   *  cleanup (React 19 ref contract). */
  rootRef?: (el: HTMLDivElement | null) => (() => void) | undefined;
  /** Admin action toolbar rendered BELOW the media on a solid surface —
   *  never floated over the video (white icons on a white frame fail the
   *  WCAG 3:1 non-text contrast minimum; a solid `bg-ods-card` row always
   *  passes). Editor passes publish / download / star / upload / delete. */
  toolbar?: React.ReactNode;
  /** Admin: the overlay title renders as an inline editor. */
  titleEditable?: boolean;
  onTitleChange?: (value: string) => void;
  onTitleCommit?: (value: string) => void;
  className?: string;
}

export function VideoBiteCard({
  bite,
  index,
  profile = null,
  sectionHref,
  onBiteNavigate,
  height,
  active,
  onActivate,
  onDeactivate,
  cardKey,
  isClone = false,
  isTouch = false,
  playerMounted,
  rootRef,
  toolbar,
  titleEditable = false,
  onTitleChange,
  onTitleCommit,
  className,
}: VideoBiteCardProps) {
  const cssAspect = RATIO_TO_CSS_ASPECT[ratioToCategory(detectAspectRatio(bite.aspect_ratio))];
  const targetHref = bite.href ?? sectionHref;
  const hasTarget = !!(targetHref || bite.onNavigate || onBiteNavigate);
  const key = cardKey ?? `${bite.url}__${index}`;

  // Hover activation: controlled by the strip (activeKey) or self-managed
  // when rendered standalone (admin editor).
  const controlled = active !== undefined;
  const [selfActive, setSelfActive] = useState(false);
  const isActive = controlled ? !!active : selfActive;
  const activate = () => (controlled ? onActivate?.(key) : setSelfActive(true));
  const deactivate = () => (controlled ? onDeactivate?.(key) : setSelfActive(false));

  // Player mount: controlled (strip's shared-by-index gate) or an internal
  // TWO-WAY near-viewport observer (standalone). Two-way — NOT the fire-once
  // `useNearViewport` — so players unmount again >500px away and live
  // MuxPlayer instances stay bounded.
  const gateControlled = playerMounted !== undefined;
  const rootElRef = useRef<HTMLDivElement | null>(null);
  const [isNear, setIsNear] = useState(false);
  useEffect(() => {
    if (gateControlled) return;
    const el = rootElRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => setIsNear(entries[0]?.isIntersecting ?? false),
      { rootMargin: '500px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gateControlled]);
  const showPlayer = gateControlled ? playerMounted : isNear;

  const navigate = () => {
    if (bite.onNavigate) bite.onNavigate();
    else onBiteNavigate?.(bite, index);
  };

  const handlePointerEnter = () => { if (!isTouch) activate(); };
  const handlePointerLeave = () => { if (!isTouch) deactivate(); };
  const handleClick = () => { if (isTouch && !isActive) activate(); };

  // Bottom-docked detail (Figma node 4033:90369): title row + profile row +
  // chevron affordance. The WHOLE footer is the navigation target — it links
  // to the entity the bite originated from. In the editor the title row is
  // the inline title editor (edited directly on the card).
  const titleClass = "font-['DM_Sans'] text-sm font-medium leading-5 text-ods-text-primary";
  const overlayContent = (
    <>
      {titleEditable ? (
        // Textarea, not input: the public title wraps to two lines
        // (line-clamp-2) and the editor must render identically. rows=1 +
        // auto-grow keeps short titles single-line; max-height caps at the
        // same two lines the clamp allows.
        <textarea
          value={bite.title || ''}
          placeholder="Title (optional)"
          aria-label="Bite title"
          rows={1}
          onChange={e => {
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 40)}px`;
            onTitleChange?.(e.target.value);
          }}
          ref={el => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 40)}px`;
            }
          }}
          onBlur={e => onTitleCommit?.(e.target.value)}
          onClick={e => e.stopPropagation()}
          className={cn(
            titleClass,
            'w-full max-h-10 resize-none overflow-hidden bg-transparent outline-none',
            'placeholder:text-ods-text-secondary border-b border-transparent focus:border-ods-border',
          )}
        />
      ) : (
        bite.title && <p className={cn(titleClass, 'line-clamp-2')}>{bite.title}</p>
      )}
      {(profile || hasTarget) && (
        <div className="flex items-center gap-2 min-w-0">
          {profile && (
            <UserDisplay
              name={profile.name}
              avatarUrl={profile.avatarUrl}
              subtitle={profile.subtitle}
              size={22}
              shape="round"
              compact
              className="flex-1"
            />
          )}
          {hasTarget && (
            <Chevron02RightIcon className="w-5 h-5 shrink-0 ml-auto text-ods-text-primary" />
          )}
        </div>
      )}
    </>
  );

  // Figma node 4033:90369 exactly: pure-black 75% fill (Tailwind palette
  // black — NOT a glassy backdrop blur; Figma has no background blur here),
  // full soft-grey border, p-16/gap-16, large soft drop shadow.
  const overlayClass = cn(
    'absolute inset-x-0 bottom-0 p-3 gap-2 bg-black/75 border border-ods-border shadow-2xl',
    'flex flex-col transition-opacity duration-200',
    isActive ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100',
    // Non-interactive while invisible so it never swallows clicks on the
    // resting card / player controls.
    isActive ? 'pointer-events-auto' : 'pointer-events-none group-hover/card:pointer-events-auto group-focus-within/card:pointer-events-auto',
  );

  const media = (
    <div
      className="relative w-full"
      // Strip mode: fixed height + aspect drive the width (capped at 90vw,
      // same as the old single-box layout). Editor mode: width-driven.
      style={{ aspectRatio: cssAspect, ...(height !== undefined ? { height, maxWidth: '90vw' } : {}) }}
    >
      {showPlayer ? (
        // Clones: `inert` (not just the wrapper's aria-hidden) — the player's
        // shadow-DOM center control is otherwise still tab-reachable inside a
        // hidden subtree (axe aria-hidden-focus). Hover preview on clones
        // keeps working: playback is driven imperatively from the CARD's own
        // pointer handlers, never from focus/clicks on the player chrome.
        <div className="absolute inset-0" inert={isClone || undefined}>
          {/* CONTROLLED hover playback keyed to CARD hover (`isActive`): the
              detail overlay is part of the card, so moving the pointer onto
              it keeps playing. Sound at 50% (pre-activation: muted start +
              live unmute on the user's first gesture); chrome = center
              play/pause only (Figma card look). */}
          <Video
            kind="file"
            url={bite.url}
            poster={bite.thumbnail_url}
            playWhenHovered={isActive}
            centerControlsOnly
            layout="fill"
          />
        </div>
      ) : (
        // Aspect-matched placeholder until the card nears the viewport (CLS-free).
        <div className="absolute inset-0 bg-ods-card" />
      )}

      {hasTarget && !isClone && !titleEditable ? (
        targetHref ? (
          <a href={targetHref} aria-label={`Open ${bite.title || 'source content'}`} className={overlayClass}>
            {overlayContent}
          </a>
        ) : (
          <button type="button" onClick={navigate} aria-label={`Open ${bite.title || 'source content'}`} className={cn(overlayClass, 'text-left w-full')}>
            {overlayContent}
          </button>
        )
      ) : (
        <div className={overlayClass}>{overlayContent}</div>
      )}
    </div>
  );

  return (
    <div
      ref={node => {
        rootElRef.current = node;
        return rootRef?.(node);
      }}
      aria-hidden={isClone || undefined}
      className={cn(
        'relative rounded-md border border-ods-border bg-ods-card overflow-hidden group/card',
        height !== undefined ? 'shrink-0' : 'w-full',
        className,
      )}
      style={height !== undefined ? { maxWidth: '90vw' } : undefined}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onFocus={activate}
      onBlur={deactivate}
    >
      {media}
      {toolbar && (
        // Solid-surface action row UNDER the media (WCAG non-text contrast —
        // see the `toolbar` prop doc). Part of the card, so hovering it keeps
        // hover playback alive.
        <div className="flex items-center justify-between gap-1 border-t border-ods-border bg-ods-card px-2 py-1.5">
          {toolbar}
        </div>
      )}
    </div>
  );
}
