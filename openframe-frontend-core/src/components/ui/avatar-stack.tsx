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
  /** Stable render key — pass when names can collide or be blank
   *  (e.g. ClickUp member id). Falls back to name+index. */
  key?: string | number
}

export interface AvatarStackProps {
  people: AvatarStackPerson[]
  /** Avatars shown before collapsing into the "+N" circle. */
  max?: number
  /** Size bucket (also sizes the "+N" circle). `xs` (24px) is for
   *  dense card meta rows (chat compact cards, delivery rows). */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const OVERFLOW_CIRCLE_SIZE: Record<NonNullable<AvatarStackProps['size']>, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

/** xs has no SquareAvatar bucket — rendered via exact sizePx. */
const XS_PX = 24

export function AvatarStack({ people, max = 3, size = 'md', className }: AvatarStackProps) {
  if (people.length === 0) return null
  return (
    <div className={cn('flex items-center', className)}>
      {people.slice(0, max).map((person, i) => (
        <SquareAvatar
          key={person.key ?? `${person.name}-${i}`}
          variant="round"
          size={size === 'xs' ? 'sm' : size}
          sizePx={size === 'xs' ? XS_PX : undefined}
          src={person.avatarUrl ?? undefined}
          alt={person.name}
          fallback={person.name}
          className={cn(i > 0 && (size === 'xs' ? '-ml-2' : '-ml-3'))}
        />
      ))}
      {people.length > max && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-ods-text-secondary',
            size === 'xs' ? '-ml-2 text-badge' : '-ml-3 text-h6',
            OVERFLOW_CIRCLE_SIZE[size],
          )}
        >
          +{people.length - max}
        </span>
      )}
    </div>
  )
}
