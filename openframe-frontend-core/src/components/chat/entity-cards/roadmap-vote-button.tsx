'use client';

/**
 * RoadmapVoteButton — small thumbs-up / thumbs-down vote button used by
 * `RoadmapCard`'s `default` variant. Pure presentation; click handler
 * comes from the parent (typically a `useRoadmapVoting` hook).
 */

import { cn } from '../../../utils/cn';
import { ThumbsDownIcon } from '../../icons/thumbs-down-icon';
import { ThumbsUpIcon } from '../../icons/thumbs-up-icon';
import { Button } from '../../ui/button/button';

export interface RoadmapVoteButtonProps {
  voteType: 'up' | 'down';
  count: number;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  showCount?: boolean;
  color?: string;
  className?: string;
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
  const Icon = voteType === 'up' ? ThumbsUpIcon : ThumbsDownIcon;
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      leftIcon={<Icon className="h-5 w-5" color={color} />}
      className={cn(
        className,
        'flex h-full items-center justify-center gap-[2px] border-0 border-ods-border bg-ods-bg p-[12px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all hover:bg-ods-border',
        isActive && 'bg-ods-border',
      )}
    >
      {showCount && <span className="text-h6">{count}</span>}
    </Button>
  );
}
