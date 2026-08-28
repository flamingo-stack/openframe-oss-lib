'use client';

/**
 * InvestorUpdateCard (pure presentation).
 *
 * Two densities — `default` (uses `AdminContentCard`) and `sm` (compact
 * horizontal). The card writes NO click logic — callers wrap with their
 * own anchor and pass the resolved detail URL via `href`.
 */

import { Calendar } from 'lucide-react';
import Image from '../../../embed-shims/next-image';
import { formatInvestorUpdatePeriod, type InvestorUpdate } from '../types/entities/investor-update';
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
import { AdminContentCard } from './admin-content-card';
import { EntityPortraitCard } from './entity-portrait-card';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

export interface InvestorUpdateCardProps {
  update: InvestorUpdate;
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used when `update.featured_image` is missing. */
  placeholderUrl?: string | null;
  size?: 'default' | 'sm' | 'portrait';
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  className?: string;
}

/** `portrait` shares the default skeleton shape (same zone boxes). */
export function InvestorUpdateCardSkeleton({ size = 'default' }: { size?: 'default' | 'sm' | 'portrait' }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={`${COMPACT_CARD_TITLE_ROW} flex-nowrap gap-2`}>
            <span className="h-3.5 w-1/2 rounded bg-ods-bg" />
            <span className="h-4 w-8 shrink-0 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-1/3 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    );
  }
  return (
    <div className="h-full animate-pulse overflow-hidden rounded-lg border border-ods-border bg-ods-card">
      <div className="aspect-[1200/630] bg-ods-bg" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-3/4 rounded bg-ods-bg" />
        <div className="h-3 w-full rounded bg-ods-bg/60" />
        <div className="h-3 w-4/5 rounded bg-ods-bg/60" />
        <div className="h-4 w-1/3 rounded bg-ods-bg/60" />
      </div>
    </div>
  );
}

export function InvestorUpdateCard({
  update,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: InvestorUpdateCardProps) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  });
  const placeholderUrl = useEntityCardPlaceholder({
    title: update.title ?? `Update #${update.update_number ?? ''}`,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  });
  const coverImage = update.featured_image || placeholderUrl || null;

  if (size === 'sm') {
    const periodText = formatInvestorUpdatePeriod(update.period_start, update.period_end);
    return (
      <a href={href} target={target} rel={rel} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {coverImage ? (
            <Image
              src={coverImage}
              alt={update.title ?? 'Investor update'}
              className="object-contain"
              fill
              sizes="56px"
              unoptimized
              onError={e => {
                const img = e.currentTarget;
                img.style.display = 'none';
              }}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              <Calendar className="h-4 w-4" />
            </span>
          )}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={`${COMPACT_CARD_TITLE_ROW} gap-2`}>
            <span className={`${COMPACT_CARD_TITLE} min-w-0`}>
              {update.title || `Update #${update.update_number ?? '?'}`}
            </span>
            {update.update_number ? (
              <span className="shrink-0 rounded bg-ods-accent/10 px-1.5 py-0.5 text-ods-accent text-h6">
                #{update.update_number}
              </span>
            ) : null}
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUBTITLE}>{periodText || 'Investor update'}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {(update.strategic_update || update.content || '').slice(0, 120) || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
      </a>
    );
  }

  if (size === 'portrait') {
    // Rail/strip density — shared <EntityPortraitCard> shell. The reporting
    // period is the meaningful footer line (no fabricated author — no avatar
    // renders an initial circle).
    const periodText = formatInvestorUpdatePeriod(update.period_start, update.period_end);
    return (
      <EntityPortraitCard
        href={href}
        target={target}
        rel={rel}
        typeLabel={showTypeBadge ? 'Investor Update' : undefined}
        imageUrl={update.featured_image}
        placeholderUrl={placeholderUrl}
        imageAlt={update.title ?? 'Investor update'}
        title={update.title || `Update #${update.update_number ?? '?'}`}
        person={periodText ? { name: periodText } : null}
        className={className}
      />
    );
  }

  return (
    <a href={href} target={target} rel={rel} className={`block h-full ${className ?? ''}`}>
      <AdminContentCard
        imageUrl={update.featured_image}
        placeholderUrl={placeholderUrl}
        title={update.title || `Update #${update.update_number || '?'}`}
        summary={update.strategic_update?.slice(0, 120) || update.content?.slice(0, 120) || 'No description'}
        badges={
          update.update_number ? (
            <span className="rounded bg-ods-accent/10 px-2 py-0.5 text-xs font-medium text-ods-accent">
              #{update.update_number}
            </span>
          ) : undefined
        }
        meta={
          update.period_start || update.period_end ? (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatInvestorUpdatePeriod(update.period_start, update.period_end)}</span>
            </div>
          ) : undefined
        }
      />
    </a>
  );
}
