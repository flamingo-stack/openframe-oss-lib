'use client';

/**
 * OnboardingGuideCard (pure presentation + runtime-derived link attrs).
 *
 * Three variants:
 *   - `catalog`: rich detail card (hero + author grid) for the public catalog
 *     page.
 *   - `default`: horizontal step-numbered card for "More in {section}" rail.
 *   - `sm`: compact horizontal card for chat-inline rendering.
 *
 * Link semantics: the card derives `target`/`rel` from `ChatRuntime.navigation
 * .decideNewTab` (hub-wired via `HubRuntimeProvider`) and the placeholder
 * image from the runtime's base API URL (`endpoints.ogPlaceholderUrl`, via
 * `useEntityCardPlaceholder`). Explicit `target` / `rel` / `placeholderUrl`
 * props always WIN — chat dispatch and tests can pre-resolve. No runtime
 * mounted → same-tab + same-origin relative placeholder.
 */

import { Clock, ExternalLink, GraduationCap } from 'lucide-react';
import Image from '../../../embed-shims/next-image';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { formatDurationMMSS } from '../../../utils/format';
import { CardHoverPlay } from '../../features/video-center-badge';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import type { OnboardingGuide } from '../types/entities/onboarding-guide';
import {
  COMPACT_CARD_OUTER,
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE_ROW,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_ROW_FILLER,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';
import { BlogImagePlaceholder } from './blog-image-placeholder';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';
import { EntityAuthorCard } from './entity-author-card';
import { EntityPortraitCard } from './entity-portrait-card';

/** The content-type chip a portrait guide shows (a static label). */
const GUIDE_TYPE_LABEL = 'Guide';
import { MEDIA_ASPECT, TEXT_LINES_MIN } from '../../../styles/component-sizes';
import { IMAGE_SLOT, fixedImageSlot } from '../../../styles/image-sizes';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

interface LoadedOnboardingGuideCardProps {
  guide: OnboardingGuide;
  /** Detail URL resolved by the caller. */
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used by the catalog + sm variants when no cover. */
  placeholderUrl?: string | null;
  size?: 'catalog' | 'default' | 'sm' | 'portrait';
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean | 'default' | 'sm' | 'portrait';
  className?: string;
}

/**
 * The record and its link, or `loading` while the host reads it: the card then draws its own loading form, as it
 * does in a loading scope.
 */
export type OnboardingGuideCardProps =
  | (LoadedOnboardingGuideCardProps & { loading?: boolean })
  | (Partial<LoadedOnboardingGuideCardProps> & {
      loading: true;
      /** `catalog`: the loading card draws its Published cell. Default true. */ published?: boolean;
    });

/** Markdown source → clean one-line preview prose. The guide cards preview
 *  `video_summary || content`, and `content` is raw markdown — without this,
 *  the clamped summary shows literal `**bold**` / `## heading` noise. */
function stripMarkdownPreview(text: string): string {
  return (
    text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`>]/g, '')
      .replace(/^\s*[-+]\s+/gm, '')
      .replace(/-{3,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Hard cap — line-clamp is the visual truncation, but a CSS-order
      // conflict (display utilities vs -webkit-box) once silently killed it
      // and dumped whole guides into the card. Never ship more than ~2 lines
      // of source text regardless of CSS.
      .replace(/^([\s\S]{240})[\s\S]+$/, '$1…')
  );
}

// The catalog card's boxes, read by the card AND its skeleton, so the two are one size at every width.
const CATALOG_BODY = 'flex flex-col gap-4 p-6';
const CATALOG_ROW = 'flex flex-col gap-4 md:flex-row md:gap-6';
const CATALOG_COVER_COL = 'w-full flex-shrink-0 md:w-[256px]';
const CATALOG_COVER = `relative ${MEDIA_ASPECT.og} w-full overflow-hidden rounded-lg`;
const CATALOG_TEXT = 'flex min-w-0 flex-1 flex-col';
/** Two `text-h2` lines at most. */
const CATALOG_TITLE_ROW = `mb-3 flex items-start text-h2 ${TEXT_LINES_MIN[2]}`;
/** Two `text-h6` lines. */
const CATALOG_SUMMARY_ROW = `text-h6 ${TEXT_LINES_MIN[2]}`;
/** The catalog card's metadata cells before Published (the card's own label). */
const CATALOG_EXTRA_CELL_LABELS = ['Section'];

const HORIZONTAL_SIZE_TOKENS = {
  default: {
    padding: 'p-4',
    step: 'w-8 h-8 text-h6',
    title: 'text-h5',
    summaryClamp: 'line-clamp-2',
  },
} as const;

/** A guide card while it is read, one per density; `portrait` is the shared portrait skeleton with the static chip. */
function OnboardingGuideCardSkeleton({
  size = 'default',
  showTypeBadge = true,
  published = true,
  className,
}: {
  size?: 'catalog' | 'default' | 'sm' | 'portrait';
  /**
   * `catalog`: the metadata grid has its Published cell (the card shows one when the guide carries `published_at`;
   * the related-content rail's rows do not).
   */
  published?: boolean;
  /** `portrait`: the card shows the "Guide" chip. */
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
        typeLabel={showTypeBadge ? GUIDE_TYPE_LABEL : undefined}
        className={className}
      />
    );
  }
  if (size === 'catalog') {
    return (
      <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, 'block', className)} aria-hidden>
        <div className={CATALOG_BODY}>
          <div className={CATALOG_ROW}>
            <div className={CATALOG_COVER_COL}>
              <UnifiedSkeleton className={CATALOG_COVER} />
            </div>
            <div className={CATALOG_TEXT}>
              <div className={CATALOG_TITLE_ROW}>
                {/* The loaded title's clamp, two `text-h2` lines, wherever a typical title wraps (a phone, a tablet's
                    column); one line from lg, where the text column holds a typical title. */}
                <TextLineSkeleton type="h2" lines={2} className="w-3/4 lg:hidden" />
                <TextLineSkeleton type="h2" className="hidden w-3/4 lg:flex" />
              </div>
              <div className={CATALOG_SUMMARY_ROW}>
                <TextLineSkeleton type="h6" lines={2} className="w-full" />
              </div>
            </div>
          </div>
          <EntityAuthorCard
            loading
            author={null}
            extraCells={CATALOG_EXTRA_CELL_LABELS.map(label => ({ value: '', label }))}
            publishedAt={published ? null : undefined}
          />
        </div>
      </div>
    );
  }
  if (size === 'sm') {
    return <CompactCardSkeleton trailingIcon className={className} />;
  }
  const t = HORIZONTAL_SIZE_TOKENS.default;
  return (
    <span
      className={cn(`flex items-start gap-3 rounded-md border border-ods-border bg-ods-card ${t.padding}`, className)}
    >
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ods-bg ${t.step}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <UnifiedSkeleton as="span" className="block h-4 w-2/3 rounded" />
        <UnifiedSkeleton as="span" className="block h-3 w-1/3 rounded" />
        <UnifiedSkeleton as="span" className="block h-3 w-full rounded" />
      </span>
    </span>
  );
}

/** ONE switch: in a loading scope (or `loading`) the card is its own loading form. */
export function OnboardingGuideCard(props: OnboardingGuideCardProps) {
  if (useLoadingScope() || props.loading) {
    return (
      <OnboardingGuideCardSkeleton
        size={props.size}
        showTypeBadge={props.showTypeBadge !== false}
        published={'published' in props ? props.published : props.guide ? props.guide.published_at != null : true}
        className={props.className}
      />
    );
  }
  return <LoadedOnboardingGuideCard {...props} />;
}

function LoadedOnboardingGuideCard({
  guide,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: LoadedOnboardingGuideCardProps) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  });
  const placeholderUrl = useEntityCardPlaceholder({
    title: guide.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  });

  if (size === 'portrait') {
    // Rail/strip density — shared <EntityPortraitCard> shell. Same cover
    // chain as the catalog variant.
    const coverImage = guide.featured_image || guide.main_video_thumbnail || guide.og_image_url || null;
    return (
      <EntityPortraitCard
        href={href}
        target={target}
        rel={rel}
        typeLabel={showTypeBadge ? GUIDE_TYPE_LABEL : undefined}
        imageUrl={coverImage}
        placeholderUrl={placeholderUrl}
        imageAlt={guide.title}
        title={guide.title}
        person={guide.section ? { name: guide.section } : null}
        className={className}
      />
    );
  }

  if (size === 'catalog') {
    const coverImage = guide.featured_image || guide.main_video_thumbnail || guide.og_image_url || null;
    const hasVideoCover = !!(guide.main_video_thumbnail || guide.highlight_video_thumbnail);
    const stepLabel = typeof guide.step_order === 'number' ? String(guide.step_order).padStart(2, '0') : '—';
    const durationLabel =
      typeof guide.highlight_video_duration_ms === 'number' && guide.highlight_video_duration_ms > 0
        ? formatDurationMMSS(Math.floor(guide.highlight_video_duration_ms / 1000))
        : '';

    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        prefetch={false}
        className={cn(CONTENT_CARD_FRAME_CLASS, 'block no-underline', className)}
      >
        <div className={CATALOG_BODY}>
          <div className={CATALOG_ROW}>
            <div className={CATALOG_COVER_COL}>
              <div className={cn(CATALOG_COVER, 'bg-ods-bg')}>
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={guide.title}
                    fill
                    sizes={IMAGE_SLOT.panel}
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <BlogImagePlaceholder
                    title={guide.title}
                    imageUrl={placeholderUrl ?? null}
                    className="absolute inset-0"
                  />
                )}
                {hasVideoCover && coverImage && <CardHoverPlay size="md" />}
                {durationLabel && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-ods-text-on-dark text-code">
                    <Clock className="h-3 w-3" />
                    {durationLabel}
                  </span>
                )}
              </div>
            </div>

            <div className={CATALOG_TEXT}>
              <div className={CATALOG_TITLE_ROW}>
                <h3 className="line-clamp-2 text-ods-text-primary text-h2">{guide.title}</h3>
              </div>
              <div className={CATALOG_SUMMARY_ROW}>
                <p className="line-clamp-2 text-ods-text-secondary text-h6">
                  {stripMarkdownPreview(guide.video_summary || guide.content || '')}
                </p>
              </div>
            </div>
          </div>

          <EntityAuthorCard
            author={guide.author}
            publishedAt={guide.published_at}
            renderEmptyAuthor
            extraCells={[
              {
                value: `${guide.section} · Step ${stepLabel}`,
                label: CATALOG_EXTRA_CELL_LABELS[0],
                uppercase: false,
              },
            ]}
          />
        </div>
      </Link>
    );
  }

  if (size === 'sm') {
    const coverImage = guide.featured_image || guide.main_video_thumbnail || guide.og_image_url || null;
    const compactCover = coverImage || placeholderUrl || null;
    const hasVideoCover = !guide.featured_image && !!guide.main_video_thumbnail;
    const summary = stripMarkdownPreview(guide.video_summary || guide.content || '');
    const author = guide.author?.full_name?.trim() || '';
    const subtitleParts = [`Step ${guide.step_order}`, guide.section, author].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        prefetch={false}
        // `group`: the play mark on a video cover shows on the card's hover.
        className={cn(COMPACT_CARD_OUTER, 'group', className)}
      >
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image src={compactCover} alt={guide.title} fill sizes={fixedImageSlot('tile')} className="object-contain" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              <GraduationCap className="h-4 w-4" />
            </span>
          )}
          {hasVideoCover && compactCover && <CardHoverPlay size="sm" />}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={cn(COMPACT_CARD_TITLE, 'font-heading')}>{guide.title}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="truncate text-ods-accent text-h6">{subtitleParts.join(' · ')}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>{summary || COMPACT_CARD_ROW_FILLER}</span>
          </span>
        </span>
        <span className="flex h-5 shrink-0 items-center self-start text-ods-text-secondary">
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </Link>
    );
  }

  // size === 'default' — horizontal step-numbered card for related-rail.
  const t = HORIZONTAL_SIZE_TOKENS.default;
  const summary = stripMarkdownPreview(guide.video_summary || guide.content || '');

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      prefetch={false}
      className={cn(
        `flex items-start gap-3 rounded-md border border-ods-border bg-ods-card transition-colors hover:border-ods-accent ${t.padding}`,
        className,
      )}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ods-accent/10 font-semibold text-ods-accent ${t.step}`}
        aria-hidden="true"
      >
        {guide.step_order}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`block ${t.title} truncate text-ods-text-primary`}>{guide.title}</span>
        <span className="inline-flex items-center gap-1 text-ods-text-secondary text-h6">
          <GraduationCap className="h-3 w-3 shrink-0" />
          <span className="truncate">{guide.section}</span>
        </span>
        {summary && <span className={`text-ods-text-secondary text-h6 ${t.summaryClamp}`}>{summary}</span>}
      </span>
    </Link>
  );
}
