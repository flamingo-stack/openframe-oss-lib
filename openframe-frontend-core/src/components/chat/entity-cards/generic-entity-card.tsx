'use client';

/**
 * Generic compact entity/document card for any chat type that doesn't
 * warrant a bespoke component.
 *
 * PURE PRESENTATION. Receives pre-composed `<a>` props via `anchorProps`
 * and renders the rest from the item shape.
 */

import { ExternalLink } from 'lucide-react';
import type React from 'react';
import { formatDateUTC as formatDate } from '../../../utils/format';
import { StatusBadge } from '../../ui/status-badge';
import {
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  safeHref,
} from '../utils/compact-card-classes';

type BadgeScheme = 'success' | 'error' | 'warning' | 'cyan' | 'default';

export interface GenericEntityCardItem {
  id: string;
  title: string;
  preview?: string | null;
  url?: string | null;
  subtitle?: string | null;
  badge?: { text: string; scheme?: BadgeScheme } | null;
  facts?: Array<{ label: string; value: string }> | null;
  dateUpdated?: string | number | null;
}

export interface GenericEntityCardAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface GenericEntityCardProps {
  item: GenericEntityCardItem;
  className?: string;
  anchorProps?: GenericEntityCardAnchorProps;
}

export function GenericEntityCard({ item, className, anchorProps }: GenericEntityCardProps) {
  const href = safeHref(item.url);
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' });
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`${COMPACT_CARD_TITLE} min-w-0 shrink`}>{item.title}</span>
          {item.badge ? (
            <StatusBadge
              text={item.badge.text}
              variant="button"
              colorScheme={item.badge.scheme || 'default'}
              className="shrink-0"
            />
          ) : null}
        </span>
        {item.subtitle ? (
          <span className="flex min-w-0 items-center gap-1 text-ods-text-secondary text-h6">
            <span className="min-w-0 truncate font-mono">{item.subtitle}</span>
          </span>
        ) : null}
        {item.preview ? (
          <span className="flex min-w-0">
            <span className="line-clamp-2 whitespace-pre-wrap break-words text-ods-text-secondary text-h6">
              {item.preview}
            </span>
          </span>
        ) : null}
        {item.facts && item.facts.length > 0 ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-h6">
            {item.facts.map((f, i) => (
              <span key={i} className="inline-flex min-w-0 items-center gap-1 truncate">
                <span className="shrink-0 text-ods-text-secondary/70">{f.label}:</span>
                <span className="truncate font-medium text-ods-text-primary">{f.value}</span>
              </span>
            ))}
          </span>
        ) : null}
        {dateText ? (
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_META_ROW}>
              <span className="whitespace-nowrap">{dateText}</span>
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
      <a {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </a>
    );
  }
  return href ? (
    <a href={href} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </a>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
      {body}
    </span>
  );
}

export function GenericEntityCardSkeleton({ className }: { className?: string }) {
  return (
    <span className={`${COMPACT_CARD_SKELETON_OUTER} ${className ?? ''}`}>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-3.5 w-2/3 rounded bg-ods-bg" />
          <span className="h-4 w-16 rounded-full bg-ods-bg/60" />
        </span>
        <span className="h-4 w-1/2 rounded bg-ods-bg/60" />
        <span className="flex min-w-0 flex-col gap-0">
          <span className="h-5 w-5/6 rounded bg-ods-bg/60" />
          <span className="h-5 w-3/4 rounded bg-ods-bg/60" />
        </span>
        <span className="h-3 w-1/4 rounded bg-ods-bg/70" />
      </span>
      <span className="flex h-5 shrink-0 items-center self-start">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  );
}
