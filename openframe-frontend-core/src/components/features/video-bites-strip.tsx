'use client';

/**
 * <VideoBitesStrip> — THE unified public video-bites surface (Figma
 * "Hero Section" node 4033-90364). Replaces the old aspect-ratio grid
 * (`<VideoBitesDisplay>` is now a deprecated shim over this).
 *
 * Thin wrapper over the shared <CardsStrip> engine (render-prop mode) — the
 * marquee/chevron/seam/measure implementation and its state-model doc live in
 * `cards-strip.tsx`. This file keeps only the bite-specific concerns:
 *
 *   - publish filtering + newest-first sort (`video-bites-shared`)
 *   - Mux/Supabase origin warmup (`useVideoWarmup`)
 *   - profile / description-slot / navigation injection via props
 *   - <VideoBiteCard> — hover overlay + muted chromeless autoplay preview;
 *     the `<Video>` Mux SSoT is the only player primitive used
 *
 * Perf contract: each card renders the REAL player (first frame + center
 * play control — every card looks and behaves like any other video surface)
 * while the card is within ~500px of the viewport, via the engine's shared
 * TWO-WAY IntersectionObserver mount gate (`ctx.mounted`/`ctx.rootRef`):
 * players mount as cards approach and UNMOUNT again once the marquee carries
 * them far off-screen. Live player count is therefore bounded by the visible
 * strip width (+margin), not by list length or clone count. Playback itself
 * starts only on hover (`<Video playOnHover>` — sound at 50%, muted fallback).
 */

import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { UserDisplay } from '../user-display';
import { CardHitLayer } from './card-hit-layer';
import { CardsStrip, STRIP_CELL_MAX_WIDTH } from './cards-strip';
import { useVideoWarmup } from './use-video-warmup';
import { DEFAULT_VIDEO_BITES_TITLE, sortBitesByCreatedAtDesc, type VideoBiteStripProfile } from './video-bites-shared';
import { VideoHoverPreviewSurface } from './video-hover-preview';
import { detectAspectRatio, RATIO_TO_CSS_ASPECT, ratioToCategory } from './video-ratio-tabs';
import type { VideoTeaserWithRatio } from './video-ratio-tabs';

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
  /** Marquee speed in px/s. Default 60 (see cards-strip.tsx). */
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
  /** Ordering comparator. Default `sortBitesByCreatedAtDesc`; FEATURED
   *  surfaces pass `sortBitesByFeaturedAtDesc` so display order matches the
   *  featured-recency ranking their server aggregation is capped by. */
  sortComparator?: (a: VideoBiteStripItem, b: VideoBiteStripItem) => number;
  /** How many cards the strip's loading state draws (in a `LoadingScope`). Default `VIDEO_BITES_SKELETON_COUNT`, a
   *  full line; 0 where the host's records usually carry none (nothing is drawn). */
  skeletonCount?: number;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/** A card's height in px per breakpoint (Figma: 416 desktop), the strip's default and its loading state's. */
export const VIDEO_BITES_CARD_HEIGHT_DESKTOP_PX = 416;
export const VIDEO_BITES_CARD_HEIGHT_MOBILE_PX = 300;
/** The widest line a strip bleeds across: a marquee's loading state fills it, the track clips the rest. */
export const STRIP_LINE_MAX_PX = 2560;
/** A marquee's loading state is a FULL line of cards: as many 9:16 cards at the desktop height as fill the widest line. */
export const VIDEO_BITES_SKELETON_COUNT = Math.ceil(
  STRIP_LINE_MAX_PX / ((VIDEO_BITES_CARD_HEIGHT_DESKTOP_PX * 9) / 16),
);
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
  cardHeightDesktop = VIDEO_BITES_CARD_HEIGHT_DESKTOP_PX,
  cardHeightMobile = VIDEO_BITES_CARD_HEIGHT_MOBILE_PX,
  showChevrons = true,
  onBiteNavigate,
  sortComparator = sortBitesByCreatedAtDesc,
  skeletonCount,
  className,
}: VideoBitesStripProps): React.ReactElement | null {
  const inScope = useLoadingScope();
  const items = useMemo(() => {
    const filtered = filterPublished ? bites.filter(b => b.published) : [...bites];
    return filtered.sort(sortComparator);
  }, [bites, filterPublished, sortComparator]);

  // Preconnect Mux/Supabase origins once so first hover starts fast.
  const warmup = useVideoWarmup<HTMLDivElement>({ videoUrl: inScope ? null : items[0]?.url || null });

  if (inScope) {
    return (
      <VideoBitesStripSkeleton
        count={skeletonCount ?? VIDEO_BITES_SKELETON_COUNT}
        title={title}
        showTitle={showTitle}
        headerSlot={headerSlot}
        cardHeightDesktop={cardHeightDesktop}
        cardHeightMobile={cardHeightMobile}
        className={className}
      />
    );
  }

  return (
    <CardsStrip
      items={items}
      itemKey={b => b.url}
      title={title}
      showTitle={showTitle}
      headerSlot={headerSlot}
      autoScroll={autoScroll}
      autoScrollSpeed={autoScrollSpeed}
      pauseOnHover={pauseOnHover}
      showChevrons={showChevrons}
      prevLabel="Previous videos"
      nextLabel="Next videos"
      rootRef={warmup.ref}
      className={className}
      renderCard={(bite, ctx) => (
        <VideoBiteCard
          bite={bite}
          index={ctx.index}
          // MUST pass ctx.cardKey — the card's own fallback `${url}__${index}`
          // lacks the copyIndex, so clone hover activation would never match.
          cardKey={ctx.cardKey}
          isClone={ctx.isClone}
          isTouch={ctx.isTouch}
          height={cardHeightDesktop}
          heightMobile={cardHeightMobile}
          active={ctx.active}
          onActivate={ctx.onActivate}
          onDeactivate={ctx.onDeactivate}
          playerMounted={ctx.mounted}
          rootRef={ctx.rootRef}
          profile={bite.profile ?? profile ?? null}
          sectionHref={href}
          onBiteNavigate={onBiteNavigate}
        />
      )}
    />
  );
}

