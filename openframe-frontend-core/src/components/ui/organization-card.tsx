'use client';

import { Monitor } from 'lucide-react';
import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { EntityImage } from './entity-image';
import { loadingItemProps, useLoadingScope } from './loading-scope';

/** The card's corner radius, read by `OrganizationCard` and by its skeleton here. */
export const ORGANIZATION_CARD_RADIUS_CLASS = 'rounded-[6px]';
/** The card's layout, read by `OrganizationCard` and by its skeleton here, so the skeleton is the card's size. */
export const ORGANIZATION_CARD_LAYOUT_CLASS = 'relative flex w-full flex-col gap-3 overflow-clip p-4';
export const ORGANIZATION_CARD_SURFACE_CLASS = 'border border-ods-border bg-ods-card';
export const ORGANIZATION_CARD_HEADER_CLASS = 'flex w-full items-start gap-3';
export const ORGANIZATION_CARD_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col justify-center py-2';
export const ORGANIZATION_CARD_DESCRIPTION_CLASS = 'h-12 w-full overflow-hidden';
export const ORGANIZATION_CARD_FOOTER_CLASS = 'flex w-full min-w-0 items-center justify-between gap-2';
export const ORGANIZATION_CARD_STATS_CLASS = 'flex min-w-0 flex-shrink items-center gap-3 content-md:gap-4';
export const ORGANIZATION_CARD_STAT_CLASS = 'flex flex-shrink-0 items-center gap-1';

interface OrganizationCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show footer stats area
   */
  showFooter?: boolean;

  /**
   * Show description area
   */
  showDescription?: boolean;

  /** Optional tailwind classes to override the card container background & border */
  containerClassName?: string;
  /** `data-*` markers (`data-loading-item` on a grid's cards), on the card's root. */
  [key: `data-${string}`]: unknown;
}

/** The two footer stats a loading card draws (a value and its label each). */
const ORGANIZATION_CARD_SKELETON_STAT_WIDTHS = ['w-16', 'w-20'] as const;

/**
 * OrganizationCard while its organization is read: the card's own layout constants (frame, header, description
 * box, footer), so it is the card's size by construction. Drawn only in a loading scope: the logo is `EntityImage` (its own loading form), the name and its
 * second line `text-h3` and `text-h6` bars, the description two `text-h4` lines, the footer two stats.
 */
