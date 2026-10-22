'use client';

/**
 * RoadmapCard (pure presentation). Two densities — `default` (rich
 * /roadmap page card with vote buttons + figma/screenshots controls)
 * and `sm` (compact horizontal for chat-inline).
 *
 * The card writes NO click logic — the parent wraps with its own
 * anchor for the compact branch and supplies vote handlers for the
 * default branch.
 */

import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import Link from '../../../embed-shims/next-link';
import { MEDIA_ASPECT, TEXT_LINES_MIN, TILE_SIZE } from '../../../styles/component-sizes';
import { cn } from '../../../utils/cn';
import { ImageClassicIcon } from '../../icons-v2-generated/audio-and-visual/image-classic-icon';
import { FigmaClassicIcon } from '../../icons-v2-generated/brand-logos/figma-classic-icon';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { AvatarStack, type AvatarStackPerson } from '../../ui/avatar-stack';
import { Button } from '../../ui/button/button';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { useLoadingScope } from '../../ui/loading-scope';
import { StatusBadge, generationTierFromLabel } from '../../ui/status-badge';
import { useProxiedImageUrl } from '../hooks/use-proxied-image-url';
import type { RoadmapItem } from '../types/entities/roadmap-item';
import { getStatusColorScheme } from '../utils/agent-status-message';
import { getTaskTypeLabel } from '../utils/clickup-task-type-utils';
import {
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
  safeHref,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';
import { RoadmapVoteButton } from './roadmap-vote-button';
import { TaskTypeIcon } from './task-type-icon';

type CardSize = 'default' | 'sm';
export type VoteType = 'up' | 'down' | null;

/** The compact card's bordered 48px logo box, read by the card and its skeleton. */
const ROADMAP_COMPACT_SLOT = `${MEDIA_ASPECT.square} ${TILE_SIZE.xl} shrink-0 self-start overflow-hidden rounded-md border border-ods-border p-1.5`;

// The default card's boxes, read by the card AND its skeleton, so the two are one size at every width.
const ROADMAP_CARD_BODY =
  'flex h-full scroll-mt-24 flex-col gap-[var(--spacing-system-mf)] p-[var(--spacing-system-lf)]';
const ROADMAP_CARD_HEADER = 'flex w-full items-center gap-[16px]';
const ROADMAP_CARD_ICON_BOX = `flex ${TILE_SIZE.feature} flex-shrink-0 items-center justify-center rounded-lg`;
const ROADMAP_CARD_HEADING = 'flex min-w-0 flex-1 flex-col';
/** Two `text-h3` lines. */
const ROADMAP_CARD_TITLE_ROW = `flex items-center text-h3 ${TEXT_LINES_MIN[2]}`;
const ROADMAP_CARD_META_ROW = `flex items-center text-h5 ${TEXT_LINES_MIN[1]}`;
/** Three `text-h4` lines. */
const ROADMAP_CARD_SUMMARY_ROW = `flex items-center text-h4 ${TEXT_LINES_MIN[3]}`;
const ROADMAP_CARD_FOOTER = 'flex w-full items-center justify-between';
const ROADMAP_CARD_VOTES = 'flex h-[48px] overflow-hidden rounded-[6px]';
const ROADMAP_CARD_FOOTER_END = 'flex min-w-0 items-center gap-2';

/**
 * A roadmap card while it is read. `default`, in the card's own boxes: the 64px icon box, the title as two `text-h3`
 * lines, the quarter and id as a `text-h5` line, the status badge's box (beside the heading from md, its own row
 * below), the description as three `text-h4` lines and the vote buttons' 48px box (with `votes`); the assignees and
 * target version are drawn only when an item has them, so the skeleton leaves them out. `sm`: the compact card's rows.
 */
function RoadmapCardSkeleton({
  size = 'default',
  votes = true,
  className,
}: {
  size?: CardSize;
  /** `default`: the card shows its vote buttons (the caller passes `onVote`). */
  votes?: boolean;
  className?: string;
}) {
  if (size === 'sm') {
    return (
      <CompactCardSkeleton
        slotClassName={ROADMAP_COMPACT_SLOT}
        titleWidth="w-1/2"
        titleBadges={['w-12']}
        rows={[
          // The votes, Figma and screenshot marks after the meta line are the record's (optional): not drawn.
          { width: 'w-2/5 flex-1' },
          { width: 'w-5/6' },
        ]}
        className={className}
      />
    );
  }
  return (
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, ROADMAP_CARD_BODY, className)} aria-hidden>
      <div className={ROADMAP_CARD_HEADER}>
        <UnifiedSkeleton className={ROADMAP_CARD_ICON_BOX} />
        <div className={ROADMAP_CARD_HEADING}>
          <div className={ROADMAP_CARD_TITLE_ROW}>
            <TextLineSkeleton type="h3" lines={2} className="w-3/4" />
          </div>
          <div className={ROADMAP_CARD_META_ROW}>
            <TextLineSkeleton type="h5" className="w-1/3" />
          </div>
        </div>
        <div className="hidden md:block">
          <StatusBadge loading text="" />
        </div>
      </div>
      <div className="md:hidden">
        <StatusBadge loading text="" />
      </div>
      <div className={ROADMAP_CARD_SUMMARY_ROW}>
        <TextLineSkeleton type="h4" lines={3} className="w-full" />
      </div>
      <div className="flex-1" />
      <div className={ROADMAP_CARD_FOOTER}>
        {votes && <UnifiedSkeleton className={cn(ROADMAP_CARD_VOTES, 'w-32')} />}
      </div>
    </div>
  );
}

