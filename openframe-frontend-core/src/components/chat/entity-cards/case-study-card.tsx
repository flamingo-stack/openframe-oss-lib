'use client';

/**
 * CaseStudyCard (pure presentation). Five densities — `default` (vertical
 * detail), `sm` (compact horizontal for chat-inline), `portrait` (rails and
 * strips), `menu` (the site menu's card, hover-plays the highlight cut) and
 * `result` (a customer result: who, the headline metric large, the story's
 * title and a link to read it; no cover).
 *
 * Only `result` shows a metric (the story's FIRST one). Every other density is
 * the story's regular card and never changes its box for one.
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
import { AVATAR_SIZE_PX, ICON_SIZE, MEDIA_ASPECT } from '../../../styles/component-sizes';
import { IMAGE_SLOT, fixedImageSlot } from '../../../styles/image-sizes';
import type { CaseStudyCardData, CaseStudyMetric } from '../../../types/case-study';
import { cn } from '../../../utils/cn';
import { sortBitesByFeaturedAtDesc } from '../../features/video-bites-shared';
import { CardHoverPlay } from '../../features/video-center-badge';
import { VideoHoverPreviewSurface } from '../../features/video-hover-preview';
import { EntityIcon } from '../../icon-display';
import { MediaSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { Card } from '../../ui/card';
import { useLoadingScope } from '../../ui/loading-scope';
import {
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SUBTITLE,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';
import { EntityPortraitCard } from './entity-portrait-card';
import { hideOnError } from './use-cover-image-fallback';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

/** The card's options, the same loaded or loading. */
interface CaseStudyCardOptions {
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
  className?: string;
}

/**
 * The story and its link, or `loading` while the host reads the story (a client read): the card then draws its own
 * skeleton (`CaseStudyCardSkeleton`), as it does in a loading scope.
 */
export type CaseStudyCardProps = CaseStudyCardOptions &
  (
    | {
        study: CaseStudyCardData;
        /** Detail URL resolved by the caller. */
        href: string;
        loading?: false;
      }
    | { loading: true; study?: undefined; href?: undefined }
  );

type LoadedCaseStudyCardProps = CaseStudyCardOptions & { study: CaseStudyCardData; href: string };

/** The `result` card's boxes: the card and its skeleton share them, so they are one height. */
const CASE_STUDY_RESULT_STACK = 'flex h-full flex-col gap-5 p-6';
const CASE_STUDY_RESULT_METRIC_BOX = 'flex h-[112px] shrink-0 flex-col justify-start gap-1 overflow-hidden';
const CASE_STUDY_RESULT_FOOTER_BOX =
  'mt-auto flex h-[60px] shrink-0 items-center justify-between gap-3 border-t border-ods-border pt-4';
/** The `default` card's boxes, shared with its skeleton. */
const CASE_STUDY_DEFAULT_BODY = 'flex flex-col gap-6 p-6';
const CASE_STUDY_COVER = `relative ${MEDIA_ASPECT.og} w-full shrink-0 overflow-hidden rounded-sm`;
const CASE_STUDY_TITLE_ZONE = 'flex h-[72px] shrink-0 items-center';
/** The person row's boxes (a fixed 60px zone), shared with its skeleton. */
const CASE_STUDY_PERSON_ZONE = 'flex h-[60px] shrink-0 items-center';
const CASE_STUDY_PERSON_ROW = 'flex w-full min-w-0 items-center gap-3';
const CASE_STUDY_PERSON_TEXT = 'min-w-0 flex-1';
/** The `menu` card's boxes, shared with its skeleton. */
const CASE_STUDY_MENU_FRAME =
  'group/card group flex min-w-0 flex-col gap-[var(--spacing-system-sf)] rounded-xl border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)] text-ods-text-primary transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent';
const CASE_STUDY_MENU_SKELETON_FRAME =
  'flex min-w-0 flex-col gap-[var(--spacing-system-sf)] rounded-xl border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]';
