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

import Image from '../../../embed-shims/next-image';
import type { CaseStudy } from '../../../types/case-study';
import { cn } from '../../../utils/cn';
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
import { EntityPortraitCard } from './entity-portrait-card';
import { hideOnError } from './use-cover-image-fallback';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

export interface CaseStudyCardProps {
  study: CaseStudy;
  /** Detail URL resolved by the caller. */
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL, used when `study.featured_image` is missing. */
  placeholderUrl?: string | null;
  size?: 'default' | 'sm' | 'portrait';
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
    <div className="flex animate-pulse flex-col gap-6 overflow-hidden rounded-lg border border-ods-border bg-ods-card p-6">
      {/* Skeleton aspect matches the real card's image slot (OG 1200×630) */}
      <div className="aspect-[1200/630] w-full rounded-sm bg-ods-bg" />
      <div className="flex h-[72px] flex-col gap-2">
        <div className="h-5 w-3/4 rounded bg-ods-bg" />
        <div className="h-5 w-1/2 rounded bg-ods-bg" />
      </div>
      <div className="flex h-[60px] items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-ods-bg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-ods-bg" />
          <div className="h-3 w-1/2 rounded bg-ods-bg/60" />
        </div>
      </div>
    </div>
  );
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
      <Card className="flex flex-col gap-6 overflow-hidden border border-ods-border bg-ods-card p-6 transition-colors hover:border-ods-accent">
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
