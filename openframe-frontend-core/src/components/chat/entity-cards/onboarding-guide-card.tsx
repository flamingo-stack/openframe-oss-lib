'use client'

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

import React from 'react'
import Image from '../../../embed-shims/next-image'
import Link from '../../../embed-shims/next-link'
import { Clock, ExternalLink, GraduationCap, Play } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { BlogImagePlaceholder } from './blog-image-placeholder'
import { EntityAuthorCard } from './entity-author-card'
import { EntityPortraitCard } from './entity-portrait-card'
import { formatDurationMMSS } from '../../../utils/format'
import type { OnboardingGuide } from '../types/entities/onboarding-guide'
import { useEntityCardLink } from './use-entity-card-link'
import { useEntityCardPlaceholder } from './use-entity-card-placeholder'
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
} from '../utils/compact-card-classes'

export interface OnboardingGuideCardProps {
  guide: OnboardingGuide
  /** Detail URL resolved by the caller. */
  href: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  targetPlatform?: string | null
  /** OG placeholder URL used by the catalog + sm variants when no cover. */
  placeholderUrl?: string | null
  size?: 'catalog' | 'default' | 'sm' | 'portrait'
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean
| 'default' | 'sm' | 'portrait'
  className?: string
}

/** Markdown source → clean one-line preview prose. The guide cards preview
 *  `video_summary || content`, and `content` is raw markdown — without this,
 *  the clamped summary shows literal `**bold**` / `## heading` noise. */
function stripMarkdownPreview(text: string): string {
  return text
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
}

const HORIZONTAL_SIZE_TOKENS = {
  default: {
    padding: 'p-4',
    step: 'w-8 h-8 text-h6',
    title: 'text-h5',
    summaryClamp: 'line-clamp-2',
  },
} as const

