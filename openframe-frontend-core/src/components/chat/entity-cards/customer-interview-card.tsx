'use client';

/**
 * CustomerInterviewCard (pure presentation). Two densities — `default`
 * and `sm` (compact horizontal for chat-inline).
 *
 * The card writes NO click logic — callers wrap with their own anchor
 * and pass the resolved detail URL via `href`.
 */

import { Video } from 'lucide-react';
import Image from '../../../embed-shims/next-image';
import type { CustomerInterview } from '../../../types/customer-interview';
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

export interface CustomerInterviewCardProps {
  interview: CustomerInterview;
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL fallback when `interview.featured_image` is missing. */
  placeholderUrl?: string | null;
  size?: 'default' | 'sm' | 'portrait';
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  className?: string;
}

/** `portrait` shares the default skeleton shape (same zone boxes). */
export function CustomerInterviewCardSkeleton({ size = 'default' }: { size?: 'default' | 'sm' | 'portrait' }) {
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
    );
  }
  return (
    <div className="flex animate-pulse flex-col gap-6 overflow-hidden rounded-lg border border-ods-border bg-ods-card p-6">
      {/* Aspect matches the loaded image slot (OG 1200×630) */}
      <div className="aspect-[1200/630] w-full rounded-sm bg-ods-bg" />
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded bg-ods-bg" />
        <div className="h-5 w-1/2 rounded bg-ods-bg" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-ods-bg/60" />
        <div className="h-3 w-5/6 rounded bg-ods-bg/60" />
        <div className="h-3 w-4/5 rounded bg-ods-bg/60" />
      </div>
      <div className="mt-auto flex h-[60px] items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-ods-bg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-ods-bg" />
          <div className="h-3 w-1/2 rounded bg-ods-bg/60" />
        </div>
      </div>
    </div>
  );
}

export function CustomerInterviewCard({
  interview,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: CustomerInterviewCardProps) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  });
  const placeholderUrl = useEntityCardPlaceholder({
    title: interview.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  });
  const thumbnailUrl = interview.featured_image || placeholderUrl || null;

  if (size === 'sm') {
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={interview.title}
              className="object-contain"
              fill
              sizes="56px"
              unoptimized
              onError={hideOnError}
            />
          ) : null}
          {interview.main_video_url ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Video className="h-4 w-4 text-ods-text-on-dark" />
            </span>
          ) : null}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={COMPACT_CARD_TITLE}>{interview.title}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUBTITLE}>
              {[interview.user?.full_name, interview.msp?.name].filter(Boolean).join(' · ') || 'Customer interview'}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>{interview.video_summary || COMPACT_CARD_ROW_FILLER}</span>
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
        typeLabel={showTypeBadge ? 'Customer Interview' : undefined}
        imageUrl={interview.featured_image}
        placeholderUrl={placeholderUrl}
        imageAlt={interview.title}
        title={interview.title}
        person={{
          name: interview.user?.full_name || 'Customer',
          avatarUrl: interview.user?.avatar_url,
          subtitle: interview.msp?.name ?? null,
          iconOverlayUrl: interview.msp?.icon_url ?? null,
        }}
        className={className}
      />
    );
  }

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className="flex flex-col gap-6 overflow-hidden border border-ods-border bg-ods-card p-6 transition-colors hover:border-ods-accent">
        {/* Fixed aspect matching standard OG card source (1200×630, 1.91:1)
            — image renders with near-zero CSS-side crop, subject anchored
            consistently via center-66% safe-zone convention. */}
        <div className="relative aspect-[1200/630] w-full shrink-0 overflow-hidden rounded-sm bg-ods-bg">
          {thumbnailUrl ? (
            <>
              <Image
                src={thumbnailUrl}
                alt={interview.title}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized
                onError={hideOnError}
              />
              {interview.main_video_url && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ods-accent/90">
                    <Video className="h-8 w-8 text-ods-text-on-accent" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-ods-bg">
              <Video className="h-12 w-12 text-ods-text-secondary" />
            </div>
          )}
        </div>

        <div className="shrink-0">
          <h3 className="line-clamp-2 break-words text-ods-text-primary text-h3">{interview.title}</h3>
        </div>

        {interview.video_summary && (
          <div className="shrink-0">
            <p className="line-clamp-3 text-ods-text-secondary text-h6">{interview.video_summary}</p>
          </div>
        )}

        <div className="mt-auto flex h-[60px] shrink-0 items-center">
          <div className="flex w-full min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              {interview.user?.avatar_url ? (
                <Image
                  src={interview.user.avatar_url}
                  alt={interview.user?.full_name || 'Customer'}
                  className="h-12 w-12 rounded-full border border-ods-border bg-ods-bg object-cover"
                  width={48}
                  height={48}
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ods-border bg-ods-bg">
                  <span className="text-ods-text-secondary text-h4">
                    {(interview.user?.full_name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {interview.msp?.icon_url && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-ods-text-primary ring-1 ring-ods-bg">
                  <Image
                    src={interview.msp.icon_url}
                    alt={interview.msp.name || 'MSP'}
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
                {interview.user?.full_name || 'Anonymous'}
                {interview.msp?.name && <span className="text-ods-text-secondary"> • {interview.msp.name}</span>}
              </p>
              <p className="truncate text-ods-text-secondary text-h6">{interview.user?.job_title || ' '}</p>
            </div>
          </div>
        </div>
      </Card>
    </a>
  );
}
