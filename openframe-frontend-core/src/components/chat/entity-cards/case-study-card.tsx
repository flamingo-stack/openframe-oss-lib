'use client';

/**
 * CaseStudyCard (pure presentation). Five densities — `default` (vertical
 * detail), `sm` (compact horizontal for chat-inline), `portrait` (rails and
 * strips), `menu` (the site menu's card, hover-plays the highlight cut) and
 * `result` (a customer result: who, the headline metric large, the story's
 * title and a link to read it; no cover).
 *
 * Headline metric: `default` and `portrait` show the story's FIRST metric (the
 * value large, its label under it) in a fixed zone between the title and the
 * person. A story without one renders with no such zone, unless the host passes
 * `metricRow` to keep every card of a grid, and the skeleton, one box. `sm` and
 * `menu` never show it: neither has room without changing its box.
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
import Link from '../../../embed-shims/next-link';
import type { CaseStudyCardData, CaseStudyMetric } from '../../../types/case-study';
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
  size?: 'default' | 'sm' | 'portrait' | 'menu' | 'result';
  /** `result`: the colour of the metric and the read link, as a text class
   *  (a page that shows another product's brand). Default: the theme accent. */
  accentClassName?: string;
  /** `menu`: mount the hover player (the host passes whether its panel is open,
   *  so a closed menu holds no player). Omitted: the card's own viewport gate. */
  mediaMounted?: boolean;
  /** `menu`: runs on click, before the navigation (the host closes its panel). */
  onNavigate?: () => void;
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  /** `default` / `portrait`: keep the headline-metric zone even when this story has
   *  no metric, so a grid that mixes stories with and without one stays aligned
   *  (pass the same flag to `CaseStudyCardSkeleton`). Default false: a story
   *  without a metric renders exactly as it always has. */
  metricRow?: boolean;
  className?: string;
}

/** The headline-metric zone's box: the card and its skeleton share it. */
const CASE_STUDY_METRIC_ROW_BOX = 'flex h-[72px] shrink-0 flex-col justify-center overflow-hidden';

/** The `result` card's boxes: the card and its skeleton share them, so they are one height. */
const CASE_STUDY_RESULT_STACK = 'flex h-full flex-col gap-5 p-6';
const CASE_STUDY_RESULT_METRIC_BOX = 'flex h-[112px] shrink-0 flex-col justify-start gap-1 overflow-hidden';
const CASE_STUDY_RESULT_FOOTER_BOX =
  'mt-auto flex h-[60px] shrink-0 items-center justify-between gap-3 border-t border-ods-border pt-4';

/** The metric a card shows: the story's first one, when it has both halves. */
function headlineMetric(study: CaseStudyCardData): CaseStudyMetric | null {
  const metric = study.metrics?.[0];
  return metric?.value && metric.label ? metric : null;
}

function CaseStudyMetricRow({ metric }: { metric: CaseStudyMetric | null }) {
  return (
    <div className={CASE_STUDY_METRIC_ROW_BOX} data-testid="case-study-metric">
      {metric && (
        <>
          <span className="truncate text-ods-accent text-h3">{metric.value}</span>
          <span className="truncate text-ods-text-secondary text-h6">{metric.label}</span>
        </>
      )}
    </div>
  );
}

/** Who tells the story: the portrait with the MSP's mark on it, the name and MSP, the job title. A fixed 60px zone. */
function CaseStudyPersonRow({ study }: { study: CaseStudyCardData }) {
  return (
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
  );
}

/** `portrait` shares the default skeleton shape — the portrait anatomy uses the
 *  same zone boxes (media aspect → 72px title → 60px person footer). */
export function CaseStudyCardSkeleton({
  size = 'default',
  metricRow = false,
}: {
  size?: 'default' | 'sm' | 'portrait' | 'result';
  /** Reserve the headline-metric zone (the grid's cards pass `metricRow` too). */
  metricRow?: boolean;
}) {
  if (size === 'result') {
    return (
      <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, CASE_STUDY_RESULT_STACK, 'animate-pulse')}>
        <div className="flex h-[60px] shrink-0 items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-ods-border" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-ods-border" />
            <div className="h-3 w-1/2 rounded bg-ods-border" />
          </div>
        </div>
        <div className={CASE_STUDY_RESULT_METRIC_BOX} data-testid="case-study-result-skeleton-metric">
          <div className="h-10 w-1/3 rounded bg-ods-border" />
          <div className="h-4 w-3/4 rounded bg-ods-border" />
        </div>
        <div className={CASE_STUDY_RESULT_FOOTER_BOX}>
          <div className="h-4 w-2/3 rounded bg-ods-border" />
        </div>
      </div>
    );
  }
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
      {metricRow && (
        <div className={cn(CASE_STUDY_METRIC_ROW_BOX, 'gap-2')} data-testid="case-study-metric-skeleton">
          <div className="h-7 w-1/4 rounded bg-ods-border" />
          <div className="h-4 w-2/3 rounded bg-ods-border" />
        </div>
      )}
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
function caseStudyHighlight(study: CaseStudyCardData): { url: string; posterUrl: string | null } | null {
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
  metricRow = false,
  accentClassName = 'text-ods-accent',
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
  const metric = headlineMetric(study);
  const showMetricRow = metric !== null || metricRow;

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
      <Link
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
      </Link>
    );
  }

  if (size === 'result') {
    // A customer result: the person, the headline metric large, then the story's
    // title and the way in. A story with no metric has no result to show.
    if (!metric) return null;
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={cn('block h-full', className)}
        aria-label={`Read ${study.title}`}
      >
        <Card className={cn(CONTENT_CARD_FRAME_CLASS, CASE_STUDY_RESULT_STACK)}>
          <CaseStudyPersonRow study={study} />
          <div className={CASE_STUDY_RESULT_METRIC_BOX} data-testid="case-study-metric">
            <span className={cn('truncate text-h1', accentClassName)}>{metric.value}</span>
            <span className="line-clamp-2 text-ods-text-secondary text-h4">{metric.label}</span>
          </div>
          <div className={CASE_STUDY_RESULT_FOOTER_BOX}>
            <span className="line-clamp-2 min-w-0 text-ods-text-secondary text-h6">{study.title}</span>
            <span className={cn('shrink-0 text-h6', accentClassName)}>Read</span>
          </div>
        </Card>
      </Link>
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
        detail={showMetricRow ? <CaseStudyMetricRow metric={metric} /> : undefined}
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

        {showMetricRow && <CaseStudyMetricRow metric={metric} />}

        <CaseStudyPersonRow study={study} />
      </Card>
    </a>
  );
}
