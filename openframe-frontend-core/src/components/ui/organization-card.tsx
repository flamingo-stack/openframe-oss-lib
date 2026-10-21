'use client';

import { Monitor } from 'lucide-react';
import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import {
  OrganizationCardSkeleton,
  ORGANIZATION_CARD_RADIUS_CLASS,
  ORGANIZATION_CARD_LAYOUT_CLASS,
  ORGANIZATION_CARD_SURFACE_CLASS,
  ORGANIZATION_CARD_HEADER_CLASS,
  ORGANIZATION_CARD_TEXT_CLASS,
  ORGANIZATION_CARD_DESCRIPTION_CLASS,
  ORGANIZATION_CARD_FOOTER_CLASS,
  ORGANIZATION_CARD_STATS_CLASS,
  ORGANIZATION_CARD_STAT_CLASS,
} from '../loading/organization-card-skeleton';
import { EntityImage } from './entity-image';
import { loadingItemProps, useLoadingScope } from './loading-scope';

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
      <OrganizationCardSkeleton
        className={className}
        showDescription={Boolean(organization.description)}
        showFooter={Boolean(customFooter || footerStats)}
        {...markers}
      />
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
        <button
          className={cn(
            'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded transition-colors',
            actionButton.variant === 'primary'
              ? 'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover'
              : 'text-ods-text-secondary hover:bg-ods-error-secondary hover:text-ods-error',
          )}
          onClick={handleActionClick}
          disabled={actionButton.disabled}
          aria-label={actionButton.label}
        >
          {actionButton.icon}
        </button>
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

      {/* Description: only some organizations have one (the loading card leaves it out) */}
      {organization.description && (
        <div className={ORGANIZATION_CARD_DESCRIPTION_CLASS} data-loading-optional>
          <p className="line-clamp-2 text-ods-text-primary text-h4" title={organization.description}>
            {organization.description}
          </p>
        </div>
      )}

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
