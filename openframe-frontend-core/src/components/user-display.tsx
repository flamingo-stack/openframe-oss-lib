'use client';

import { cn } from '../utils/cn';
import { getProxiedImageUrl } from '../utils/image-proxy';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';
import { SquareAvatar, SquareAvatarSkeleton } from './ui/square-avatar';

interface UserDisplayProps {
  name: string;
  avatarUrl?: string | null;
  /** optional secondary text (e.g., relative timestamp) */
  subtitle?: string | null;
  /** Avatar size in px (defaults 32) */
  size?: number;
  /** Avatar corner treatment, forwarded to SquareAvatar. Default 'square'. */
  shape?: 'square' | 'round';
  /** Compact typography (14px/20px rows — video-bite overlay density). */
  compact?: boolean;
  className?: string;
}

/** The row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const USER_ROW_CLASS = 'flex min-w-0 items-center gap-2';
const USER_TEXT_CLASS = 'min-w-0 flex-1';

/**
 * Reusable horizontal avatar + name (+ optional subtitle) row that follows
 * the visual pattern used in CommentCard headers.
 */
export function UserDisplay({
  name,
  avatarUrl,
  subtitle,
  size = 32,
  shape = 'square',
  compact = false,
  className,
}: UserDisplayProps) {
  if (useLoadingScope()) {
    return (
      <UserDisplaySkeleton size={size} shape={shape} compact={compact} subtitle={subtitle !== undefined} className={className} />
    );
  }
  return (
    <div className={cn(USER_ROW_CLASS, className)}>
      <SquareAvatar
        src={avatarUrl ? getProxiedImageUrl(avatarUrl) || avatarUrl : undefined}
        fallback={name}
        alt={name}
        sizePx={size}
        variant={shape}
      />
      <div className={USER_TEXT_CLASS}>
        <p className={cn('truncate text-ods-text-primary', compact ? 'text-h6' : 'text-h4')}>{name}</p>
        {subtitle && <span className="block truncate text-ods-text-secondary text-h6">{subtitle}</span>}
      </div>
    </div>
  );
}

export interface UserDisplaySkeletonProps {
  /** Avatar size in px (defaults 32). */
  size?: number;
  shape?: 'square' | 'round';
  compact?: boolean;
  /** Whether the row has a second line. */
  subtitle?: boolean;
  className?: string;
}

/** The row while it is read: the avatar's box, a bar for the name and, with `subtitle`, one for the second line. */
export function UserDisplaySkeleton({
  size = 32,
  shape = 'square',
  compact = false,
  subtitle = false,
  className,
}: UserDisplaySkeletonProps) {
  return (
    <div className={cn(USER_ROW_CLASS, className)} aria-hidden>
      <SquareAvatarSkeleton sizePx={size} variant={shape} />
      <div className={USER_TEXT_CLASS}>
        <TextLineSkeleton type={compact ? 'h6' : 'h4'} className="w-28" />
        {subtitle && <TextLineSkeleton type="h6" className="w-16" />}
      </div>
    </div>
  );
}
