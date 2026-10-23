'use client';

/**
 * HubSpot Ticket Card — unified visual for hubspot-tickets markers.
 *
 * PURE PRESENTATION (no internal nav). The card receives the structured
 * `<Link>` prop bundle via `anchorProps` (composed by the caller from a
 * runtime hook) and renders the rest from the `HubspotTicketItem` shape
 * directly.
 */

import { ExternalLink } from 'lucide-react';
import React from 'react';
import Link from '../../../embed-shims/next-link';
import { formatDateUTC as formatDate } from '../../../utils/format';
import { UnifiedSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { StatusBadge } from '../../ui/status-badge';
import type { HubspotTicketItem } from '../types/entities/hubspot-ticket';
import {
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  safeHref,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';

export interface HubspotTicketCardAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface HubspotTicketCardProps {
  item: HubspotTicketItem;
  variant?: 'row' | 'compact';
  className?: string;
  anchorProps?: HubspotTicketCardAnchorProps;
}

function formatToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const lower = token.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

type BadgeScheme = 'success' | 'error' | 'warning' | 'cyan' | 'default';

function priorityScheme(priority: string | null | undefined): BadgeScheme {
  const p = (priority || '').toUpperCase();
  if (p === 'URGENT') return 'error';
  if (p === 'HIGH') return 'warning';
  if (p === 'MEDIUM') return 'cyan';
  return 'default';
}

function statusScheme(status: string | null | undefined): BadgeScheme {
  const s = (status || '').toUpperCase();
  if (s === 'CLOSED') return 'success';
  if (s === 'OPEN') return 'warning';
  return 'default';
}

export function HubspotTicketCard({ item, variant = 'compact', className, anchorProps }: HubspotTicketCardProps) {
  if (useLoadingScope()) return <HubspotTicketCardSkeleton variant={variant} className={className} />;
  const statusText = item.statusLabel ?? formatToken(item.status);
  const priorityText = formatToken(item.priority);
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' });

  if (variant === 'row') {
    return (
      <div className={`flex min-w-0 items-center gap-3 ${className ?? ''}`}>
        <span className="max-w-[260px] shrink-0 truncate text-ods-text-primary text-h6">{item.title}</span>
        {item.preview ? (
          <span className="min-w-0 flex-1 truncate text-ods-text-secondary text-h6">{item.preview}</span>
        ) : null}
        {statusText ? <StatusBadge text={statusText} variant="button" colorScheme={statusScheme(item.status)} /> : null}
        {dateText ? <span className="w-24 shrink-0 text-right text-ods-text-secondary text-h6">{dateText}</span> : null}
      </div>
    );
  }

  const metaParts: React.ReactNode[] = [];
  if (item.customerCompany) {
    metaParts.push(
      <span key="company" className="min-w-0 truncate">
        {item.customerCompany}
      </span>,
    );
  }
  if (dateText)
    metaParts.push(
      <span key="date" className="whitespace-nowrap">
        {dateText}
      </span>,
    );

  const href = safeHref(item.url);
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`${COMPACT_CARD_TITLE} min-w-0 shrink`}>{item.title}</span>
          {priorityText ? (
            <StatusBadge
              text={priorityText}
              variant="button"
              colorScheme={priorityScheme(item.priority)}
              className="shrink-0"
            />
          ) : null}
          {statusText ? (
            <StatusBadge
              text={statusText}
              variant="button"
              colorScheme={statusScheme(item.status)}
              className="shrink-0"
            />
          ) : null}
        </span>
        {item.customerEmail ? (
          <span className="flex min-w-0 items-center gap-1 text-ods-text-secondary text-h6">
            <span className="shrink-0 text-ods-text-secondary/70">From:</span>
            <span className="min-w-0 truncate">{item.customerEmail}</span>
          </span>
        ) : null}
        <span className="flex min-w-0">
          <span className="line-clamp-4 whitespace-pre-wrap break-words text-ods-text-secondary text-h6">
            {item.preview || <span className="italic text-ods-text-secondary/60">No description provided.</span>}
          </span>
        </span>
        {metaParts.length > 0 ? (
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_META_ROW}>
              {metaParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="shrink-0 text-ods-text-secondary/40">·</span> : null}
                  <span className="min-w-0 truncate">{part}</span>
                </React.Fragment>
              ))}
            </span>
          </span>
        ) : null}
      </span>
      {href ? (
        <span className="flex h-5 shrink-0 items-center self-start text-ods-text-secondary">
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </>
  );
  if (anchorProps) {
    return (
      <Link {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </Link>
    );
  }
  return href ? (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </Link>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
      {body}
    </span>
  );
}

function HubspotTicketCardSkeleton({
  variant = 'compact',
  className,
}: {
  variant?: 'row' | 'compact';
  className?: string;
}) {
  if (variant === 'row') {
    return (
      <div className={`flex min-w-0 items-center gap-3 ${className ?? ''}`}>
        <UnifiedSkeleton className="h-3 w-40 shrink-0 rounded" />
        <UnifiedSkeleton className="h-3 w-2/3 flex-1 rounded" />
        <UnifiedSkeleton className="h-3 w-16 shrink-0 rounded" />
        <UnifiedSkeleton className="h-3 w-20 shrink-0 rounded" />
      </div>
    );
  }
  return (
    <CompactCardSkeleton
      slot={false}
      titleWidth="w-2/3"
      titleBadges={['w-12', 'w-16']}
      rows={[{ width: 'w-1/2' }, { width: 'w-5/6', lines: 4 }, { width: 'w-1/3' }]}
      trailingIcon
      className={className}
    />
  );
}