// =============================================================================
// Card — THE bite card (exported). One component for every surface: the
// public strip passes controlled hover/mount state; the admin bites editor
// renders it standalone (self-managed hover, grid-cell sizing, action slots,
// inline title editing) so the admin sees EXACTLY the public card.
// =============================================================================

/** The card's layout, read by the card and by its skeleton, so the skeleton is the card's size. */
const BITE_CARD_FRAME_CLASS = 'relative overflow-hidden rounded-md border border-ods-border bg-ods-card';
const BITE_MEDIA_CLASS = 'relative w-full';
const BITE_MEDIA_FIXED_HEIGHT_CLASS = 'h-[var(--bite-height-mobile)] min-[768px]:h-[var(--bite-height)]';

/** The media box's size: its aspect, and with a fixed `height` the strip's heights per breakpoint. */
function biteMediaStyle(cssAspect: string, height?: number, heightMobile?: number): React.CSSProperties {
  return {
    aspectRatio: cssAspect,
    ...(height !== undefined
      ? ({
          '--bite-height': `${height}px`,
          '--bite-height-mobile': `${heightMobile ?? height}px`,
          maxWidth: STRIP_CELL_MAX_WIDTH,
        } as React.CSSProperties)
      : {}),
  };
}

interface VideoBiteCardSkeletonProps {
  /** The bite's aspect ratio ('9:16' portrait by default). */
  aspect?: string;
  /** Fixed card height (strip); omitted, the card fills its cell and the aspect sets the height. */
  height?: number;
  heightMobile?: number;
  className?: string;
}

/**
 * A bite card while it is read: the card's own frame and its media box as the skeleton's surface. The title and
 * the speaker sit in the hover overlay, unseen at rest, so they are not drawn.
 */
function VideoBiteCardSkeleton({ aspect = '9:16', height, heightMobile, className }: VideoBiteCardSkeletonProps) {
  const cssAspect = RATIO_TO_CSS_ASPECT[ratioToCategory(detectAspectRatio(aspect))];
  return (
    <div
      aria-hidden
      className={cn(BITE_CARD_FRAME_CLASS, height !== undefined ? 'shrink-0' : 'w-full', className)}
      style={height !== undefined ? { maxWidth: STRIP_CELL_MAX_WIDTH } : undefined}
    >
      <div
        className={cn(BITE_MEDIA_CLASS, height !== undefined && BITE_MEDIA_FIXED_HEIGHT_CLASS)}
        style={biteMediaStyle(cssAspect, height, heightMobile)}
      >
        <UnifiedSkeleton className="absolute inset-0 h-full rounded-none" />
      </div>
    </div>
  );
}

interface VideoBitesStripSkeletonProps {
  /** How many cards. Default `VIDEO_BITES_SKELETON_COUNT` (a full line); 0 draws nothing. */
  count?: number;
  /** The bites' aspect ratio ('9:16' by default). */
  aspect?: string;
  /** The strip's heading: static copy, drawn as it is. */
  title?: string;
  showTitle?: boolean;
  headerSlot?: React.ReactNode;
  cardHeightDesktop?: number;
  cardHeightMobile?: number;
  className?: string;
}

