'use client'

/**
 * RoadmapCard (pure presentation). Two densities — `default` (rich
 * /roadmap page card with vote buttons + figma/screenshots controls)
 * and `sm` (compact horizontal for chat-inline).
 *
 * The card writes NO click logic — the parent wraps with its own
 * anchor for the compact branch and supplies vote handlers for the
 * default branch.
 */

import React, { useState } from 'react'
import Image from '../../../embed-shims/next-image'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { RoadmapVoteButton } from './roadmap-vote-button'
import { FigmaIcon } from '../../icons/figma-icon'
import { ImageIcon } from '../../icons/image-icon'
import { Button } from '../../ui/button/button'
import { StatusBadge } from '../../ui/status-badge'
import { ImageGalleryModal } from '../../ui/image-gallery-modal'
import { getProxiedImageUrl } from '../../../utils/image-proxy'
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
} from '../utils/compact-card-classes'
import { getStatusColorScheme } from '../utils/agent-status-message'
import { getTaskTypeLabel } from '../utils/clickup-task-type-utils'
import { TaskTypeIcon } from './task-type-icon'
import type { RoadmapItem } from '../types/entities/roadmap-item'

type CardSize = 'default' | 'sm'
export type VoteType = 'up' | 'down' | null

export function RoadmapCardSkeleton({ size = 'default' }: { size?: CardSize }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className="block h-12 w-12 aspect-square shrink-0 self-start rounded-md bg-ods-bg border border-ods-border p-1.5" />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={`${COMPACT_CARD_TITLE_ROW} flex-nowrap gap-2`}>
            <span className="h-3.5 w-1/2 rounded bg-ods-bg" />
            <span className="h-4 w-12 rounded bg-ods-bg/70 shrink-0" />
          </span>
          <span className={`${COMPACT_CARD_META_ROW_BOX} flex-nowrap gap-2`}>
            <span className="h-3 w-2/5 rounded bg-ods-bg/60 flex-1" />
            <span className="h-3 w-10 rounded bg-ods-bg/40 shrink-0" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-5/6 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    )
  }
  return (
    <div className="bg-ods-card border border-ods-border rounded-[6px] p-[24px] flex flex-col gap-4 h-full animate-pulse">
      <div className="flex gap-4 items-center">
        <div className="w-16 h-16 rounded-lg bg-ods-bg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-ods-bg rounded" />
          <div className="h-3 w-1/2 bg-ods-bg/60 rounded" />
        </div>
        <div className="h-6 w-16 bg-ods-bg rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-ods-bg/60 rounded" />
        <div className="h-3 w-5/6 bg-ods-bg/60 rounded" />
        <div className="h-3 w-4/5 bg-ods-bg/60 rounded" />
      </div>
      <div className="flex-1" />
      <div className="flex items-center justify-between">
        <div className="h-12 w-32 bg-ods-bg rounded" />
        <div className="h-8 w-20 bg-ods-bg rounded" />
      </div>
    </div>
  )
}

export interface RoadmapCardProps {
  item: RoadmapItem
  /** Detail URL for the compact branch (`sm`). Used by the parent
   *  wrapper to drive nav. Default-branch cards don't need href —
   *  voting + screenshot UI is the entire action surface. */
  href?: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  targetPlatform?: string | null
  /** Compact-branch variant — drives the icon-slot fallback rule. */
  cardType?: 'roadmap_item' | 'delivery_item' | 'internal_task'
  size?: CardSize
  className?: string
  /** DOM `id` applied to the card's outer element. `RoadmapGrid` sets
   *  `roadmap-<external_id>` so chat-card deep-links
   *  (`?search=<id>#roadmap-<id>`) have a target for `useScrollToHash`
   *  to scroll to. `scroll-mt-24` on the outer element keeps the card
   *  BELOW the sticky chrome. */
  id?: string
  // Default-branch vote controls (ignored in `sm`):
  userVote?: VoteType | null
  onVote?: (voteType: 'up' | 'down') => void
  isVoting?: boolean
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
  const [showScreenshots, setShowScreenshots] = useState(false)

  const logoUrl = item.icon && item.icon.startsWith('http') ? item.icon : null
  const iconSrc = logoUrl
    ? getProxiedImageUrl(logoUrl, { directHttps: true }) || logoUrl
    : null

