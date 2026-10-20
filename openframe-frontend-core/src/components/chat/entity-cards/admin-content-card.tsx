'use client';

import type React from 'react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { MEDIA_ASPECT } from '../../../styles/component-sizes';
import { cn } from '../../../utils/cn';
import { PlatformBadge, PlatformBadgeSkeleton } from '../../features/platform-badge';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';

// The card's boxes, read by the card AND `AdminContentCardSkeleton`, so the two are one size at every width.
const ADMIN_CARD_FRAME = 'flex h-full flex-col';
const ADMIN_CARD_COVER = `relative ${MEDIA_ASPECT.photo} w-full shrink-0 overflow-hidden`;
/** `p-5` has no ODS token (20px); it is the card's own padding. */
const ADMIN_CARD_BODY = 'flex flex-1 flex-col gap-3 p-5';
const ADMIN_CARD_BADGES = 'flex flex-wrap items-center gap-2';
const ADMIN_CARD_BADGES_RESERVED = 'min-h-7';
const ADMIN_CARD_META = 'flex items-center gap-3 text-ods-text-secondary text-h6';
const ADMIN_CARD_ACTIONS = 'mt-auto flex items-center justify-between border-t border-ods-border pt-3';

interface PlatformInfo {
  platform_id?: string;
  id?: string;
  name: string;
  display_name?: string;
}

interface AdminContentCardProps {
  /** Cover image URL */
  imageUrl?: string | null;
  /** Pre-computed placeholder URL used when `imageUrl` is missing or
   *  fails to load. Hub callers pass `useOgPlaceholderUrl({ title })`; embedders
   *  supply their own URL or leave null for a plain background fallback. */
  placeholderUrl?: string | null;
  /** Alt text / fallback title */
  title: string;
  /** Summary or description text */
  summary?: string | null;
  /** Subtitle line (e.g. customer name) */
  subtitle?: string | null;
  /** Platform badges */
  platforms?: PlatformInfo[];
  /** Status/info badges rendered after platform badges */
  badges?: React.ReactNode;
  /** Meta info row (date, views, etc.) */
  meta?: React.ReactNode;
  /** Action buttons row */
  actions?: React.ReactNode;
  /**
   * Keep every row's space even when its content is short or absent: a two-line
   * title, the subtitle line, a two-line summary, a 28px badges row and the meta
   * line. Every card in a grid is then the same height, which is what
   * `AdminContentCardGrid` and `AdminContentCardSkeleton` reserve. Default false.
   */
  reserveRows?: boolean;
  /**
   * Whether this KIND of card has a subtitle line at all. A card type that never
   * carries one (an employee entry) passes false, and `reserveRows` then keeps no
   * empty line for it; its skeleton passes the same. Default true.
   */
  subtitleRow?: boolean;
  /** Additional class names */
  className?: string;
}