/**
 * The strip while its bites are read: the same `CardsStrip` (its heading, track, gaps and edge bleed), with no
 * marquee, each card a `VideoBiteCardSkeleton`. `VideoBitesStrip` draws it in a loading scope.
 */
function VideoBitesStripSkeleton({
  count = VIDEO_BITES_SKELETON_COUNT,
  aspect = '9:16',
  title = DEFAULT_VIDEO_BITES_TITLE,
  showTitle = true,
  headerSlot,
  cardHeightDesktop = VIDEO_BITES_CARD_HEIGHT_DESKTOP_PX,
  cardHeightMobile = VIDEO_BITES_CARD_HEIGHT_MOBILE_PX,
  className,
}: VideoBitesStripSkeletonProps) {
  const cells = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  return (
    <CardsStrip
      items={cells}
      itemKey={i => `bite-skeleton-${i}`}
      title={title}
      showTitle={showTitle}
      headerSlot={headerSlot}
      autoScroll={false}
      showChevrons={false}
      className={className}
      renderCard={() => (
        <VideoBiteCardSkeleton aspect={aspect} height={cardHeightDesktop} heightMobile={cardHeightMobile} />
      )}
    />
  );
}

export interface VideoBiteCardProps {
  bite: VideoBiteStripItem;
  index: number;
  profile?: VideoBiteStripProfile | null;
  sectionHref?: string;
  onBiteNavigate?: (bite: VideoBiteStripItem, index: number) => void;
  /** Fixed card height (strip). Omit → width-driven: card fills its grid
   *  cell and the aspect-ratio derives the height (editor grids). */
  height?: number;
  /** With `height`: the height under the strip's 768px line. The switch is CSS's,
   *  so the first paint is the card's final size on a phone too. OPTIONAL and
   *  additive: omitted, `height` applies at every width, exactly as before this
   *  prop existed (a caller that resolves the height itself keeps working). */
  heightMobile?: number;
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
  heightMobile,
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
  // Strip keys and navigation stay on the RAW bite.url — the surface applies
  // the rendition cap internally, so keys are stable regardless of the cap.
  const key = cardKey ?? `${bite.url}__${index}`;

  // Hover activation: controlled by the strip (activeKey) or self-managed
  // when rendered standalone (admin editor).
  const controlled = active !== undefined;
  const [selfActive, setSelfActive] = useState(false);
  const isActive = controlled ? !!active : selfActive;
  const activate = () => (controlled ? onActivate?.(key) : setSelfActive(true));
  const deactivate = () => (controlled ? onDeactivate?.(key) : setSelfActive(false));

