'use client'

/**
 * CustomerInterviewCard (pure presentation). Two densities — `default`
 * and `sm` (compact horizontal for chat-inline).
 *
 * The card writes NO click logic — callers wrap with their own anchor
 * and pass the resolved detail URL via `href`.
 */

import React from 'react'
import { Card } from '../../ui/card'
import { cn } from '../../../utils/cn'
import { Video } from 'lucide-react'
import type { CustomerInterview } from '../../../types/customer-interview'
import {
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUBTITLE,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes'

const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
}

export interface CustomerInterviewCardProps {
  interview: CustomerInterview
  href: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab`. Defaults to same-tab. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  targetPlatform?: string | null
  /** OG placeholder URL fallback when `interview.featured_image` is missing. */
  placeholderUrl?: string | null
  size?: 'default' | 'sm'
  className?: string
}

export function CustomerInterviewCardSkeleton({ size = 'default' }: { size?: 'default' | 'sm' }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className="h-3.5 w-3/5 rounded bg-ods-bg" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-2/5 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    )
  }
  return (
    <div className="bg-ods-card border border-ods-border rounded-lg overflow-hidden p-6 flex flex-col gap-6 animate-pulse">
      <div className="h-[200px] w-full rounded-sm bg-ods-bg" />
      <div className="space-y-2">
        <div className="h-5 w-3/4 bg-ods-bg rounded" />
        <div className="h-5 w-1/2 bg-ods-bg rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-ods-bg/60 rounded" />
        <div className="h-3 w-5/6 bg-ods-bg/60 rounded" />
        <div className="h-3 w-4/5 bg-ods-bg/60 rounded" />
      </div>
      <div className="h-[60px] flex items-center gap-3 mt-auto">
        <div className="h-12 w-12 rounded-full bg-ods-bg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 bg-ods-bg rounded" />
          <div className="h-3 w-1/2 bg-ods-bg/60 rounded" />
        </div>
      </div>
    </div>
  )
}

export function CustomerInterviewCard({ interview, href, target, rel, placeholderUrl, size = 'default', className }: CustomerInterviewCardProps) {
  const thumbnailUrl = interview.featured_image || placeholderUrl || null

  if (size === 'sm') {
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={interview.title}
              className="absolute inset-0 block w-full h-full object-contain"
              onError={hideOnError}
            />
          ) : null}
          {interview.main_video_url ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Video className="h-4 w-4 text-white" />
            </span>
          ) : null}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={COMPACT_CARD_TITLE}>{interview.title}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUBTITLE}>
              {[interview.user?.full_name, interview.msp?.name].filter(Boolean).join(' · ') || 'Customer interview'}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {interview.video_summary || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
      </a>
    )
  }

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)}>
      <Card className="bg-ods-card border border-ods-border hover:border-ods-accent transition-colors p-6 flex flex-col gap-6 overflow-hidden">
        <div className="h-[200px] w-full rounded-sm overflow-hidden bg-ods-bg shrink-0 relative">
          {thumbnailUrl ? (
            <>
              <img
                src={thumbnailUrl}
                alt={interview.title}
                className="w-full h-full object-cover"
                onError={hideOnError}
              />
              {interview.main_video_url && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-ods-accent/90 flex items-center justify-center">
                    <Video className="w-8 h-8 text-black" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-ods-bg">
              <Video className="w-12 h-12 text-ods-text-secondary" />
            </div>
          )}
        </div>

        <div className="shrink-0">
          <h3 className="font-['DM_Sans'] font-semibold text-[20px] leading-[28px] text-ods-text-primary line-clamp-2 break-words">
            {interview.title}
          </h3>
        </div>

        {interview.video_summary && (
          <div className="shrink-0">
            <p className="font-['DM_Sans'] text-[14px] leading-[20px] text-ods-text-secondary line-clamp-3">
              {interview.video_summary}
            </p>
          </div>
        )}

        <div className="h-[60px] flex items-center shrink-0 mt-auto">
          <div className="flex items-center gap-3 min-w-0 w-full">
            <div className="relative shrink-0 w-12 h-12">
              {interview.user?.avatar_url ? (
                <img
                  src={interview.user.avatar_url}
                  alt={interview.user?.full_name || 'Customer'}
                  className="w-12 h-12 rounded-full object-cover bg-ods-background border border-ods-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-ods-background border border-ods-border flex items-center justify-center">
                  <span className="text-ods-text-secondary font-medium text-xl">
                    {(interview.user?.full_name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {interview.msp?.icon_url && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ods-text-primary ring-1 ring-ods-bg overflow-hidden flex items-center justify-center">
                  <img
                    src={interview.msp.icon_url}
                    alt={interview.msp.name || 'MSP'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-['DM_Sans'] text-[16px] leading-[1.3] text-ods-text-primary truncate">
                {interview.user?.full_name || 'Anonymous'}
                {interview.msp?.name && <span className="text-ods-text-secondary"> • {interview.msp.name}</span>}
              </p>
              <p className="font-['DM_Sans'] text-[14px] leading-none text-ods-text-secondary truncate">
                {interview.user?.job_title || ' '}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </a>
  )
}