function OrganizationCardSkeleton({
  className,
  containerClassName,
  showFooter = true,
  showDescription = true,
  ...props
}: OrganizationCardSkeletonProps) {
  return (
    <div
      className={cn(
        ORGANIZATION_CARD_LAYOUT_CLASS,
        containerClassName || ORGANIZATION_CARD_SURFACE_CLASS,
        ORGANIZATION_CARD_RADIUS_CLASS,
        className,
      )}
      aria-hidden
      {...loadingItemProps(props)}
    >
      <div className={ORGANIZATION_CARD_HEADER_CLASS}>
        <EntityImage src={null} />
        <div className={ORGANIZATION_CARD_TEXT_CLASS}>
          <TextLineSkeleton type="h3" className="w-3/4" />
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
      </div>
      {showDescription && (
        <div className={ORGANIZATION_CARD_DESCRIPTION_CLASS}>
          <TextLineSkeleton type="h4" lines={2} className="w-full" />
        </div>
      )}
      {showFooter && (
        <div className={ORGANIZATION_CARD_FOOTER_CLASS}>
          <div className={ORGANIZATION_CARD_STATS_CLASS}>
            {ORGANIZATION_CARD_SKELETON_STAT_WIDTHS.map(width => (
              <div key={width} className={ORGANIZATION_CARD_STAT_CLASS}>
                <MediaSkeleton.Icon size="sm" />
                <TextLineSkeleton type="h6" className={width} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** What the description box shows for an organization with no description. */
const ORGANIZATION_CARD_EMPTY_MARK = '—';

export interface Organization {
  id: string;
  organizationId?: string;
  name: string;
  imageUrl?: string | null;
  industry?: string;
  tier?: string;
  websiteUrl?: string;
  description?: string;
  totalDevices?: number;
  activeDevices?: number;
  mrrUsd?: number;
  /** Extra host columns ride along untouched — the card reads only the
   *  fields declared above. */
  [key: string]: unknown;
}

export interface OrganizationCardProps {
  organization: Organization;
  fetchedImageUrl?: string;
  className?: string;
  href?: string;
  showActionButton?: boolean;
  actionButton?: {
    icon: React.ReactNode;
    label: string;
    onClick: (org: Organization, e: React.MouseEvent) => void;
    variant?: 'ghost' | 'primary';
    disabled?: boolean;
  };
  footerStats?: Array<{
    icon?: React.ReactNode;
    value: string | number;
    label?: string;
  }>;
  customFooter?: React.ReactNode;
  deviceCount?: number;
  /** `data-*` markers (`data-loading-item` on a grid's cards), on the card's outermost element in both forms. */
  [key: `data-${string}`]: unknown;
}

export function OrganizationCard({
  organization,
  fetchedImageUrl,
  className,
  href,
  showActionButton = false,
  actionButton,
  footerStats,
  customFooter,
  deviceCount,
  ...props
}: OrganizationCardProps) {
  const markers = loadingItemProps(props);
  // In a page's loading state the organization is read: the card is its skeleton.
  if (useLoadingScope()) {
    return (
      <OrganizationCardSkeleton className={className} showFooter={Boolean(customFooter || footerStats)} {...markers} />
    );
  }
  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actionButton?.onClick(organization, e);
  };

  const card = (
    <div
      className={cn(
        ORGANIZATION_CARD_LAYOUT_CLASS,
        ORGANIZATION_CARD_SURFACE_CLASS,
        ORGANIZATION_CARD_RADIUS_CLASS,
        'transition-colors',
        href && 'cursor-pointer hover:border-ods-border-hover hover:bg-ods-card-hover',
        className,
      )}
      {...(href ? {} : markers)}
    >
      {/* Device count (top-right) */}
      {deviceCount !== undefined && (
        <div className="absolute right-4 top-4 flex shrink-0 items-center gap-2">
          <Monitor className="h-4 w-4 text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">{deviceCount.toLocaleString()} devices</span>
        </div>
      )}

      {/* Action button (top-right) - only if no device count */}
      {!deviceCount && showActionButton && actionButton && (
        <Button
          variant={actionButton.variant === 'primary' ? 'accent' : 'bare'}
          // The secondary action is a removal: the error colour on hover.
          data-tone={actionButton.variant === 'primary' ? undefined : 'danger'}
          size="icon-sm"
          type="button"
          className="absolute right-2 top-2 z-10"
          onClick={handleActionClick}
          disabled={actionButton.disabled}
          aria-label={actionButton.label}
        >
          {actionButton.icon}
        </Button>
      )}

      {/* Header */}
      <div className={ORGANIZATION_CARD_HEADER_CLASS}>
        <EntityImage src={fetchedImageUrl || organization.imageUrl} alt={organization.name} />

        <div className={ORGANIZATION_CARD_TEXT_CLASS}>
          <h3 className="truncate text-ods-text-primary transition-colors text-h3" title={organization.name}>
            {organization.name}
          </h3>
          <p
            className="truncate text-ods-text-secondary text-h6"
            title={organization.industry || organization.tier || organization.websiteUrl || 'Organization'}
          >
            {organization.industry || organization.tier || organization.websiteUrl || 'Organization'}
          </p>
        </div>
      </div>

      {/* Description: most organizations have one, so its box is always drawn (the loading card draws it too); an
          organization with none shows the empty mark. */}
      <div className={ORGANIZATION_CARD_DESCRIPTION_CLASS}>
        {organization.description ? (
          <p className="line-clamp-2 text-ods-text-primary text-h4" title={organization.description}>
            {organization.description}
          </p>
        ) : (
          <p className="text-ods-text-secondary text-h4">{ORGANIZATION_CARD_EMPTY_MARK}</p>
        )}
      </div>

      {/* Footer */}
      {customFooter ? (
        customFooter
      ) : footerStats && footerStats.length > 0 ? (
        <div className={ORGANIZATION_CARD_FOOTER_CLASS}>
          <div className={ORGANIZATION_CARD_STATS_CLASS}>
            {footerStats.map((stat, index) => (
              <div key={index} className={ORGANIZATION_CARD_STAT_CLASS}>
                {stat.icon}
                <span className="text-ods-text-primary text-h6">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
                {stat.label && <span className="text-ods-text-secondary text-h6">{stat.label}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block text-inherit no-underline" {...markers}>
        {card}
      </Link>
    );
  }

  return card;
}
