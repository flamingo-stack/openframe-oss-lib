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
import { getProxiedImageUrl } from '../../../utils/image-proxy';
import { FigmaIcon } from '../../icons/figma-icon';
import { ImageIcon } from '../../icons/image-icon';
import { AvatarStack, type AvatarStackPerson } from '../../ui/avatar-stack';
import { Button } from '../../ui/button/button';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { StatusBadge, generationTierFromLabel } from '../../ui/status-badge';
import type { RoadmapItem } from '../types/entities/roadmap-item';
import { getStatusColorScheme } from '../utils/agent-status-message';
import { getTaskTypeLabel } from '../utils/clickup-task-type-utils';
import {
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
  safeHref,
} from '../utils/compact-card-classes';
import { RoadmapVoteButton } from './roadmap-vote-button';
import { TaskTypeIcon } from './task-type-icon';

type CardSize = 'default' | 'sm';
export type VoteType = 'up' | 'down' | null;

export function RoadmapCardSkeleton({ size = 'default' }: { size?: CardSize }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className="block aspect-square h-12 w-12 shrink-0 self-start rounded-md border border-ods-border bg-ods-bg p-1.5" />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={`${COMPACT_CARD_TITLE_ROW} flex-nowrap gap-2`}>
            <span className="h-3.5 w-1/2 rounded bg-ods-bg" />
            <span className="h-4 w-12 shrink-0 rounded bg-ods-bg/70" />
          </span>
          <span className={`${COMPACT_CARD_META_ROW_BOX} flex-nowrap gap-2`}>
            <span className="h-3 w-2/5 flex-1 rounded bg-ods-bg/60" />
            <span className="h-3 w-10 shrink-0 rounded bg-ods-bg/40" />
            {/* assignee-stack placeholder — mirrors the xs AvatarStack
                slot so row width doesn't shift when assignees load */}
            <span className="h-6 w-14 shrink-0 rounded-full bg-ods-bg/40" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-5/6 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    );
  }
  return (
    <div className="flex h-full animate-pulse flex-col gap-4 rounded-[6px] border border-ods-border bg-ods-card p-[24px]">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-ods-bg" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-ods-bg" />
          <div className="h-3 w-1/2 rounded bg-ods-bg/60" />
        </div>
        <div className="h-6 w-16 rounded bg-ods-bg" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-ods-bg/60" />
        <div className="h-3 w-5/6 rounded bg-ods-bg/60" />
        <div className="h-3 w-4/5 rounded bg-ods-bg/60" />
      </div>
      <div className="flex-1" />
      <div className="flex items-center justify-between">
        <div className="h-12 w-32 rounded bg-ods-bg" />
        <div className="flex items-center gap-2">
          {/* assignee-stack placeholder — matches the xs AvatarStack in
              the loaded card's action row */}
          <div className="h-6 w-14 rounded-full bg-ods-bg/60" />
          <div className="h-8 w-20 rounded bg-ods-bg" />
        </div>
      </div>
    </div>
  );
}

export interface RoadmapCardProps {
  item: RoadmapItem;
  /** Detail URL for the compact branch (`sm`). Used by the parent
   *  wrapper to drive nav. Default-branch cards don't need href —
   *  voting + screenshot UI is the entire action surface. */
  href?: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
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

export function RoadmapCard({
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
}: RoadmapCardProps) {
  const [showScreenshots, setShowScreenshots] = useState(false);

  const logoUrl = item.icon && item.icon.startsWith('http') ? item.icon : null;
  const iconSrc = logoUrl ? getProxiedImageUrl(logoUrl, { directHttps: true }) || logoUrl : null;

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
          className="flex aspect-square h-12 w-12 shrink-0 items-center justify-center self-start overflow-hidden rounded-md border border-ods-border bg-ods-bg p-1.5 text-ods-accent"
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
                <FigmaIcon className="h-3 w-3" />
              </span>
            ) : null}
            {hasScreenshots ? (
              <span
                className="hidden shrink-0 items-center gap-0.5 text-h6 sm:flex"
                title={`${item.screenshots.length} screenshot${item.screenshots.length === 1 ? '' : 's'}`}
              >
                <ImageIcon className="h-3 w-3" />
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
      <a href={compactHref} target={target} rel={rel} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </a>
    );
  }

  return (
    <div
      id={id}
      className={`flex h-full scroll-mt-24 flex-col gap-[16px] rounded-[6px] border border-ods-border bg-ods-card p-[24px] transition-all hover:border-ods-accent ${className ?? ''}`}
    >
      <div className="flex w-full items-center gap-[16px]">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg">
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

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[48px] items-center">
            <h3 className="line-clamp-2 flex-1 text-ods-text-primary text-h3">{item.title}</h3>
          </div>
          <div className="flex min-h-[20px] items-center">
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

      <div className="flex min-h-[72px] items-center">
        <p className="line-clamp-3 text-ods-text-secondary text-h4">{item.description || ''}</p>
      </div>

      <div className="flex-1" />

      <div className="flex w-full items-center justify-between">
        {onVote && (
          <div className="flex h-[48px] overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
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

        <div className="flex min-w-0 items-center gap-2">
          {item.assignees && item.assignees.length > 0 ? (
            <AvatarStack size="xs" people={assigneePeople(item.assignees)} className="shrink-0" />
          ) : null}
          {item.screenshots && item.screenshots.length > 0 && (
            <Button
              variant="outline"
              size="small-legacy"
              onClick={() => setShowScreenshots(true)}
              leftIcon={<ImageIcon className="h-5 w-5" />}
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
                leftIcon={<FigmaIcon className="h-5 w-5" />}
              />
            ) : null;
          })()}
          {item.targetVersion && (
            <StatusBadge gen={generationTierFromLabel(item.targetVersion)} text={item.targetVersion} />
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