interface LoadedRoadmapCardProps {
  item: RoadmapItem;
  /** Detail URL for the compact branch (`sm`). Used by the parent
   *  wrapper to drive nav. Default-branch cards don't need href —
   *  voting + screenshot UI is the entire action surface. */
  href?: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** Compact-branch variant — drives the icon-slot fallback rule. */
  cardType?: 'roadmap_item' | 'delivery_item' | 'internal_task';
  size?: CardSize;
  className?: string;
  /** DOM `id` applied to the card's outer element. `RoadmapGrid` sets
   *  `roadmap-<external_id>` so chat-card deep-links
   *  (`?search=<id>#roadmap-<id>`) have a target for `useScrollToHash`
   *  to scroll to. `scroll-mt-24` on the outer element keeps the card
   *  BELOW the sticky chrome. */
  id?: string;
  // Default-branch vote controls (ignored in `sm`):
  userVote?: VoteType | null;
  onVote?: (voteType: 'up' | 'down') => void;
  isVoting?: boolean;
}

/**
 * The record and its link, or `loading` while the host reads it: the card then draws its own loading form, as it
 * does in a loading scope. 
 */
export type RoadmapCardProps =
  | (LoadedRoadmapCardProps & { loading?: boolean })
  | (Partial<LoadedRoadmapCardProps> & { loading: true });

/** Wire assignees → AvatarStack people (name+avatar only on the wire). */
function assigneePeople(
  assignees: Array<{ id: number; name: string | null; avatarUrl: string | null }> | undefined,
): AvatarStackPerson[] {
  return (assignees ?? []).map(a => ({
    key: a.id,
    name: a.name ?? 'Unknown',
    avatarUrl: a.avatarUrl,
  }));
}

/** ONE switch: in a loading scope (or `loading`) the card is its own loading form. */
export function RoadmapCard(props: RoadmapCardProps) {
  if (useLoadingScope() || props.loading) {
    return <RoadmapCardSkeleton size={props.size} votes={!!props.onVote} className={props.className} />;
  }
  return <LoadedRoadmapCard {...props} />;
}

