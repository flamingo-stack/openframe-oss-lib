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
 * Perf contract: at rest, ZERO players are mounted — each card renders only
 * its lazy `thumbnail_url` poster (or a `bg-ods-card` + PlayIcon fallback).
 * The Mux player mounts ONLY while a card is hovered/focused/tap-activated,
 * and unmounts after a 150ms leave-grace (skim protection). ≤1 player alive
 * at any moment.
 *
 * Marquee state model (explicit — do not "simplify" into one timer):
 * the rAF advances only when the pause-reason set {hover, offViewport,
 * tabHidden, reducedMotion} is empty AND `now > max(chevronSuppressUntil,
 * userScrollSuppressUntil)`. Chevron clicks and manual wheel/touch each set
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
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon';
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
  /** Custom node rendered between the heading and the strip (description slot). */
  headerSlot?: React.ReactNode;
  /** Marquee auto-scroll. Auto-disabled on no-overflow and prefers-reduced-motion. */
  autoScroll?: boolean;
  /** Marquee speed in px/s. */
  autoScrollSpeed?: number;
  /** Pause the marquee while the pointer is anywhere over the strip. */
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
// Grace period before unmounting a hovered player (skim protection).
const LEAVE_GRACE_MS = 150;
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
  headerSlot,
  autoScroll = true,
  autoScrollSpeed = 28,
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
  const hoveredRef = useRef(false);
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
  useEffect(() => {
    if (!marqueeActive) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000; // clamp tab-wake jumps
      last = now;
      const paused =
        (pauseOnHover && hoveredRef.current) ||
        !nearViewportRef.current ||
        document.visibilityState === 'hidden' ||
        now < Math.max(chevronSuppressUntilRef.current, userScrollSuppressUntilRef.current);
      if (!paused) {
        scroller.scrollLeft += autoScrollSpeed * dt;
        const half = singleCopyWidthRef.current;
        if (half > 0 && scroller.scrollLeft >= half) {
          scroller.scrollLeft -= half; // seamless wrap at the clone seam
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [marqueeActive, autoScrollSpeed, pauseOnHover]);

  // ---- hover / preview state -----------------------------------------------------
  // activeKey identifies the hovered/tap-activated CARD (copy-aware so hovering
  // a clone near the wrap seam previews too). Only that card mounts a player.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activate = useCallback((key: string) => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
    setActiveKey(key);
  }, []);
  const deactivate = useCallback((key: string) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setActiveKey(current => (current === key ? null : current));
    }, LEAVE_GRACE_MS);
  }, []);
  useEffect(() => () => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current); }, []);

  // Preconnect Mux/Supabase origins once so first hover starts fast.
  const warmup = useVideoWarmup<HTMLDivElement>({ videoUrl: items[0]?.url || null });

  // ---- manual navigation -----------------------------------------------------------
  const scrollByCard = useCallback((dir: 1 | -1) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const step = (firstCard?.offsetWidth ?? 320) + TRACK_GAP_PX;
    chevronSuppressUntilRef.current = performance.now() + CHEVRON_SUPPRESS_MS;
    scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  const onUserScrollIntent = useCallback(() => {
    userScrollSuppressUntilRef.current = performance.now() + USER_SCROLL_SUPPRESS_MS;
  }, []);

  if (items.length === 0) return null;

  const cardHeight = isMobile ? cardHeightMobile : cardHeightDesktop;
  const copies = marqueeActive ? 2 : 1;

  return (
    <div
      ref={node => { wrapperRef.current = node; warmup.ref(node); }}
      className={cn('flex flex-col gap-6 w-full min-w-0', className)}
      onPointerEnter={() => { hoveredRef.current = true; }}
      onPointerLeave={() => { hoveredRef.current = false; }}
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
                  <BiteStripCard
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
                    profile={bite.profile ?? profile ?? null}
                    onBiteNavigate={onBiteNavigate}
                  />
                );
              }),
            )}
          </div>
        </div>

        {showChevrons && overflows && (
          <>
            <button
              type="button"
              aria-label="Previous videos"
              onClick={() => scrollByCard(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-md bg-ods-card/80 backdrop-blur border border-ods-border text-ods-text-primary hover:border-ods-accent transition-colors"
            >
              <Chevron02LeftIcon className="w-6 h-6" />
            </button>
            <button
              type="button"
              aria-label="Next videos"
              onClick={() => scrollByCard(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-md bg-ods-card/80 backdrop-blur border border-ods-border text-ods-text-primary hover:border-ods-accent transition-colors"
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
// Card (private)
// =============================================================================

interface BiteStripCardProps {
  bite: VideoBiteStripItem;
  index: number;
  cardKey: string;
  isClone: boolean;
  isTouch: boolean;
  height: number;
  active: boolean;
  onActivate: (key: string) => void;
  onDeactivate: (key: string) => void;
  profile: VideoBiteStripProfile | null;
  onBiteNavigate?: (bite: VideoBiteStripItem, index: number) => void;
}

function BiteStripCard({
  bite,
  index,
  cardKey,
  isClone,
  isTouch,
  height,
  active,
  onActivate,
  onDeactivate,
  profile,
  onBiteNavigate,
}: BiteStripCardProps) {
  const cssAspect = RATIO_TO_CSS_ASPECT[ratioToCategory(detectAspectRatio(bite.aspect_ratio))];
  const hasTarget = !!(bite.href || bite.onNavigate || onBiteNavigate);

  const navigate = () => {
    if (bite.onNavigate) bite.onNavigate();
    else onBiteNavigate?.(bite, index);
  };

  // Touch: first tap activates preview + overlay; navigation only via the
  // overlay chevron. Desktop: hover drives everything; only the overlay
  // chevron + title row navigate so clicks on the video never fight playback.
  const handlePointerEnter = () => { if (!isTouch) onActivate(cardKey); };
  const handlePointerLeave = () => { if (!isTouch) onDeactivate(cardKey); };
  const handleClick = () => { if (isTouch && !active) onActivate(cardKey); };

  const chevron = <Chevron02RightIcon className="w-6 h-6 shrink-0 text-ods-text-primary" />;

  return (
    <div
      aria-hidden={isClone || undefined}
      className="relative shrink-0 rounded-md border border-ods-border bg-ods-card overflow-hidden group/card"
      style={{ height, aspectRatio: cssAspect, maxWidth: '90vw' }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onFocus={() => onActivate(cardKey)}
      onBlur={() => onDeactivate(cardKey)}
    >
      {/* Poster layer — always mounted, cheap. */}
      {bite.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bite.thumbnail_url}
          alt={bite.title || 'Video clip'}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-ods-card">
          <PlayIcon className="w-10 h-10 text-ods-text-secondary" />
        </div>
      )}

      {/* Hover preview — the ONLY place a player mounts. */}
      {active && (
        <div className="absolute inset-0">
          <Video
            kind="file"
            url={bite.url}
            poster={bite.thumbnail_url}
            muted
            autoPlay
            loop
            chromeless
            layout="fill"
          />
        </div>
      )}

      {/* Bottom-docked detail overlay (Figma). */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 p-4 bg-ods-bg/75 border-t border-ods-border backdrop-blur-sm',
          'flex flex-col gap-3 transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100',
          // Keep the overlay non-interactive while invisible so it never
          // swallows clicks on the resting card.
          active ? 'pointer-events-auto' : 'pointer-events-none group-hover/card:pointer-events-auto',
        )}
      >
        {bite.title && (
          hasTarget && !isClone ? (
            bite.href ? (
              <a href={bite.href} className="text-sm font-medium leading-5 text-ods-text-primary line-clamp-2 hover:underline">
                {bite.title}
              </a>
            ) : (
              <button type="button" onClick={navigate} className="text-left text-sm font-medium leading-5 text-ods-text-primary line-clamp-2 hover:underline">
                {bite.title}
              </button>
            )
          ) : (
            <p className="text-sm font-medium leading-5 text-ods-text-primary line-clamp-2">{bite.title}</p>
          )
        )}

        {(profile || hasTarget) && (
          <div className="flex items-center gap-2 min-w-0">
            {profile && (
              <UserDisplay
                name={profile.name}
                avatarUrl={profile.avatarUrl}
                subtitle={profile.subtitle}
                size={34}
                shape="round"
                compact
                className="flex-1"
              />
            )}
            {hasTarget && !isClone && (
              bite.href ? (
                <a href={bite.href} aria-label={`Open ${bite.title || 'video'}`} className="ml-auto">
                  {chevron}
                </a>
              ) : (
                <button type="button" onClick={navigate} aria-label={`Open ${bite.title || 'video'}`} className="ml-auto">
                  {chevron}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
