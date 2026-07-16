'use client'

/**
 * BlogCard (pure presentation).
 *
 * Two densities:
 *   - `default`: full vertical card with cover, title, summary, author/date
 *     footer.
 *   - `sm`: compact horizontal card (~80px tall) for chat-inline rendering.
 *
 * The card writes NO click logic — callers wrap with their own anchor
 * (e.g. hub's `<NavLinkAnchor>` or lib's `<NavLinkAnchorViaRuntime>`)
 * and pass the resolved detail URL via `href`.
 *
 * Image-fallback chain:
 *   `post.featured_image` → `placeholderUrl` (caller passes
 *   `useOgPlaceholderUrl(...)` from the hub OR any pre-resolved URL) →
 *   `bg-ods-bg` (via the slot's background).
 */

import React from 'react'
import { Eye } from 'lucide-react'
import Image from '../../../embed-shims/next-image'
import { StatusBadge } from '../../ui/status-badge'
import { cn } from '../../../utils/cn'
import type { BlogPostSummary } from '../../../types/blog'
import { EntityPortraitCard } from './entity-portrait-card'
import { useEntityCardLink } from './use-entity-card-link'
import { useEntityCardPlaceholder } from './use-entity-card-placeholder'
import { useCoverImageFallback } from './use-cover-image-fallback'
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
} from '../utils/compact-card-classes'

export interface BlogCardProps {
  post: BlogPostSummary
  /** Detail URL resolved by the caller (e.g. `buildContentURL`). */
  href: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  /** Platform that owns `href`. Used by parent wrappers; the card
   *  itself doesn't read it but exposes the prop for the standard
   *  pure-presentation contract. */
  targetPlatform?: string | null
  /** Placeholder URL when `post.featured_image` is missing. Caller
   *  resolves via `useOgPlaceholderUrl` (hub) or a static asset. */
  placeholderUrl?: string | null
  size?: 'default' | 'sm' | 'portrait'
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean
  className?: string
  /** Surfaces a "Video" badge in compact mode. */
  hasEmbeddedVideo?: boolean
  /** Optional render-prop for the title-area anchor in `default` mode.
   *  When omitted the title renders as plain text (caller wraps the
   *  whole card if it wants a link). */
  priority?: boolean
}

/** `portrait` shares the default skeleton shape (same zone boxes). */
export function BlogCardSkeleton({ size = 'default' }: { size?: 'default' | 'sm' | 'portrait' }) {
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
      </span>
    )
  }
  return (
    <article className="group bg-ods-card border border-ods-border rounded-lg overflow-hidden h-full flex flex-col animate-pulse">
      <div className="aspect-[1200/630] bg-ods-bg" />
      <div className="p-4 flex flex-col flex-grow space-y-3">
        <div className="h-5 w-3/4 bg-ods-bg rounded" />
        <div className="h-5 w-1/2 bg-ods-bg rounded" />
        <div className="h-3 w-full bg-ods-bg/60 rounded" />
        <div className="h-3 w-4/5 bg-ods-bg/60 rounded" />
        <div className="mt-auto flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-ods-bg" />
          <div className="h-3 w-24 bg-ods-bg/60 rounded" />
        </div>
      </div>
    </article>
  )
}