function LoadedRoadmapCard({
  item,
  href,

  target,

  rel,
  size = 'default',
  cardType = 'roadmap_item',
  className,
  id,
  userVote,
  onVote,
  isVoting = false,
}: LoadedRoadmapCardProps) {
  const [showScreenshots, setShowScreenshots] = useState(false);

  const logoUrl = item.icon && item.icon.startsWith('http') ? item.icon : null;
  const iconSrc = useProxiedImageUrl(logoUrl) || null;

  if (size === 'sm') {
    const compactHref = safeHref(href ?? null);
    const hasVotes = (item.upvotes ?? 0) > 0 || (item.downvotes ?? 0) > 0;
    const hasFigma = !!item.figmaUrl;
    const hasScreenshots = (item.screenshots?.length ?? 0) > 0;
    const typeLabel = getTaskTypeLabel(item.customItemId);
    const useTypeIcon = cardType === 'internal_task' || (!iconSrc && item.customItemId != null);
    const body = (
      <>
        <span
          className={cn(ROADMAP_COMPACT_SLOT, 'flex items-center justify-center bg-ods-bg text-ods-accent')}
          title={typeLabel ?? undefined}
        >
          {useTypeIcon ? (
            <TaskTypeIcon customItemId={item.customItemId} className="h-6 w-6" />
          ) : iconSrc ? (
            <Image
              src={iconSrc}
              alt={`${item.title} logo`}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 object-contain"
            />
          ) : (
            <span className="uppercase text-ods-text-secondary text-h6">{item.title?.substring(0, 2) || '??'}</span>
          )}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={`${COMPACT_CARD_TITLE_ROW} gap-2`}>
            <span className={`${COMPACT_CARD_TITLE} min-w-0`}>{item.title}</span>
            {item.status && item.status.trim().length > 0 ? (
              <StatusBadge
                text={item.status.toUpperCase()}
                colorScheme={getStatusColorScheme(item.status)}
                variant="button"
                singleLine
                className="max-w-[60%] shrink-0 truncate whitespace-nowrap border border-ods-border"
              />
            ) : null}
          </span>
          <span className={`${COMPACT_CARD_META_ROW_BOX} gap-2 text-ods-text-secondary`}>
            <span className="min-w-0 flex-1 truncate text-h6">
              {(() => {
                const parts = [item.quarter, item.targetVersion ? `${item.targetVersion} version` : null].filter(
                  Boolean,
                );
                if (parts.length > 0) return parts.join(' · ');
                if (cardType === 'delivery_item') {
                  return typeLabel ? `Delivery · ${typeLabel}` : 'Delivery';
                }
                if (cardType === 'internal_task') {
                  return typeLabel ?? 'Internal task';
                }
                return 'Roadmap item';
              })()}
            </span>
            {hasVotes ? (
              <span className="hidden shrink-0 items-center gap-2 text-ods-text-secondary text-h6 sm:flex">
                <span className="flex items-center gap-0.5">
                  <ThumbsUp className="h-3 w-3" />
                  <span>{item.upvotes ?? 0}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <ThumbsDown className="h-3 w-3" />
                  <span>{item.downvotes ?? 0}</span>
                </span>
              </span>
            ) : null}
            {hasFigma ? (
              <span className="hidden shrink-0 items-center sm:flex" title="Has Figma prototype">
                <FigmaClassicIcon className="h-3 w-3" />
              </span>
            ) : null}
            {hasScreenshots ? (
              <span
                className="hidden shrink-0 items-center gap-0.5 text-h6 sm:flex"
                title={`${item.screenshots.length} screenshot${item.screenshots.length === 1 ? '' : 's'}`}
              >
                <ImageClassicIcon className="h-3 w-3" />
                <span>{item.screenshots.length}</span>
              </span>
            ) : null}
            {item.assignees && item.assignees.length > 0 ? (
              <AvatarStack size="xs" people={assigneePeople(item.assignees)} className="shrink-0" />
            ) : null}
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>{item.description || COMPACT_CARD_ROW_FILLER}</span>
          </span>
        </span>
      </>
    );
    if (!compactHref) {
      return (
        <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
          {body}
        </span>
      );
    }
    return (
      <Link href={compactHref} target={target} rel={rel} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </Link>
    );
  }

  return (
    <div id={id} className={cn(CONTENT_CARD_FRAME_CLASS, ROADMAP_CARD_BODY, className)}>
      <div className={ROADMAP_CARD_HEADER}>
        <div className={cn(ROADMAP_CARD_ICON_BOX, 'border border-ods-border bg-ods-bg')}>
          {iconSrc ? (
            <Image
              src={iconSrc}
              alt={`${item.title} logo`}
              width={40}
              height={40}
              unoptimized
              className="object-contain p-1"
            />
          ) : (
            <span className="text-xs font-medium uppercase text-ods-text-secondary">
              {item.title?.substring(0, 2) || '??'}
            </span>
          )}
        </div>

        <div className={ROADMAP_CARD_HEADING}>
          <div className={ROADMAP_CARD_TITLE_ROW}>
            <h3 className="line-clamp-2 flex-1 text-ods-text-primary text-h3">{item.title}</h3>
          </div>
          <div className={ROADMAP_CARD_META_ROW}>
            <p className="truncate text-ods-text-secondary text-h5">
              {item.quarter}, {item.id}
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <StatusBadge
            text={item.status.toUpperCase()}
            colorScheme={getStatusColorScheme(item.status)}
            className="border border-ods-border"
          />
        </div>
      </div>

      <div className="md:hidden">
        <StatusBadge
          text={item.status.toUpperCase()}
          colorScheme={getStatusColorScheme(item.status)}
          className="border border-ods-border"
        />
      </div>

      <div className={ROADMAP_CARD_SUMMARY_ROW}>
        <p className="line-clamp-3 text-ods-text-secondary text-h4">{item.description || ''}</p>
      </div>

      <div className="flex-1" />

      <div className={ROADMAP_CARD_FOOTER}>
        {onVote && (
          <div className={cn(ROADMAP_CARD_VOTES, 'border border-ods-border bg-ods-card')}>
            <RoadmapVoteButton
              voteType="up"
              count={item.upvotes}
              color="var(--color-text-secondary)"
              className="rounded-none"
              isActive={userVote === 'up'}
              onClick={() => onVote('up')}
              disabled={isVoting}
            />
            <RoadmapVoteButton
              voteType="down"
              count={item.downvotes}
              className="rounded-none"
              color="var(--color-text-secondary)"
              isActive={userVote === 'down'}
              onClick={() => onVote('down')}
              disabled={isVoting}
            />
          </div>
        )}

        <div className={ROADMAP_CARD_FOOTER_END}>
          {item.assignees && item.assignees.length > 0 ? (
            <AvatarStack size="xs" people={assigneePeople(item.assignees)} className="shrink-0" />
          ) : null}
          {item.screenshots && item.screenshots.length > 0 && (
            <Button
              variant="outline"
              size="small-legacy"
              onClick={() => setShowScreenshots(true)}
              leftIcon={<ImageClassicIcon className="h-5 w-5" />}
            />
          )}
          {(() => {
            const figmaSafe = safeHref(item.figmaUrl);
            return figmaSafe ? (
              <Button
                variant="outline"
                size="small-legacy"
                openInNewTab
                href={figmaSafe}
                leftIcon={<FigmaClassicIcon className="h-5 w-5" />}
              />
            ) : null;
          })()}
          {item.targetVersion && (
            <StatusBadge
              data-loading-optional
              gen={generationTierFromLabel(item.targetVersion)}
              text={item.targetVersion}
            />
          )}
        </div>
      </div>

      {item.screenshots && item.screenshots.length > 0 && (
        <ImageGalleryModal
          images={item.screenshots}
          isOpen={showScreenshots}
          onClose={() => setShowScreenshots(false)}
        />
      )}
    </div>
  );
}
