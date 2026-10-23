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
import Link from '../../../embed-shims/next-link';
import { useLoadingScope } from '../../ui/loading-scope';
import { formatInvestorUpdatePeriod, type InvestorUpdate } from '../types/entities/investor-update';
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
import { AdminContentCard } from './admin-content-card';
import { EntityPortraitCard } from './entity-portrait-card';

/** The content-type chip a portrait investor update shows (a static label). */
const INVESTOR_UPDATE_TYPE_LABEL = 'Investor Update';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

interface LoadedInvestorUpdateCardProps {
  update: InvestorUpdate;
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used when `update.featured_image` is missing. */
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
export type InvestorUpdateCardProps =
  | (LoadedInvestorUpdateCardProps & { loading?: boolean })
  | (Partial<LoadedInvestorUpdateCardProps> & { loading: true });

/**
 * An investor update card while it is read, one per density: `default` is the admin card's own skeleton (the card is
 * an `AdminContentCard`), `portrait` the shared portrait skeleton with the static chip, `sm` the compact card's rows.
 */
function InvestorUpdateCardSkeleton({
  size = 'default',
  showTypeBadge = true,
  className,
}: {
  size?: 'default' | 'sm' | 'portrait';
  /** `portrait`: the card shows the "Investor Update" chip. */
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
        typeLabel={showTypeBadge ? INVESTOR_UPDATE_TYPE_LABEL : undefined}
        className={className}
      />
    );
  }
  if (size === 'default') {
    return (
      <div className={`block h-full ${className ?? ''}`}>
        <AdminContentCard loading title="" subtitleRow={false} />
      </div>
    );
  }
  if (size === 'sm') {
    return (
      <CompactCardSkeleton
        titleWidth="w-1/2"
        titleBadges={['w-8']}
        rows={[{ width: 'w-1/3' }, { width: 'w-11/12' }]}
        className={className}
      />
    );
  }
  return null;
}

/** ONE switch: in a loading scope (or `loading`) the card is its own loading form. */
export function InvestorUpdateCard(props: InvestorUpdateCardProps) {
  if (useLoadingScope() || props.loading) {
    return (
      <InvestorUpdateCardSkeleton size={props.size} showTypeBadge={props.showTypeBadge} className={props.className} />
    );
  }
  return <LoadedInvestorUpdateCard {...props} />;
}

function LoadedInvestorUpdateCard({
  update,
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  size = 'default',
  showTypeBadge = true,
  className,
}: LoadedInvestorUpdateCardProps) {
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
      <Link href={href} target={target} rel={rel} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
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
      </Link>
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
        typeLabel={showTypeBadge ? INVESTOR_UPDATE_TYPE_LABEL : undefined}
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
    <Link href={href} target={target} rel={rel} className={`block h-full ${className ?? ''}`}>
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
    </Link>
  );
}