const CASE_STUDY_MENU_MEDIA = `relative block ${MEDIA_ASPECT.video} w-full shrink-0 overflow-hidden rounded-md`;
const CASE_STUDY_MENU_MSP_ROW = 'flex items-center gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h6';
/** The MSP's icon in the menu card's MSP row (20px), read by the card and its skeleton. */
const MSP_ICON_PX = 20;
const MSP_ICON_CLASS = `${ICON_SIZE.md} shrink-0 rounded`;
/** The content-type chip a portrait case study shows (a static label). */
const CASE_STUDY_TYPE_LABEL = 'Case Study';

/** The metric a card shows: the story's first one, when it has both halves. */
function headlineMetric(study: CaseStudyCardData): CaseStudyMetric | null {
  const metric = study.metrics?.[0];
  return metric?.value && metric.label ? metric : null;
}

/** Who tells the story: the portrait with the MSP's mark on it, the name and MSP, the job title. A fixed 60px zone. */
function CaseStudyPersonRow({ study }: { study: CaseStudyCardData }) {
  return (
    <div className={CASE_STUDY_PERSON_ZONE}>
      <div className={CASE_STUDY_PERSON_ROW}>
        <div className="relative h-12 w-12 shrink-0">
          {study.user?.avatar_url ? (
            <Image
              src={study.user.avatar_url}
              alt={study.user?.full_name || 'User'}
              className="h-12 w-12 rounded-full border border-ods-border bg-ods-bg object-cover"
              width={AVATAR_SIZE_PX.lg}
              height={AVATAR_SIZE_PX.lg}
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
                width={AVATAR_SIZE_PX.xs}
                height={AVATAR_SIZE_PX.xs}
                unoptimized
              />
            </div>
          )}
        </div>
        <div className={CASE_STUDY_PERSON_TEXT}>
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

/** The person row while it is read: the 48px portrait and the name and job-title lines. */
function CaseStudyPersonRowSkeleton() {
  return (
    <div className={CASE_STUDY_PERSON_ZONE}>
      <div className={CASE_STUDY_PERSON_ROW}>
        <MediaSkeleton.Avatar size="md" className="shrink-0" />
        <div className={CASE_STUDY_PERSON_TEXT}>
          <TextLineSkeleton type="h6" className="w-2/3" />
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * A case study card while it is read, one per density, in the card's own boxes. Static words (the "Read" link, the
 * portrait chip) are drawn for real; the title, people, metric and summary are bars.
 */
function CaseStudyCardSkeleton({
  size = 'default',
  showTypeBadge = true,
  className,
}: {
  size?: 'default' | 'sm' | 'portrait' | 'menu' | 'result';
  /** `portrait`: the card shows the "Case Study" chip. */
  showTypeBadge?: boolean;
  className?: string;
}) {
  if (size === 'portrait') {
    return (
      <EntityPortraitCard
        loading
        href=""
        imageAlt=""
        title=""
        typeLabel={showTypeBadge ? CASE_STUDY_TYPE_LABEL : undefined}
        className={className}
      />
    );
  }
  if (size === 'result') {
    return (
      <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, CASE_STUDY_RESULT_STACK, className)} aria-hidden>
        <CaseStudyPersonRowSkeleton />
        <div className={CASE_STUDY_RESULT_METRIC_BOX} data-testid="case-study-result-skeleton-metric">
          <TextLineSkeleton type="h1" className="w-1/3" />
          <TextLineSkeleton type="h4" lines={2} className="w-3/4" />
        </div>
        <div className={CASE_STUDY_RESULT_FOOTER_BOX}>
          <TextLineSkeleton type="h6" lines={2} className="w-2/3" />
          <span className="shrink-0 text-ods-accent text-h6">Read</span>
        </div>
      </div>
    );
  }
  if (size === 'menu') {
    return (
      <div className={cn(CASE_STUDY_MENU_SKELETON_FRAME, className)} aria-hidden>
        <UnifiedSkeleton className={CASE_STUDY_MENU_MEDIA} />
        <div className={CASE_STUDY_MENU_MSP_ROW}>
          <UnifiedSkeleton className={MSP_ICON_CLASS} />
          <TextLineSkeleton type="h6" className="w-28" />
        </div>
        <TextLineSkeleton type="h6" lines={2} className="w-full" />
        <TextLineSkeleton type="h6" className="w-3/4" />
        <TextLineSkeleton type="h6" className="mt-auto w-28" />
      </div>
    );
  }
  if (size === 'sm') {
    return <CompactCardSkeleton rows={[{ width: 'w-1/2' }, { width: 'w-11/12' }]} className={className} />;
  }
  return (
    <div className={cn('block h-full', className)} aria-hidden>
      <Card className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, CASE_STUDY_DEFAULT_BODY)}>
        <UnifiedSkeleton className={cn(CASE_STUDY_COVER, 'rounded-sm')} />
        <div className={CASE_STUDY_TITLE_ZONE}>
          <TextLineSkeleton type="h4" lines={3} className="w-full" />
        </div>
        <CaseStudyPersonRowSkeleton />
      </Card>
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

export function CaseStudyCard(props: CaseStudyCardProps) {
  const inScope = useLoadingScope();
  if (inScope || props.loading) {
    return <CaseStudyCardSkeleton size={props.size} showTypeBadge={props.showTypeBadge} className={props.className} />;
  }
  return <LoadedCaseStudyCard {...props} />;
}

/** The card for a read story (`CaseStudyCard` decides whether it is read). */
function LoadedCaseStudyCard({
  study,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  accentClassName = 'text-ods-accent',
  mediaMounted,
  onNavigate,
  className,
}: LoadedCaseStudyCardProps) {
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
      <Link href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {coverImage ? (
            <Image
              src={coverImage}
              alt={`${study.msp?.name || study.title} cover`}
              className="object-contain"
              fill
              sizes={fixedImageSlot('tile')}
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
      </Link>
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
        // `group/card` is what the shared play glyph accents on.
        className={cn(CASE_STUDY_MENU_FRAME, className)}
      >
        {/* The media never takes the click: the whole card is the link. */}
        <span className={cn('pointer-events-none bg-ods-bg', CASE_STUDY_MENU_MEDIA)}>
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
              posterSizes={IMAGE_SLOT.panel}
            />
          ) : (
            <>
              {(poster ?? placeholderUrl) && (
                <Image
                  src={poster ?? placeholderUrl ?? ''}
                  alt=""
                  className="object-cover"
                  fill
                  sizes={IMAGE_SLOT.panel}
                  unoptimized
                  onError={hideOnError}
                />
              )}
              {hasAnyVideo && <CardHoverPlay size="md" />}
            </>
          )}
        </span>
        {study.msp?.name && (
          <span className={CASE_STUDY_MENU_MSP_ROW}>
            {study.msp.icon_url && (
              <EntityIcon
                icon={{ url: study.msp.icon_url }}
                size={MSP_ICON_PX}
                className={cn(MSP_ICON_CLASS, 'object-contain')}
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
    const metric = headlineMetric(study);
    if (!metric) return null;
    return (
      <Link href={href} target={target} rel={rel} className={cn('block h-full', className)}>
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
        typeLabel={showTypeBadge ? CASE_STUDY_TYPE_LABEL : undefined}
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
    <Link href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className={cn(CONTENT_CARD_FRAME_CLASS, CASE_STUDY_DEFAULT_BODY)}>
        {/* Fixed aspect ratio matches the standard OG card source aspect
            (1200×630 = 1.91:1), so the image fits with near-zero CSS-side
            cropping. Subject anchoring is then a function of the source
            image's center-66% safe zone (OG design convention) — visually
            uniform across all cards regardless of column width. Skeleton
            (lines 73-74) uses the same aspect for consistent layout. */}
        <div className={cn(CASE_STUDY_COVER, 'bg-ods-bg')}>
          {coverImage && (
            <Image
              src={coverImage}
              alt={study.msp?.name || study.title}
              className="h-full w-full object-cover"
              sizes={IMAGE_SLOT.card}
              fill
              unoptimized
              onError={hideOnError}
            />
          )}
        </div>

        <div className={CASE_STUDY_TITLE_ZONE}>
          <p className="line-clamp-3 break-words text-ods-text-primary text-h4">{study.title}</p>
        </div>

        <CaseStudyPersonRow study={study} />
      </Card>
    </Link>
  );
}
