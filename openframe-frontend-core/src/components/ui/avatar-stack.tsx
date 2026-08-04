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
  /** Ring color class separating overlapped avatars from each other —
   *  MUST match the surface the stack sits on (default: card surface).
   *  Without the surface-colored ring, overlapping photos read as one
   *  smeared blob — the ring is what makes a stack look deliberate. */
  ringClassName?: string
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

export function AvatarStack({
  people,
  max = 3,
  size = 'md',
  ringClassName = 'ring-ods-card',
  className,
}: AvatarStackProps) {
  if (people.length === 0) return null
  const visible = people.slice(0, max)
  const overflow = people.slice(max)
  return (
    <div
      className={cn('flex items-center', className)}
      role="group"
      aria-label={`Assignees: ${people.map((p) => p.name).join(', ')}`}
    >
      {visible.map((person, i) => (
        <SquareAvatar
          key={person.key ?? `${person.name}-${i}`}
          variant="round"
          size={size === 'xs' ? 'sm' : size}
          sizePx={size === 'xs' ? XS_PX : undefined}
          src={person.avatarUrl ?? undefined}
          alt={person.name}
          fallback={person.name}
          title={person.name}
          className={cn('relative ring-2', ringClassName, i > 0 && (size === 'xs' ? '-ml-2' : '-ml-3'))}
          // Leftmost (primary assignee) on TOP — later avatars tuck
          // BEHIND, so the first face is always fully visible.
          style={{ zIndex: visible.length - i }}
        />
      ))}
      {overflow.length > 0 && (
        <span
          title={overflow.map((p) => p.name).join(', ')}
          className={cn(
            'relative z-0 flex shrink-0 items-center justify-center rounded-full ring-2 bg-ods-bg text-ods-text-secondary',
            ringClassName,
            size === 'xs' ? '-ml-2 text-badge' : '-ml-3 text-h6',
            OVERFLOW_CIRCLE_SIZE[size],
          )}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  )
}