  // Inline title editor auto-grow. The height is a DOM MEASUREMENT
  // (`scrollHeight` of the wrapped text), so it is written to the node from a
  // layout effect rather than from inside a callback ref. Dependency-less on
  // purpose — that reproduces the callback ref's cadence exactly (an inline
  // arrow ref is torn down and re-attached on every commit, so it re-measured
  // every time), which is what keeps the box in step with a `bite.title` the
  // parent changed from outside the editor. Null-guarded: the textarea only
  // exists while `titleEditable`. Runs before paint, so a title that wraps to
  // two lines never paints one frame at one line.
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  useIsomorphicLayoutEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 40)}px`;
  });

  const navigate = () => {
    if (bite.onNavigate) bite.onNavigate();
    else onBiteNavigate?.(bite, index);
  };

  const handlePointerEnter = () => {
    if (!isTouch) activate();
  };
  const handlePointerLeave = () => {
    if (!isTouch) deactivate();
  };
  const handleClick = () => {
    if (isTouch && !isActive) activate();
  };

  // Bottom-docked detail (Figma node 4033:90369): title row + profile row +
  // chevron affordance. The WHOLE footer is the navigation target — it links
  // to the entity the bite originated from. In the editor the title row is
  // the inline title editor (edited directly on the card).
  const titleClass = 'text-h6 text-ods-text-primary';
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
          // No resize here: the textarea is CONTROLLED, so the height must
          // follow the value React actually commits, not the one the user just
          // typed. Sizing from the change event grew the box for text React
          // then reverted whenever the parent did not adopt the new value
          // (deferred/transition state, or a rejected edit), leaving a
          // two-line-tall box over one line of text until some later commit.
          onChange={e => onTitleChange?.(e.target.value)}
          // `height` is intentionally absent from the class list / style — the
          // layout effect above owns it, because it is a live measurement.
          ref={titleInputRef}
          onBlur={e => onTitleCommit?.(e.target.value)}
          onClick={e => e.stopPropagation()}
          className={cn(
            titleClass,
            'max-h-10 w-full resize-none overflow-hidden bg-transparent outline-none',
            'border-b border-transparent placeholder:text-ods-text-secondary focus:border-ods-border',
          )}
        />
      ) : (
        bite.title && <p className={cn(titleClass, 'line-clamp-2')}>{bite.title}</p>
      )}
      {(profile || hasTarget) && (
        <div className="flex min-w-0 items-center gap-2">
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
          {hasTarget && <Chevron02RightIcon className="ml-auto h-5 w-5 shrink-0 text-ods-text-primary" />}
        </div>
      )}
    </>
  );

  // Figma node 4033:90369 exactly: pure-black 75% fill (Tailwind palette
  // black — NOT a glassy backdrop blur; Figma has no background blur here),
  // full soft-grey border, p-16/gap-16, large soft drop shadow.
  const overlayClass = cn(
    'absolute inset-x-0 bottom-0 gap-2 border border-ods-border bg-black/75 p-3 shadow-2xl',
    'flex flex-col transition-opacity duration-200',
    isActive ? 'opacity-100' : 'opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100',
    // Non-interactive while invisible so it never swallows clicks on the
    // resting card / player controls.
    isActive ? 'pointer-events-auto' : 'pointer-events-none',
  );

  // Full-card click target (above the visual overlay (z-[5] vs its auto), below the surface's own z-10 children (play badge, unmute button) which must stay clickable). Mirrors
  // the walkthrough card: a hit layer owns the click, the overlay owns the look.
  // ALWAYS interactive. The old overlay was hover-gated because it was a
  // visible panel that would otherwise swallow clicks while invisible; a
  // contentless hit layer has no such problem, and gating it meant the media
  // element received the pointer instead — so a resting card showed `cursor:
  // auto` over the play glyph even though the glyph accented on hover.
  // Touch keeps the deliberate two-tap model (tap 1 previews, tap 2 opens), so
  // the layer stays inert until the card is active — making it unconditionally
  // clickable meant a phone tap navigated instantly and bites could no longer
  // be previewed on mobile. Mouse/keyboard get it immediately.
  const hitLayerClass = cn('z-[5]', isTouch && !isActive ? 'pointer-events-none' : 'pointer-events-auto');

  const media = (
    <div
      className={cn(BITE_MEDIA_CLASS, height !== undefined && BITE_MEDIA_FIXED_HEIGHT_CLASS)}
      // Strip mode: fixed height + aspect drive the width (capped at 90vw,
      // same as the old single-box layout). Editor mode: width-driven.
      style={biteMediaStyle(cssAspect, height, heightMobile)}
    >
      {/* THE shared hover-preview media zone (poster → facade → badge →
          controlled hover playback + near-viewport mount gate). The bite strip
          keeps the internal unmute badge (no overlaying activation button). */}
      <VideoHoverPreviewSurface
        url={bite.url}
        posterUrl={bite.thumbnail_url}
        active={isActive}
        playerMounted={playerMounted}
        isClone={isClone}
      />

      {hasTarget && !titleEditable ? (
        // CONTENTLESS full-bleed hit layer + a purely visual overlay — the same
        // grammar the walkthrough card uses. Previously the anchor/button WAS
        // the bottom strip, so the card centre (where the play glyph sits) was
        // not clickable and showed no pointer cursor even though the glyph
        // accented on hover. One interactive element, no a11y duplication.
        <>
          <CardHitLayer
            label={`Open ${bite.title || 'source content'}`}
            href={targetHref || undefined}
            onClick={targetHref ? undefined : navigate}
            className={hitLayerClass}
            decorative={isClone}
          />
          <div className={cn(overlayClass, 'pointer-events-none')}>{overlayContent}</div>
        </>
      ) : (
        <div className={overlayClass}>{overlayContent}</div>
      )}
    </div>
  );

  return (
    <div
      ref={node => rootRef?.(node)}
      aria-hidden={isClone || undefined}
      // Hit-test marker for the strip engine's pointer-tracked hover re-sync
      // (cards move under a stationary pointer — see cards-strip.tsx). The
      // hover area is exactly this card root: media + overlay + toolbar.
      data-strip-card-key={key}
      className={cn('group/card', BITE_CARD_FRAME_CLASS, height !== undefined ? 'shrink-0' : 'w-full', className)}
      style={height !== undefined ? { maxWidth: STRIP_CELL_MAX_WIDTH } : undefined}
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
