'use client'

/**
 * RoadmapVoteButton — small thumbs-up / thumbs-down vote button used by
 * `RoadmapCard`'s `default` variant. Pure presentation; click handler
 * comes from the parent (typically a `useRoadmapVoting` hook).
 */

import React from 'react'
import { ThumbsUpIcon } from '../../icons/thumbs-up-icon'
import { ThumbsDownIcon } from '../../icons/thumbs-down-icon'
import { Button } from '../../ui/button/button'
import { cn } from '../../../utils/cn'

export interface RoadmapVoteButtonProps {
  voteType: 'up' | 'down'
  count: number
  isActive: boolean
  onClick: () => void
  disabled?: boolean
  showCount?: boolean
  color?: string
  className?: string
}

export function RoadmapVoteButton({
  voteType,
  count,
  isActive,
  onClick,
  disabled = false,
  showCount = true,
  color,
  className,
}: RoadmapVoteButtonProps) {
  const Icon = voteType === 'up' ? ThumbsUpIcon : ThumbsDownIcon
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      leftIcon={<Icon className="w-5 h-5" color={color} />}
      className={cn(
        className,
        'bg-ods-bg border-0 border-ods-border flex gap-[2px] items-center justify-center p-[12px] h-full',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'hover:bg-ods-border transition-all',
        isActive && 'bg-ods-border',
      )}
    >
      {showCount && <span className="text-sm">{count}</span>}
    </Button>
  )
}
