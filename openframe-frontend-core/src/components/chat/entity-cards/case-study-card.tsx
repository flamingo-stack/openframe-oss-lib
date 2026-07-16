'use client'

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

import React from 'react'
import Image from '../../../embed-shims/next-image'
import { Card } from '../../ui/card'
import { cn } from '../../../utils/cn'
import type { CaseStudy } from '../../../types/case-study'
import { EntityPortraitCard } from './entity-portrait-card'
import { useEntityCardLink } from './use-entity-card-link'
import { useEntityCardPlaceholder } from './use-entity-card-placeholder'
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
import { hideOnError } from './use-cover-image-fallback'

export interface CaseStudyCardProps {
  study: CaseStudy
  /** Detail URL resolved by the caller. */
  href: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  targetPlatform?: string | null
  /** OG placeholder URL, used when `study.featured_image` is missing. */
  placeholderUrl?: string | null
  size?: 'default' | 'sm' | 'portrait'
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean
  className?: string
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
    )
  }
  return (
    <div className="bg-ods-card border border-ods-border rounded-lg overflow-hidden p-6 flex flex-col gap-6 animate-pulse">
      {/* Skeleton aspect matches the real card's image slot (OG 1200×630) */}
      <div className="w-full aspect-[1200/630] rounded-sm bg-ods-bg" />
      <div className="h-[72px] flex flex-col gap-2">
        <div className="h-5 w-3/4 bg-ods-bg rounded" />
        <div className="h-5 w-1/2 bg-ods-bg rounded" />
      </div>
      <div className="h-[60px] flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-ods-bg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 bg-ods-bg rounded" />
          <div className="h-3 w-1/2 bg-ods-bg/60 rounded" />
        </div>
      </div>
    </div>
  )
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
  className,
}: CaseStudyCardProps) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  })
  const placeholderUrl = useEntityCardPlaceholder({
    title: study.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  })
  const coverImage = study.featured_image || placeholderUrl || null

  if (size === 'sm') {
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {coverImage ? (
            <img
              src={coverImage}
              alt={`${study.msp?.name || study.title} cover`}
              className="absolute inset-0 block w-full h-full object-contain"
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
            <span className={COMPACT_CARD_SUMMARY}>
              {study.summary || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
      </a>
    )
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
    )
  }

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className="bg-ods-card border border-ods-border hover:border-ods-accent transition-colors p-6 flex flex-col gap-6 overflow-hidden">
        {/* Fixed aspect ratio matches the standard OG card source aspect
            (1200×630 = 1.91:1), so the image fits with near-zero CSS-side
            cropping. Subject anchoring is then a function of the source
            image's center-66% safe zone (OG design convention) — visually
            uniform across all cards regardless of column width. Skeleton
            (lines 73-74) uses the same aspect for consistent layout. */}
        <div className="relative w-full aspect-[1200/630] rounded-sm overflow-hidden bg-ods-bg shrink-0">
          {coverImage && (
            <Image
              src={coverImage}
              alt={study.msp?.name || study.title}
              className="w-full h-full object-cover"
              sizes="(min-width: 1545px) 515px, (min-width: 1280px) 33vw, (min-width: 800px) 50vw, 100vw"
              fill
              unoptimized
              onError={hideOnError}
            />
          )}
        </div>

        <div className="h-[72px] flex items-center shrink-0">
          <p className="text-h4 text-ods-text-primary line-clamp-3 break-words">{study.title}</p>
        </div>

        <div className="h-[60px] flex items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0 w-full">
            <div className="relative shrink-0 w-12 h-12">
              {study.user?.avatar_url ? (
                <Image
                  src={study.user.avatar_url}
                  alt={study.user?.full_name || 'User'}
                  className="w-12 h-12 rounded-full object-cover bg-ods-background border border-ods-border"
                  width={48}
                  height={48}
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-ods-background border border-ods-border flex items-center justify-center">
                  <span className="text-ods-text-secondary font-medium text-xl">
                    {(study.user?.full_name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {study.msp?.icon_url && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ods-text-primary ring-1 ring-ods-bg overflow-hidden flex items-center justify-center">
                  <Image
                    src={study.msp.icon_url}
                    alt={study.msp.name || 'MSP'}
                    className="w-full h-full object-cover"
                    width={24}
                    height={24}
                    unoptimized
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-h6 text-ods-text-primary truncate">
                {study.user?.full_name || 'Anonymous'}
                {study.msp?.name && <span className="text-ods-text-secondary"> • {study.msp.name}</span>}
              </p>
              <p className="text-h6 text-ods-text-secondary truncate">
                {study.user?.job_title || ' '}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </a>
  )
}
