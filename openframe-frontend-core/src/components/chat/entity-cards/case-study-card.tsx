'use client';

/**
 * CaseStudyCard (pure presentation). Two densities — `default` (vertical
 * detail) and `sm` (compact horizontal for chat-inline).
 *
 * The card writes NO click logic — callers wrap with their own anchor
 * and pass the resolved detail URL via `href`.
 *
 * Image-fallback chain:
 *   `study.featured_image` → `placeholderUrl` (caller passes
 *   `useOgPlaceholderUrl(...)`) → `bg-ods-bg`.
 */

import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import type { CaseStudyCardData } from '../../../types/case-study';
import { cn } from '../../../utils/cn';
import { sortBitesByFeaturedAtDesc } from '../../features/video-bites-shared';
import { CardHoverPlay } from '../../features/video-center-badge';
import { VideoHoverPreviewSurface } from '../../features/video-hover-preview';
import { EntityIcon } from '../../icon-display';
import { Card } from '../../ui/card';
import {
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUBTITLE,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';
import { EntityPortraitCard } from './entity-portrait-card';
import { hideOnError } from './use-cover-image-fallback';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

export interface CaseStudyCardProps {
  study: CaseStudyCardData;
  /** Detail URL resolved by the caller. */
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL, used when `study.featured_image` is missing. */
  placeholderUrl?: string | null;
  /** `menu` is the site menu's card: the story's video plays muted on hover or
   *  focus (the video bites' hover grammar), then who it is about and who tells it. */
  size?: 'default' | 'sm' | 'portrait' | 'menu';
  /** `menu`: mount the hover player (the host passes whether its panel is open,
   *  so a closed menu holds no player). Omitted: the card's own viewport gate. */
  mediaMounted?: boolean;
  /** `menu`: runs on click, before the navigation (the host closes its panel). */
  onNavigate?: () => void;
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  className?: string;
}

/** `portrait` shares the default skeleton shape — the portrait anatomy uses the
 *  same zone boxes (media aspect → 72px title → 60px person footer). */
export function CaseStudyCardSkeleton({ size = 'default' }: { size?: 'default' | 'sm' | 'portrait' }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className="h-3.5 w-3/5 rounded bg-ods-bg" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-1/2 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    );
  }
  return (
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, 'flex animate-pulse flex-col gap-6 p-6')}>
      {/* Skeleton aspect matches the real card's image slot (OG 1200×630) */}
      <div className="aspect-[1200/630] w-full rounded-sm bg-ods-border" />
      <div className="flex h-[72px] flex-col gap-2">
        <div className="h-5 w-3/4 rounded bg-ods-border" />
        <div className="h-5 w-1/2 rounded bg-ods-border" />
      </div>
      <div className="flex h-[60px] items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-ods-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-ods-border" />
          <div className="h-3 w-1/2 rounded bg-ods-border" />
        </div>
      </div>
    </div>
  );
}

/**
 * A story's HIGHLIGHT cut, the short video a card previews: its highlight
 * video, else the bite an admin featured (the newest when several are; featuring
 * is independent of the bite's own `published` flag, as on every featured surface). Never
 * the full video: that plays on the story's own page. Null when it has neither.
 */
export function caseStudyHighlight(study: CaseStudyCardData): { url: string; posterUrl: string | null } | null {
  if (study.highlight_video_url) {
    return { url: study.highlight_video_url, posterUrl: study.highlight_video_thumbnail ?? null };
  }
  const bite = (study.video_bites ?? [])
    .filter(candidate => candidate.featured === true && candidate.url)
    .sort(sortBitesByFeaturedAtDesc)[0];
  return bite ? { url: bite.url, posterUrl: bite.thumbnail_url ?? null } : null;
}

