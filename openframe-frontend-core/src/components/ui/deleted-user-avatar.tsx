'use client';

import { cn } from '../../utils/cn';
import { UserXmarkIcon } from '../icons-v2-generated';

/** Mirrors SquareAvatar's size buckets (sm 32 / md 40 / lg 48). */
const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

const ICON_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

export interface DeletedUserAvatarProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /**
   * Accessible name for the placeholder. Pass the user's identity when known
   * (e.g. "Deleted user: Jane Doe") so assistive technology doesn't lose who
   * the row refers to. Falls back to the generic "Deleted user".
   */
  accessibleLabel?: string;
}

/**
 * Red round user-x placeholder shown instead of the avatar for deleted users
 * (accounts with status DELETED / SELF_DELETED). A dedicated component — not a
 * `SquareAvatar` prop — because `SquareAvatar`'s only fallback is text
 * initials, and initials for a deleted account is exactly what the design
 * replaces.
 */
export function DeletedUserAvatar({ size = 'md', className, accessibleLabel }: DeletedUserAvatarProps) {
  return (
    <span
      role="img"
      aria-label={accessibleLabel || 'Deleted user'}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-ods-error/20',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <UserXmarkIcon className={cn('text-ods-error', ICON_CLASSES[size])} />
    </span>
  );
}
