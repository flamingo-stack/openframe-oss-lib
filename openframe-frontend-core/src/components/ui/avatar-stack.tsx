'use client'

import { SquareAvatar } from './square-avatar'
import { cn } from '../../utils/cn'

/**
 * AvatarStack — the shared overlapping-avatar cluster ("facepile"): up to
 * `max` round `SquareAvatar`s overlapped by one avatar-third, then a "+N"
 * count circle for the rest. Promoted from the meeting-scheduler (context
 * panel + directory rows both stacked hosts by hand) so every future
 * multi-person cluster reuses ONE recipe.
 */

export interface AvatarStackPerson {
  name: string
  avatarUrl?: string | null
}

export interface AvatarStackProps {
  people: AvatarStackPerson[]
  /** Avatars shown before collapsing into the "+N" circle. */
  max?: number
  /** SquareAvatar size bucket (also sizes the "+N" circle). */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const OVERFLOW_CIRCLE_SIZE: Record<NonNullable<AvatarStackProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

export function AvatarStack({ people, max = 3, size = 'md', className }: AvatarStackProps) {
  if (people.length === 0) return null
  return (
    <div className={cn('flex items-center', className)}>
      {people.slice(0, max).map((person, i) => (
        <SquareAvatar
          key={person.name}
          variant="round"
          size={size}
          src={person.avatarUrl ?? undefined}
          alt={person.name}
          fallback={person.name}
          className={i > 0 ? '-ml-3' : undefined}
        />
      ))}
      {people.length > max && (
        <span
          className={cn(
            '-ml-3 flex shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-h6 text-ods-text-secondary',
            OVERFLOW_CIRCLE_SIZE[size],
          )}
        >
          +{people.length - max}
        </span>
      )}
    </div>
  )
}