  if (size === 'sm') {
    const compactHref = safeHref(href ?? null)
    const hasVotes = (item.upvotes ?? 0) > 0 || (item.downvotes ?? 0) > 0
    const hasFigma = !!item.figmaUrl
    const hasScreenshots = (item.screenshots?.length ?? 0) > 0
    const typeLabel = getTaskTypeLabel(item.customItemId)
    const useTypeIcon = cardType === 'internal_task' || (!iconSrc && item.customItemId != null)
    const body = (
      <>
        <span
          className="flex h-12 w-12 aspect-square shrink-0 self-start items-center justify-center rounded-md overflow-hidden bg-ods-bg border border-ods-border p-1.5 text-ods-accent"
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
            <span className="text-[10px] font-medium uppercase text-ods-text-secondary">
              {item.title?.substring(0, 2) || '??'}
            </span>
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
                className="border border-ods-border shrink-0 max-w-[60%] truncate whitespace-nowrap"
              />
            ) : null}
          </span>
          <span className={`${COMPACT_CARD_META_ROW_BOX} gap-2 text-ods-text-secondary`}>
            <span className="truncate text-[11px] leading-4 min-w-0 flex-1">
              {(() => {
                const parts = [
                  item.quarter,
                  item.targetVersion ? `${item.targetVersion} version` : null,
                ].filter(Boolean)
                if (parts.length > 0) return parts.join(' · ')
                if (cardType === 'delivery_item') {
                  return typeLabel ? `Delivery · ${typeLabel}` : 'Delivery'
                }
                if (cardType === 'internal_task') {
                  return typeLabel ?? 'Internal task'
                }
                return 'Roadmap item'
              })()}
            </span>
            {hasVotes ? (
              <span className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] leading-4 text-ods-text-secondary">
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
              <span className="hidden sm:flex shrink-0 items-center" title="Has Figma prototype">
                <FigmaIcon className="h-3 w-3" />
              </span>
            ) : null}
            {hasScreenshots ? (
              <span
                className="hidden sm:flex shrink-0 items-center gap-0.5 text-[11px] leading-4"
                title={`${item.screenshots.length} screenshot${item.screenshots.length === 1 ? '' : 's'}`}
              >
                <ImageIcon className="h-3 w-3" />
                <span>{item.screenshots.length}</span>
              </span>
            ) : null}
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {item.description || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
      </>
    )
    if (!compactHref) {
      return <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">{body}</span>
    }
    return (
      <a href={compactHref} target={target} rel={rel} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </a>
    )
  }

  return (
    <div id={id} className={`bg-ods-card border border-ods-border rounded-[6px] p-[24px] flex flex-col gap-[16px] hover:border-ods-accent transition-all h-full scroll-mt-24 ${className ?? ''}`}>
      <div className="flex gap-[16px] items-center w-full">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 bg-ods-bg border border-ods-border">
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

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="min-h-[48px] flex items-center">
            <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] flex-1 line-clamp-2">
              {item.title}
            </h3>
          </div>
          <div className="min-h-[20px] flex items-center">
            <p className="text-h5 text-ods-text-secondary uppercase tracking-[-0.28px] truncate">
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

      <div className="min-h-[72px] flex items-center">
        <p className="text-h4 text-ods-text-secondary line-clamp-3">
          {item.description || ''}
        </p>
      </div>

      <div className="flex-1" />

      <div className="flex items-center justify-between w-full">
        {onVote && (
          <div className="bg-ods-card border border-ods-border h-[48px] rounded-[6px] flex overflow-hidden">
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

        <div className="flex items-center gap-2">
          {item.screenshots && item.screenshots.length > 0 && (
            <Button
              variant="outline"
              size="small-legacy"
              onClick={() => setShowScreenshots(true)}
              leftIcon={<ImageIcon className="w-5 h-5" />}
            />
          )}
          {(() => {
            const figmaSafe = safeHref(item.figmaUrl)
            return figmaSafe ? (
              <Button
                variant="outline"
                size="small-legacy"
                openInNewTab
                href={figmaSafe}
                leftIcon={<FigmaIcon className="w-5 h-5" />}
              />
            ) : null
          })()}
          {item.targetVersion && (
            <StatusBadge
              text={item.targetVersion}
              className="border border-ods-border"
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
  )
}
