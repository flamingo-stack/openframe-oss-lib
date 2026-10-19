'use client';

import { cn } from '../../utils/cn';
import { AlertTriangleIcon } from '../icons-v2-generated';
import { AnnouncementBarView } from './announcement-bar-view';
import { Tag } from './tag';

export interface SuperUserBannerViewProps {
  /** The tenant whose data is on screen - never the super tenant the session belongs to. */
  tenantName: string;
  /**
   * Trailing environment chip ("Production environment"). Omit it where the
   * host has no environment to name; the strip then ends at the text.
   */
  environmentLabel?: string;
  className?: string;
}

/**
 * The strip a super user sees over every page while looking at a tenant that
 * is not their own: who you are acting as, and whose data it is. Props-only;
 * the host decides when it shows (a super user session) and what it names
 * (the tenant of the current host, not the one on `/me`).
 *
 * A skin over `AnnouncementBarView` rather than a strip of its own: the slots,
 * the one-line truncation and the touch-width behaviour are that bar's. What
 * this adds is the design's error surface - error-secondary fill, an error
 * rule along the bottom, the triangle in error, the role in error and the
 * tenant in primary text at body scale - and the environment chip at the end.
 */
export function SuperUserBannerView({ tenantName, environmentLabel, className }: SuperUserBannerViewProps) {
  return (
    <AnnouncementBarView
      className={cn('shrink-0 border-b border-ods-error bg-ods-error-secondary text-ods-text-primary', className)}
      contentClassName="gap-[var(--spacing-system-s)] py-[var(--spacing-system-m)] pl-[var(--spacing-system-m)]"
      startAdornment={<AlertTriangleIcon className="size-6 shrink-0 text-ods-error" aria-hidden="true" />}
      title={
        <p className="mb-0 min-w-0 max-w-full truncate text-h4">
          <span className="text-ods-error">Super user access: </span>
          <span>{tenantName}</span>
        </p>
      }
      endAdornment={
        // Below `md` the chip would take the width the tenant name needs, and
        // the name is the point of the strip: the chip waits for `md`.
        environmentLabel ? (
          <Tag variant="critical" label={environmentLabel} className="uppercase max-md:hidden" />
        ) : undefined
      }
    />
  );
}