export function BlogCard({
  post,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
  hasEmbeddedVideo = false,
  priority = false,
}: BlogCardProps) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  })
  const placeholderUrl = useEntityCardPlaceholder({
    title: post.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  })
  // Shared cover → placeholder → hide chain (ONE fallback logic for all cards).
  const { src: displayImage, onError: onImageError } = useCoverImageFallback(post.featured_image, placeholderUrl)

  if (size === 'sm') {
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : ''
    const firstCategory = post.categories?.find((c) => c && c.name)?.name
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={cn(COMPACT_CARD_OUTER, className)}
        aria-label={`Read article: ${post.title}`}
      >
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {displayImage ? (
            <Image
              src={displayImage}
              alt={post.title}
              fill
              sizes="56px"
              className="object-contain"
              unoptimized
              onError={onImageError}
            />
          ) : null}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={cn(COMPACT_CARD_TITLE_ROW, 'gap-1.5')}>
            <span className={cn(COMPACT_CARD_TITLE, 'font-body')}>
              {post.title}
            </span>
            {hasEmbeddedVideo ? (
              <StatusBadge text="Video" variant="button" colorScheme="cyan" className="shrink-0" />
            ) : null}
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUBTITLE}>
              {dateStr}{dateStr && firstCategory ? ' · ' : ''}{firstCategory ?? 'Blog Post'}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {post.summary || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
      </a>
    )
  }

  if (size === 'portrait') {
    // Rail/strip density — shared <EntityPortraitCard> shell. Raw cover +
    // placeholder go in separately; the shell runs the SAME shared
    // useCoverImageFallback chain internally (so its error recovery works).
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : ''
    return (
      <EntityPortraitCard
        href={href}
        target={target}
        rel={rel}
        typeLabel={showTypeBadge ? 'Blog Post' : undefined}
        imageUrl={post.featured_image}
        placeholderUrl={placeholderUrl}
        imageAlt={post.title}
        title={post.title}
        person={{
          name: post.author_name || 'Anonymous',
          avatarUrl: post.author_avatar,
          subtitle: dateStr || null,
        }}
        className={className}
      />
    )
  }

  // Default: full vertical card.
  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : ''
  return (
    <article
      className={cn(
        'group bg-ods-card border border-ods-border rounded-lg overflow-hidden',
        'transition-all duration-300 ease-out',
        'transform hover:translate-y-[-2px]',
        'hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]',
        'h-full flex flex-col',
        className,
      )}
      role="article"
    >
      <a
        href={href}
        target={target}
        rel={rel}
        className="flex flex-col h-full focus:outline-none"
        aria-label={`Read article: ${post.title}`}
      >
        <div className="relative w-full aspect-[1200/630] overflow-hidden bg-ods-bg">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={post.title}
              fill
              priority={priority}
              quality={priority ? 85 : 75}
              className={cn(
                'object-cover object-center',
                'transition-all duration-400 ease-out',
                'hover:scale-[1.02]',
              )}
              sizes="(max-width: 768px) 100vw, (max-width: 1519px) 50vw, 33vw"
              unoptimized
              onError={onImageError}
            />
          ) : null}
        </div>

        <div className="p-4 flex flex-col flex-grow">
          <div className="mb-3 flex items-center min-h-[50.4px] md:min-h-[56px] lg:min-h-[61.6px]">
            <h3
              className={cn(
                "font-['DM_Sans'] font-bold text-ods-text-primary",
                'text-lg md:text-xl lg:text-[22px]',
                'leading-[1.4] tracking-[-0.02em]',
                'line-clamp-2',
                'transition-colors duration-300 ease-out',
                'group-hover:text-ods-accent',
              )}
            >
              {post.title}
            </h3>
          </div>

          <div className="mb-3 flex items-center min-h-[42px] md:min-h-[45px] lg:min-h-[48px]">
            <p
              className={cn(
                'text-h6 text-ods-text-primary',
                'line-clamp-2',
              )}
            >
              {post.summary || ''}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 text-h6 text-ods-text-secondary">
            <div className="flex items-center gap-2 min-w-0">
              {post.author_avatar ? (
                <Image
                  src={post.author_avatar}
                  alt={post.author_name || ''}
                  width={32}
                  height={32}
                  className="rounded-full shrink-0"
                  unoptimized
                />
              ) : null}
              <span className="truncate">
                {post.author_name || 'Anonymous'}
                {dateStr ? <> · {dateStr}</> : null}
              </span>
            </div>
            <div
              className="flex items-center gap-1 shrink-0"
              aria-label={`View count: ${(post.view_count ?? 0).toLocaleString('en-US')} views`}
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>{(post.view_count ?? 0).toLocaleString('en-US')}</span>
            </div>
          </div>
        </div>
      </a>
    </article>
  )
}
