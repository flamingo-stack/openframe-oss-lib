'use client';

/**
 * Data-room / OpenFrame-docs inline chat card.
 *
 * PURE PRESENTATION. The card receives a pre-composed `<Link>` prop bundle
 * (`anchorProps`) plus a pre-resolved badge label — both decisions
 * (URL composition + cross-app routing) are made in the consumer's
 * runtime layer, not inside this card.
 *
 * Renders `[card://data_room_doc:<id>]` and `[card://markdown:<id>]` markers
 * — both use this card because their viewer surface is structurally
 * identical; only the `baseRoute` differs (`/data-room` vs `/knowledge-base`).
 */

import { ExternalLink } from 'lucide-react';
import type React from 'react';
import Link from '../../../embed-shims/next-link';
import { useLoadingScope } from '../../ui/loading-scope';
import { StatusBadge } from '../../ui/status-badge';
import type { DataRoomDocCardItem } from '../types/entities/data-room-doc';
import {
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';

export interface DataRoomDocCardAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export interface DataRoomDocCardProps {
  item: DataRoomDocCardItem;
  className?: string;
  /** Pre-composed badge label. REQUIRED — the consumer resolves
   *  `sourceRepo` against its `SOURCE_LABELS_BY_TABLE` registry and
   *  passes the result here.
   *
   *  Why required (no default): if the badge silently defaulted to a
   *  literal like "Data room", a card sourced from openframe-docs (or
   *  any other repo) whose `sourceRepo` resolution failed would
   *  display the wrong provenance label — a real security signal,
   *  because "Data Room" implies private/internal documents to
   *  end-users. Forcing the consumer to supply the label means a
   *  bug at the resolution step surfaces as a TypeScript error
   *  ("badgeText required") instead of a falsely-labeled production
   *  card. The hub-side dispatcher already passes
   *  `getSourceLabel(sourceRepo)` with a non-null fallback. */
  badgeText: string;
  /** Pre-composed `<Link>` prop bundle. When provided, the outer renders
   *  as `<Link {...anchorProps}>`; otherwise the card is non-interactive. */
  anchorProps?: DataRoomDocCardAnchorProps;
}

export function DataRoomDocCard({ item, className, badgeText, anchorProps }: DataRoomDocCardProps) {
  if (useLoadingScope()) return <DataRoomDocCardSkeleton className={className} />;
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`${COMPACT_CARD_TITLE} min-w-0 shrink`}>{item.title}</span>
          <StatusBadge text={badgeText} variant="button" colorScheme="cyan" className="shrink-0" />
        </span>
        {item.path ? (
          <span className="flex min-w-0 items-center gap-1 text-ods-text-secondary text-h6">
            <span className="shrink-0 text-ods-text-secondary/70">Path:</span>
            <span className="min-w-0 truncate font-mono">{item.path}</span>
          </span>
        ) : null}
        {item.preview ? (
          <span className="flex min-w-0">
            <span className="line-clamp-2 whitespace-pre-wrap break-words text-ods-text-secondary text-h6">
              {item.preview}
            </span>
          </span>
        ) : null}
      </span>
      {anchorProps?.href ? (
        <span className="flex h-5 shrink-0 items-center self-start text-ods-text-secondary">
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </>
  );
  if (!anchorProps) {
    return (
      <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
        {body}
      </span>
    );
  }
  return (
    <Link {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </Link>
  );
}

function DataRoomDocCardSkeleton({ className }: { className?: string }) {
  return (
    <CompactCardSkeleton
      slot={false}
      titleWidth="w-2/3"
      titleBadges={['w-16']}
      rows={[{ width: 'w-1/2' }, { width: 'w-5/6', lines: 2 }]}
      trailingIcon
      className={className}
    />
  );
}
