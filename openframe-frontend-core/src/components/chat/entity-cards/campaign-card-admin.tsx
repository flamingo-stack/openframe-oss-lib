'use client';

/**
 * Campaign Card Admin (chat compact variant).
 *
 * PURE PRESENTATION. Receives a pre-composed `<Link>` prop bundle and
 * renders a 3-row compact card. The hub still owns the full-size admin
 * card (with delete + manage buttons) — only the compact chat variant
 * lives here in lib.
 */

import { Megaphone } from 'lucide-react';
import type React from 'react';
import Link from '../../../embed-shims/next-link';
import { formatDateShort } from '../../../utils/date-formatters';
import { useLoadingScope } from '../../ui/loading-scope';
import {
  COMPACT_CARD_ICON_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SUBTITLE,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';

/** Minimal campaign shape needed by the chat-inline compact card. */
export interface CampaignCardItem {
  id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  goals?: Array<unknown> | null;
}

export interface CampaignCardAdminAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface CampaignCardAdminProps {
  campaign: CampaignCardItem;
  className?: string;
  anchorProps?: CampaignCardAdminAnchorProps;
}

export function CampaignCardAdmin({ campaign, className, anchorProps }: CampaignCardAdminProps) {
  if (useLoadingScope()) return <CampaignCardAdminSkeleton className={className} />;
  const goalsCount = campaign.goals?.length || 0;

  const innerChildren = (
    <>
      <span className={COMPACT_CARD_ICON_SLOT}>
        <Megaphone className="h-5 w-5" />
      </span>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={COMPACT_CARD_TITLE_ROW}>
          <span className={COMPACT_CARD_TITLE}>{campaign.name}</span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_SUBTITLE}>
            {[
              campaign.start_date ? formatDateShort(campaign.start_date) : null,
              goalsCount > 0 ? `${goalsCount} goal${goalsCount !== 1 ? 's' : ''}` : null,
              'Marketing campaign',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_SUMMARY}>{campaign.description || COMPACT_CARD_ROW_FILLER}</span>
        </span>
      </span>
    </>
  );
  if (anchorProps) {
    return (
      <Link {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {innerChildren}
      </Link>
    );
  }
  return (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
      {innerChildren}
    </span>
  );
}

function CampaignCardAdminSkeleton({ className }: { className?: string }) {
  return <CompactCardSkeleton rows={[{ width: 'w-1/2' }, { width: 'w-11/12' }]} className={className} />;
}
