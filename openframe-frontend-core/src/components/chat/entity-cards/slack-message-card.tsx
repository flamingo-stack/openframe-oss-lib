'use client';

/**
 * Slack Message Card — unified visual for slack-messages markers.
 *
 * PURE PRESENTATION (no internal nav). The card receives the structured
 * `<a>` prop bundle via `anchorProps` (composed by the caller from a
 * runtime hook) and renders the rest from the `SlackMessageItem` shape
 * directly.
 */

import { ExternalLink, Hash } from 'lucide-react';
import React from 'react';
import { formatDateUTC as formatDate } from '../../../utils/format';
import { SlackIcon } from '../../icons/slack-icon';
import type { SlackMessageItem } from '../types/entities/slack-message';
import {
  COMPACT_CARD_ICON_SLOT,
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
  safeHref,
} from '../utils/compact-card-classes';

export interface SlackMessageCardAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface SlackMessageCardProps {
  item: SlackMessageItem;
  variant?: 'row' | 'compact';
  className?: string;
  anchorProps?: SlackMessageCardAnchorProps;
}

function parseChannelFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.host.endsWith('.slack.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const archivesIdx = parts.indexOf('archives');
    if (archivesIdx !== -1 && parts.length > archivesIdx + 1) return parts[archivesIdx + 1];
  } catch {
    /* malformed URL */
  }
  return null;
}

export function SlackMessageCard({ item, variant = 'compact', className, anchorProps }: SlackMessageCardProps) {
  const channel = item.channel ?? parseChannelFromUrl(item.url) ?? null;
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' });

  if (variant === 'row') {
    return (
      <div className={`flex min-w-0 items-center gap-3 ${className ?? ''}`}>
        <SlackIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[180px] shrink-0 truncate text-ods-text-primary text-h6">{item.title}</span>
        {item.preview ? (
          <span className="min-w-0 flex-1 truncate text-ods-text-secondary text-h6">{item.preview}</span>
        ) : null}
        {channel ? (
          <span className="max-w-[140px] shrink-0 truncate text-ods-text-secondary text-code">
            <Hash className="inline h-3 w-3" />
            {channel}
          </span>
        ) : null}
        {dateText ? <span className="w-24 shrink-0 text-right text-ods-text-secondary text-h6">{dateText}</span> : null}
      </div>
    );
  }

  const metaParts: React.ReactNode[] = [];
  if (channel) {
    metaParts.push(
      <span key="channel" className="flex min-w-0 items-center gap-0.5">
        <Hash className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">{channel}</span>
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
      <span className={COMPACT_CARD_ICON_SLOT}>
        <SlackIcon className="h-5 w-5" />
      </span>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={COMPACT_CARD_TITLE_ROW}>
          <span className={COMPACT_CARD_TITLE}>{item.title}</span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_SUMMARY}>{item.preview || COMPACT_CARD_ROW_FILLER}</span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_META_ROW}>
            {metaParts.length > 0 ? (
              metaParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="shrink-0 text-ods-text-secondary/40">·</span> : null}
                  <span className="min-w-0 truncate">{part}</span>
                </React.Fragment>
              ))
            ) : (
              <span className={COMPACT_CARD_SUMMARY}>{COMPACT_CARD_ROW_FILLER}</span>
            )}
          </span>
        </span>
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
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </a>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
      {body}
    </span>
  );
}

export function SlackMessageCardSkeleton({
  variant = 'compact',
  className,
}: {
  variant?: 'row' | 'compact';
  className?: string;
}) {
  if (variant === 'row') {
    return (
      <div className={`flex min-w-0 animate-pulse items-center gap-3 ${className ?? ''}`}>
        <div className="h-3.5 w-3.5 shrink-0 rounded bg-ods-bg" />
        <div className="h-3 w-32 shrink-0 rounded bg-ods-bg" />
        <div className="h-3 w-2/3 flex-1 rounded bg-ods-bg/60" />
        <div className="h-3 w-24 shrink-0 rounded bg-ods-bg/60" />
        <div className="h-3 w-20 shrink-0 rounded bg-ods-bg/60" />
      </div>
    );
  }
  return (
    <span className={`${COMPACT_CARD_SKELETON_OUTER} ${className ?? ''}`}>
      <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={COMPACT_CARD_TITLE_ROW}>
          <span className="h-3.5 w-2/3 rounded bg-ods-bg" />
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className="h-3 w-5/6 rounded bg-ods-bg/60" />
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className="h-3 w-1/3 rounded bg-ods-bg/70" />
        </span>
      </span>
      <span className="flex h-5 shrink-0 items-center self-start">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  );
}