export function OnboardingGuideCardSkeleton({ size = 'default' }: { size?: 'catalog' | 'default' | 'sm' }) {
  if (size === 'catalog') {
    return (
      <div className="bg-ods-card border border-ods-border rounded-lg overflow-hidden flex flex-col p-6 gap-4 animate-pulse">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-[256px] aspect-[1200/630] bg-ods-border rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="min-h-[60px] md:min-h-[72px] flex flex-col gap-1.5 justify-start mb-3">
              <div className="h-[25px] md:h-[30px] w-3/4 bg-ods-border rounded" />
              <div className="h-[25px] md:h-[30px] w-1/2 bg-ods-border rounded" />
            </div>
            <div className="min-h-[46px] md:min-h-[52px] flex flex-col gap-2 justify-start">
              <div className="h-3 w-full bg-ods-border/70 rounded" />
              <div className="h-3 w-5/6 bg-ods-border/70 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 border border-ods-border rounded-md overflow-hidden w-full">
          {[0, 1].map((i) => (
            <div
              key={`cell-${i}`}
              className="bg-ods-card p-4 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-ods-border"
            >
              <div className="flex flex-col gap-2">
                <div className="h-6 w-32 bg-ods-bg rounded" />
                <div className="h-3 w-20 bg-ods-bg/60 rounded" />
              </div>
            </div>
          ))}
          <div className="bg-ods-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-ods-bg shrink-0" />
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="h-4 w-3/4 bg-ods-bg rounded" />
              <div className="h-3 w-1/2 bg-ods-bg/60 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
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
        <span className="flex shrink-0 items-center self-start h-5">
          <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
        </span>
      </span>
    )
  }
  const t = HORIZONTAL_SIZE_TOKENS.default
  return (
    <span
      className={`flex items-start gap-3 rounded-md border border-ods-border bg-ods-card ${t.padding} animate-pulse`}
    >
      <span className={`shrink-0 inline-flex items-center justify-center rounded-full bg-ods-bg ${t.step}`} />
      <span className="flex flex-col gap-2 flex-1 min-w-0">
        <span className="block h-4 w-2/3 rounded bg-ods-bg" />
        <span className="block h-3 w-1/3 rounded bg-ods-bg/70" />
        <span className="block h-3 w-full rounded bg-ods-bg/40" />
      </span>
    </span>
  )
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
  })
  const placeholderUrl = useEntityCardPlaceholder({
    title: guide.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  })

  if (size === 'portrait') {
    // Rail/strip density — shared <EntityPortraitCard> shell. Same cover
    // chain as the catalog variant.
    const coverImage =
      guide.featured_image ||
      guide.main_video_thumbnail ||
      guide.og_image_url ||
      null
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
    )
  }

  if (size === 'catalog') {
    const coverImage =
      guide.featured_image ||
      guide.main_video_thumbnail ||
      guide.og_image_url ||
      null
    const hasVideoCover = !!(guide.main_video_thumbnail || guide.highlight_video_thumbnail)
    const stepLabel =
      typeof guide.step_order === 'number'
        ? String(guide.step_order).padStart(2, '0')
        : '—'
    const durationLabel =
      typeof guide.highlight_video_duration_ms === 'number' && guide.highlight_video_duration_ms > 0
        ? formatDurationMMSS(Math.floor(guide.highlight_video_duration_ms / 1000))
        : ''

    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        prefetch={false}
        className={cn(
          'group block no-underline bg-ods-card',
          'border border-ods-border rounded-lg overflow-hidden',
          'transition-all duration-300 ease-out',
          'transform hover:translate-y-[-2px]',
          'hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]',
          className,
        )}
        aria-label={`Open ${guide.title}`}
      >
        <div className="flex flex-col p-6 gap-4">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <div className="w-full md:w-[256px] flex-shrink-0">
              <div className="relative rounded-lg overflow-hidden w-full aspect-[1200/630] bg-ods-bg">
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
                    <Play className="w-10 h-10 text-ods-text-on-dark" fill="white" />
                  </span>
                )}
                {durationLabel && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-ods-text-on-dark text-xs font-medium font-mono">
                    <Clock className="w-3 h-3" />
                    {durationLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="min-h-[60px] md:min-h-[72px] flex items-start mb-3">
                <h3 className="text-h2 text-ods-text-primary line-clamp-2">
                  {guide.title}
                </h3>
              </div>
              <div className="min-h-[46px] md:min-h-[52px]">
                <p className="text-h6 text-ods-text-secondary line-clamp-2">
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
    )
  }

  if (size === 'sm') {
    const coverImage = guide.featured_image || guide.main_video_thumbnail || guide.og_image_url || null
    const compactCover = coverImage || placeholderUrl || null
    const hasVideoCover = !guide.featured_image && !!guide.main_video_thumbnail
    const summary = stripMarkdownPreview(guide.video_summary || guide.content || '')
    const author = guide.author?.full_name?.trim() || ''
    const subtitleParts = [
      `Step ${guide.step_order}`,
      guide.section,
      author,
    ].filter((s): s is string => typeof s === 'string' && s.length > 0)
    return (
      <Link href={href} target={target} rel={rel} prefetch={false} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image
              src={compactCover}
              alt={guide.title}
              fill
              sizes="56px"
              className="object-contain"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              <GraduationCap className="w-4 h-4" />
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
            <span className={cn(COMPACT_CARD_TITLE, 'font-heading')}>
              {guide.title}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="truncate text-[11px] leading-4 text-ods-accent">
              {subtitleParts.join(' · ')}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {summary || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center self-start h-5 text-ods-text-secondary">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </Link>
    )
  }

  // size === 'default' — horizontal step-numbered card for related-rail.
  const t = HORIZONTAL_SIZE_TOKENS.default
  const summary = stripMarkdownPreview(guide.video_summary || guide.content || '')

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      prefetch={false}
      className={cn(
        `flex items-start gap-3 rounded-md border border-ods-border bg-ods-card hover:border-ods-accent transition-colors ${t.padding}`,
        className,
      )}
    >
      <span
        className={`shrink-0 inline-flex items-center justify-center rounded-full bg-ods-accent/10 text-ods-accent font-semibold ${t.step}`}
        aria-hidden="true"
      >
        {guide.step_order}
      </span>
      <span className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className={`block ${t.title} text-ods-text-primary truncate`}>{guide.title}</span>
        <span className="inline-flex items-center gap-1 text-h6 text-ods-text-secondary">
          <GraduationCap className="h-3 w-3 shrink-0" />
          <span className="truncate">{guide.section}</span>
        </span>
        {summary && (
          <span className={`text-h6 text-ods-text-secondary ${t.summaryClamp}`}>
            {summary}
          </span>
        )}
      </span>
    </Link>
  )
}
