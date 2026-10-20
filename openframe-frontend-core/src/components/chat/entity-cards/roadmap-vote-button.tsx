'use client';

/**
 * RoadmapVoteButton — small thumbs-up / thumbs-down vote button used by
 * `RoadmapCard`'s `default` variant. Pure presentation; click handler
 * comes from the parent (typically a `useRoadmapVoting` hook).
 */

import { cn } from '../../../utils/cn';
import { ThumbsDownClassicIcon } from '../../icons-v2-generated/shopping/thumbs-down-classic-icon';
import { ThumbsUpClassicIcon } from '../../icons-v2-generated/shopping/thumbs-up-classic-icon';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button/button';
import { useLoadingScope } from '../../ui/loading-scope';

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
  const Icon = voteType === 'up' ? ThumbsUpClassicIcon : ThumbsDownClassicIcon;
  // In a scope the button and its icon are drawn as they are; only the read count is a bar.
  const loading = useLoadingScope();
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      // In a loading scope the button is part of a skeleton: never focused, never announced.
      {...(loading ? { tabIndex: -1, 'aria-hidden': true } : {})}
      leftIcon={<Icon className="h-5 w-5" color={color} />}
      className={cn(
        className,
        'flex h-full items-center justify-center gap-[2px] border-0 border-ods-border bg-ods-bg p-[12px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all hover:bg-ods-border',
        isActive && 'bg-ods-border',
      )}
    >
      {showCount &&
        (loading ? (
          <TextLineSkeleton as="span" type="h6" className="inline-block w-4" />
        ) : (
          <span className="text-h6">{count}</span>
        ))}
    </Button>
  );
}