export function CaseStudyCard({
  study,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  mediaMounted,
  onNavigate,
  className,
}: CaseStudyCardProps) {
  const [hovered, setHovered] = useState(false);
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  });
  const placeholderUrl = useEntityCardPlaceholder({
    title: study.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  });
  const coverImage = study.featured_image || placeholderUrl || null;

  if (size === 'sm') {
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {coverImage ? (
            <Image
              src={coverImage}
              alt={`${study.msp?.name || study.title} cover`}
              className="object-contain"
              fill
              sizes="56px"
              unoptimized
              onError={hideOnError}
            />
          ) : null}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={COMPACT_CARD_TITLE}>{study.title}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUBTITLE}>
              {[study.msp?.name, study.user?.full_name].filter(Boolean).join(' · ') || 'Case study'}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>{study.summary || COMPACT_CARD_ROW_FILLER}</span>
          </span>
        </span>
      </a>
    );
  }

  if (size === 'menu') {
    const preview = caseStudyHighlight(study);
    const videoUrl = preview?.url ?? null;
    const hasAnyVideo = !!(videoUrl || study.main_video_url);
    // The cover is the FULL video's poster (wide, like the card); the highlight
    // cut's own frame is usually upright and would not fill a 16:9 slot.
    const poster = study.main_video_thumbnail || study.featured_image || preview?.posterUrl || null;
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onNavigate}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={cn(
          // `group/card` is what the shared play glyph accents on.
          'group/card group flex min-w-0 flex-col gap-[var(--spacing-system-sf)] rounded-xl border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)] text-ods-text-primary transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
          className,
        )}
      >
        {/* The media never takes the click: the whole card is the link. */}
        <span className="pointer-events-none relative block aspect-video w-full shrink-0 overflow-hidden rounded-md bg-ods-bg">
          {videoUrl ? (
            // The shared hover surface, filled the way the walkthrough card fills
            // its own 16:9 slot (`cover`): an upright cut is cropped to the slot,
            // never letterboxed. Sound on hover, muted when the browser blocks it.
            <VideoHoverPreviewSurface
              url={videoUrl}
              posterUrl={poster}
              active={hovered}
              playerMounted={mediaMounted}
              fit="cover"
              posterSizes="360px"
            />
          ) : (
            <>
              {(poster ?? placeholderUrl) && (
                <Image
                  src={poster ?? placeholderUrl ?? ''}
                  alt=""
                  className="object-cover"
                  fill
                  sizes="360px"
                  unoptimized
                  onError={hideOnError}
                />
              )}
              {hasAnyVideo && <CardHoverPlay size="md" />}
            </>
          )}
        </span>
        {study.msp?.name && (
          <span className="flex items-center gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h6">
            {study.msp.icon_url && (
              <EntityIcon
                icon={{ url: study.msp.icon_url }}
                size={20}
                className="size-5 shrink-0 rounded object-contain"
              />
            )}
            <span className="min-w-0 truncate">{study.msp.name}</span>
          </span>
        )}
        <span className="line-clamp-2 text-h6">{study.title}</span>
        {study.user?.full_name && (
          <span className="truncate text-ods-text-muted text-h6">
            {study.user.job_title ? `${study.user.full_name}, ${study.user.job_title}` : study.user.full_name}
          </span>
        )}
        <span className="mt-auto text-ods-accent text-h6">{hasAnyVideo ? 'Watch the story' : 'Read the story'}</span>
      </a>
    );
  }

  if (size === 'portrait') {
    // Rail/strip density — shared <EntityPortraitCard> shell.
    return (
      <EntityPortraitCard
        href={href}
        target={target}
        rel={rel}
        typeLabel={showTypeBadge ? 'Case Study' : undefined}
        imageUrl={study.featured_image}
        placeholderUrl={placeholderUrl}
        imageAlt={study.msp?.name || study.title}
        title={study.title}
        person={{
          name: study.user?.full_name || 'Anonymous',
          avatarUrl: study.user?.avatar_url,
          subtitle: study.msp?.name ?? null,
          iconOverlayUrl: study.msp?.icon_url ?? null,
        }}
        className={className}
      />
    );
  }

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className={cn(CONTENT_CARD_FRAME_CLASS, 'flex flex-col gap-6 p-6')}>
        {/* Fixed aspect ratio matches the standard OG card source aspect
            (1200×630 = 1.91:1), so the image fits with near-zero CSS-side
            cropping. Subject anchoring is then a function of the source
            image's center-66% safe zone (OG design convention) — visually
            uniform across all cards regardless of column width. Skeleton
            (lines 73-74) uses the same aspect for consistent layout. */}
        <div className="relative aspect-[1200/630] w-full shrink-0 overflow-hidden rounded-sm bg-ods-bg">
          {coverImage && (
            <Image
              src={coverImage}
              alt={study.msp?.name || study.title}
              className="h-full w-full object-cover"
              sizes="(min-width: 1545px) 515px, (min-width: 1280px) 33vw, (min-width: 800px) 50vw, 100vw"
              fill
              unoptimized
              onError={hideOnError}
            />
          )}
        </div>

        <div className="flex h-[72px] shrink-0 items-center">
          <p className="line-clamp-3 break-words text-ods-text-primary text-h4">{study.title}</p>
        </div>

        <div className="flex h-[60px] shrink-0 items-center">
          <div className="flex w-full min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              {study.user?.avatar_url ? (
                <Image
                  src={study.user.avatar_url}
                  alt={study.user?.full_name || 'User'}
                  className="h-12 w-12 rounded-full border border-ods-border bg-ods-bg object-cover"
                  width={48}
                  height={48}
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ods-border bg-ods-bg">
                  <span className="text-ods-text-secondary text-h4">
                    {(study.user?.full_name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {study.msp?.icon_url && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-ods-text-primary ring-1 ring-ods-bg">
                  <Image
                    src={study.msp.icon_url}
                    alt={study.msp.name || 'MSP'}
                    className="h-full w-full object-cover"
                    width={24}
                    height={24}
                    unoptimized
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ods-text-primary text-h6">
                {study.user?.full_name || 'Anonymous'}
                {study.msp?.name && <span className="text-ods-text-secondary"> • {study.msp.name}</span>}
              </p>
              <p className="truncate text-ods-text-secondary text-h6">{study.user?.job_title || ' '}</p>
            </div>
          </div>
        </div>
      </Card>
    </a>
  );
}
