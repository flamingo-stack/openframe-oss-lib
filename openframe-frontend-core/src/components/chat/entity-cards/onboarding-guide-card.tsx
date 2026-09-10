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

import { Clock, ExternalLink, GraduationCap, Play } from 'lucide-react';
import Image from '../../../embed-shims/next-image';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { formatDurationMMSS } from '../../../utils/format';
import type { OnboardingGuide } from '../types/entities/onboarding-guide';
import {
  COMPACT_CARD_OUTER,
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE_ROW,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_ROW_FILLER,
} from '../utils/compact-card-classes';
import { BlogImagePlaceholder } from './blog-image-placeholder';
import { EntityAuthorCard } from './entity-author-card';
import { EntityPortraitCard } from './entity-portrait-card';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

export interface OnboardingGuideCardProps {
  guide: OnboardingGuide;
  /** Detail URL resolved by the caller. */
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used by the catalog + sm variants when no cover. */
  placeholderUrl?: string | null;
  size?: 'catalog' | 'default' | 'sm' | 'portrait';
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean | 'default' | 'sm' | 'portrait';
  className?: string;
}

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

const HORIZONTAL_SIZE_TOKENS = {
  default: {
    padding: 'p-4',
    step: 'w-8 h-8 text-h6',
    title: 'text-h5',
    summaryClamp: 'line-clamp-2',
  },
} as const;

export function OnboardingGuideCardSkeleton({ size = 'default' }: { size?: 'catalog' | 'default' | 'sm' }) {
  if (size === 'catalog') {
    return (
      <div className="flex animate-pulse flex-col gap-4 overflow-hidden rounded-lg border border-ods-border bg-ods-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <div className="aspect-[1200/630] w-full flex-shrink-0 rounded-lg bg-ods-border md:w-[256px]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-3 flex min-h-[60px] flex-col justify-start gap-1.5 md:min-h-[72px]">
              <div className="h-[25px] w-3/4 rounded bg-ods-border md:h-[30px]" />
              <div className="h-[25px] w-1/2 rounded bg-ods-border md:h-[30px]" />
            </div>
            <div className="flex min-h-[46px] flex-col justify-start gap-2 md:min-h-[52px]">
              <div className="h-3 w-full rounded bg-ods-border/70" />
              <div className="h-3 w-5/6 rounded bg-ods-border/70" />
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-md border border-ods-border md:grid-cols-3">
          {[0, 1].map(i => (
            <div
              key={`cell-${i}`}
              className="flex flex-col gap-3 border-b border-ods-border bg-ods-card p-4 md:border-b-0 md:border-r"
            >
              <div className="flex flex-col gap-2">
                <div className="h-6 w-32 rounded bg-ods-bg" />
                <div className="h-3 w-20 rounded bg-ods-bg/60" />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-ods-card p-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-ods-bg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-4 w-3/4 rounded bg-ods-bg" />
              <div className="h-3 w-1/2 rounded bg-ods-bg/60" />
            </div>
          </div>
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
            <span className="h-3 w-2/5 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
        <span className="flex h-5 shrink-0 items-center self-start">
          <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
        </span>
      </span>
    );
  }
  const t = HORIZONTAL_SIZE_TOKENS.default;
  return (
    <span
      className={`flex items-start gap-3 rounded-md border border-ods-border bg-ods-card ${t.padding} animate-pulse`}
    >
      <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ods-bg ${t.step}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="block h-4 w-2/3 rounded bg-ods-bg" />
        <span className="block h-3 w-1/3 rounded bg-ods-bg/70" />
        <span className="block h-3 w-full rounded bg-ods-bg/40" />
      </span>
    </span>
  );
}

export function OnboardingGuideCard({
  guide,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: OnboardingGuideCardProps) {
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
        typeLabel={showTypeBadge ? 'Guide' : undefined}
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
        className={cn(
          'group block bg-ods-card no-underline',
          'overflow-hidden rounded-lg border border-ods-border',
          'transition-all duration-300 ease-out',
          'transform hover:translate-y-[-2px]',
          'hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]',
          className,
        )}
        aria-label={`Open ${guide.title}`}
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:gap-6">
            <div className="w-full flex-shrink-0 md:w-[256px]">
              <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg bg-ods-bg">
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={guide.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 256px"
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
                {hasVideoCover && coverImage && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-10 w-10 text-ods-text-on-dark" fill="white" />
                  </span>
                )}
                {durationLabel && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-ods-text-on-dark text-code">
                    <Clock className="h-3 w-3" />
                    {durationLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex min-h-[60px] items-start md:min-h-[72px]">
                <h3 className="line-clamp-2 text-ods-text-primary text-h2">{guide.title}</h3>
              </div>
              <div className="min-h-[46px] md:min-h-[52px]">
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
                label: 'Section',
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
      <Link href={href} target={target} rel={rel} prefetch={false} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image src={compactCover} alt={guide.title} fill sizes="56px" className="object-contain" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              <GraduationCap className="h-4 w-4" />
            </span>
          )}
          {hasVideoCover && compactCover && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-4 w-4 text-ods-text-on-dark" fill="white" />
            </span>
          )}
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
