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
import Link from '../../../embed-shims/next-link';
import { MEDIA_ASPECT } from '../../../styles/component-sizes';
import type { CustomerInterview } from '../../../types/customer-interview';
import { cn } from '../../../utils/cn';
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

interface LoadedCustomerInterviewCardProps {
  interview: CustomerInterview;
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL fallback when `interview.featured_image` is missing. */
  placeholderUrl?: string | null;
  size?: 'default' | 'sm' | 'portrait';
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  className?: string;
}

/**
 * The record and its link, or `loading` while the host reads it: the card then draws its own loading form, as it
 * does in a loading scope.
 */
export type CustomerInterviewCardProps =
  | (LoadedCustomerInterviewCardProps & { loading?: boolean })
  | (Partial<LoadedCustomerInterviewCardProps> & { loading: true });

// The default card's boxes, read by the card AND its skeleton, so the two are one size at every width.
const INTERVIEW_CARD_BODY = 'flex flex-col gap-6 p-6';
const INTERVIEW_CARD_COVER = `relative ${MEDIA_ASPECT.og} w-full shrink-0 overflow-hidden rounded-sm`;
const INTERVIEW_CARD_PERSON_ZONE = 'mt-auto flex h-[60px] shrink-0 items-center';
const INTERVIEW_CARD_PERSON_ROW = 'flex w-full min-w-0 items-center gap-3';
const INTERVIEW_CARD_PERSON_TEXT = 'min-w-0 flex-1';
/** The content-type chip a portrait interview card shows (a static label). */
const INTERVIEW_TYPE_LABEL = 'Customer Interview';

/**
 * An interview card while it is read, in the card's own boxes: the cover, the title as two `text-h3` lines, the
 * summary as three `text-h6` lines, and the person row (48px portrait, name and job-title lines). `portrait` is the
 * shared portrait skeleton with the static chip.
 */
function CustomerInterviewCardSkeleton({
  size = 'default',
  showTypeBadge = true,
  className,
}: {
  size?: 'default' | 'sm' | 'portrait';
  /** `portrait`: the card shows the "Customer Interview" chip. */
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
        typeLabel={showTypeBadge ? INTERVIEW_TYPE_LABEL : undefined}
        className={className}
      />
    );
  }
  if (size === 'sm') {
    return <CompactCardSkeleton className={className} />;
  }
  return (
    <div className={cn('block h-full', className)} aria-hidden>
      <Card className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, INTERVIEW_CARD_BODY)}>
        <UnifiedSkeleton className={cn(INTERVIEW_CARD_COVER, 'rounded-sm')} />
        <div className="shrink-0">
          <TextLineSkeleton type="h3" lines={2} className="w-full" />
        </div>
        <div className="shrink-0">
          <TextLineSkeleton type="h6" lines={3} className="w-full" />
        </div>
        <div className={INTERVIEW_CARD_PERSON_ZONE}>
          <div className={INTERVIEW_CARD_PERSON_ROW}>
            <MediaSkeleton.Avatar size="md" className="shrink-0" />
            <div className={INTERVIEW_CARD_PERSON_TEXT}>
              <TextLineSkeleton type="h6" className="w-2/3" />
              <TextLineSkeleton type="h6" className="w-1/2" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** ONE switch: in a loading scope (or `loading`) the card is its own loading form. */
export function CustomerInterviewCard(props: CustomerInterviewCardProps) {
  if (useLoadingScope() || props.loading) {
    return (
      <CustomerInterviewCardSkeleton
        size={props.size}
        showTypeBadge={props.showTypeBadge}
        className={props.className}
      />
    );
  }
  return <LoadedCustomerInterviewCard {...props} />;
}

function LoadedCustomerInterviewCard({
  interview,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: LoadedCustomerInterviewCardProps) {
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
      <Link href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
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
            <span data-loading-optional className="absolute inset-0 flex items-center justify-center bg-black/30">
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
        typeLabel={showTypeBadge ? INTERVIEW_TYPE_LABEL : undefined}
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
    <Link href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className={cn(CONTENT_CARD_FRAME_CLASS, INTERVIEW_CARD_BODY)}>
        {/* Fixed aspect matching standard OG card source (1200×630, 1.91:1)
            — image renders with near-zero CSS-side crop, subject anchored
            consistently via center-66% safe-zone convention. */}
        <div className={cn(INTERVIEW_CARD_COVER, 'bg-ods-bg')}>
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
                <div data-loading-optional className="absolute inset-0 flex items-center justify-center bg-black/40">
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

        <div className={INTERVIEW_CARD_PERSON_ZONE}>
          <div className={INTERVIEW_CARD_PERSON_ROW}>
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
                <div
                  data-loading-optional
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-ods-text-primary ring-1 ring-ods-bg"
                >
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
            <div className={INTERVIEW_CARD_PERSON_TEXT}>
              <p className="truncate text-ods-text-primary text-h6">
                {interview.user?.full_name || 'Anonymous'}
                {interview.msp?.name && (
                  <span data-loading-optional className="text-ods-text-secondary">
                    {' '}
                    • {interview.msp.name}
                  </span>
                )}
              </p>
              <p className="truncate text-ods-text-secondary text-h6">{interview.user?.job_title || ' '}</p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