export function AdminContentCard({
  imageUrl,
  placeholderUrl,
  title,
  summary,
  subtitle,
  platforms,
  badges,
  meta,
  actions,
  reserveRows = false,
  subtitleRow = true,
  className,
}: AdminContentCardProps) {
  const [imageError, setImageError] = useState(false);
  // WHICH url finished loading, rather than a bare flag reset from an effect on
  // every url change. The reset is then implicit — a new url simply is not the
  // one that loaded — so the skeleton is back in the SAME render that swapped
  // the src, instead of one commit later where the new image briefly showed
  // through at full opacity before being faded back out.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const displayUrl = imageUrl && !imageError ? imageUrl : placeholderUrl;
  const imageLoaded = Boolean(displayUrl) && loadedUrl === displayUrl;
  const imageBgColor = useImageEdgeColor(displayUrl || null, 'transparent');

  if (useLoadingScope()) {
    return (
      <AdminContentCardSkeleton className={className} subtitleRow={subtitleRow} actions={actions ? actions : false} />
    );
  }

  return (
    <article className={cn(CONTENT_CARD_FRAME_CLASS, ADMIN_CARD_FRAME, className)}>
      {/* Cover Image — 3:2 aspect ratio, centered with edge-color fill */}
      <div className={ADMIN_CARD_COVER} style={{ backgroundColor: imageBgColor }}>
        {displayUrl ? (
          <>
            {!imageLoaded && <UnifiedSkeleton className="absolute inset-0 h-full rounded-none" />}
            <Image
              src={displayUrl}
              alt={title}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className={cn(
                'object-contain object-center',
                'transition-transform duration-500 ease-out',
                'group-hover:scale-[1.03]',
                imageLoaded ? 'opacity-100' : 'opacity-0',
              )}
              unoptimized
              onLoad={() => setLoadedUrl(displayUrl ?? null)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-ods-bg" />
        )}
      </div>

      {/* Content */}
      <div className={ADMIN_CARD_BODY}>
        {/* Title */}
        <h3 className={cn('line-clamp-2 break-words text-ods-text-primary text-h3', reserveRows && 'min-h-[2lh]')}>
          {title}
        </h3>

        {/* Subtitle (optional) */}
        {(subtitle || (reserveRows && subtitleRow)) && (
          <p className={cn('truncate text-ods-text-secondary text-h6', reserveRows && 'min-h-[1lh]')}>{subtitle}</p>
        )}

        {/* Summary */}
        {(summary || reserveRows) && (
          <p className={cn('line-clamp-2 text-ods-text-secondary text-h6', reserveRows && 'min-h-[2lh]')}>{summary}</p>
        )}

        {/* Badges row */}
        {(Number(platforms?.length) > 0 || badges || reserveRows) && (
          <div className={cn(ADMIN_CARD_BADGES, reserveRows && ADMIN_CARD_BADGES_RESERVED)}>
            {platforms?.map(p => (
              <PlatformBadge
                key={p.platform_id || p.id}
                platform={{ id: p.id || p.platform_id || '', name: p.name, display_name: p.display_name || p.name }}
                size="xs"
              />
            ))}
            {badges}
          </div>
        )}

        {/* Meta row */}
        {(meta || reserveRows) && <div className={cn(ADMIN_CARD_META, reserveRows && 'min-h-[1lh]')}>{meta}</div>}

        {/* Actions — pushed to bottom */}
        {actions && <div className={ADMIN_CARD_ACTIONS}>{actions}</div>}
      </div>
    </article>
  );
}

/**
 * One `AdminContentCard reserveRows`-shaped placeholder, in the card's own boxes: the 3:2 cover, a two-line `text-h3`
 * title, the subtitle line, a two-line `text-h6` summary, the 28px badges row, the meta line and the bordered actions
 * row. The actions are the caller's own controls (static) when it passes them, bars otherwise.
 */
export function AdminContentCardSkeleton({
  className,
  actions = true,
  subtitleRow = true,
}: {
  className?: string;
  /** Matches the card's `subtitleRow`: off for a card type that has no subtitle line. */
  subtitleRow?: boolean;
  /**
   * The bordered actions row: `true` draws button bars, a node draws those controls for real, `false` (a read-only
   * rail card) draws none.
   */
  actions?: boolean | React.ReactNode;
}) {
  return (
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, ADMIN_CARD_FRAME, className)} aria-hidden>
      <UnifiedSkeleton className={cn(ADMIN_CARD_COVER, 'rounded-none')} />
      <div className={ADMIN_CARD_BODY}>
        <TextLineSkeleton type="h3" lines={2} className="w-full" />
        {subtitleRow && <TextLineSkeleton type="h6" className="w-1/2" />}
        <TextLineSkeleton type="h6" lines={2} className="w-full" />
        <div className={cn(ADMIN_CARD_BADGES, ADMIN_CARD_BADGES_RESERVED)}>
          <PlatformBadgeSkeleton size="xs" />
          <PlatformBadgeSkeleton size="xs" />
        </div>
        <div className={ADMIN_CARD_META}>
          <TextLineSkeleton type="h6" className="w-32" />
        </div>
        {actions === true ? (
          <div className={ADMIN_CARD_ACTIONS}>
            {/* The admin cards' actions are `small-legacy` buttons: their own size classes, never a copied box. */}
            <InteractiveSkeleton.Button size="small-legacy" />
            <div className="flex gap-[var(--spacing-system-xsf)]">
              <InteractiveSkeleton.Button size="small-legacy" className="w-20" />
              <InteractiveSkeleton.Button size="small-legacy" className="w-20" />
            </div>
          </div>
        ) : actions ? (
          // The caller's own controls, drawn as they are but never focused while the card is a skeleton.
          <div className={ADMIN_CARD_ACTIONS} inert>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
