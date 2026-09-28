'use client';

import { cn } from '../../utils/cn';
import { SquareAvatar } from './square-avatar';

/**
 * AvatarStack — the shared overlapping-avatar cluster ("facepile"): up to
 * `max` round `SquareAvatar`s overlapped by one avatar-third, then a "+N"
 * count circle for the rest. Promoted from the meeting-scheduler (context
 * panel + directory rows both stacked hosts by hand) so every future
 * multi-person cluster reuses ONE recipe.
 */

export interface AvatarStackPerson {
  name: string;
  avatarUrl?: string | null;
  /** Stable render key — pass when names can collide or be blank
   *  (e.g. ClickUp member id). Falls back to name+index. */
  key?: string | number;
}

type AvatarStackSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  /** Avatars shown before collapsing into the "+N" circle. Ignored when `slots` is set. */
  max?: number;
  /**
   * FIXED-WIDTH mode: the stack always occupies exactly `slots` positions, the
   * "+N" circle counting as one. Up to `slots` people show as faces; more show
   * `slots - 1` faces and the circle. Use it wherever rows must line up (a
   * table column): the width no longer depends on how many people a row holds,
   * so the text beside every stack starts at the same x.
   */
  slots?: number;
  /** Size bucket (also sizes the "+N" circle). `xs` (24px) is for
   *  dense card meta rows (chat compact cards, delivery rows). */
  size?: AvatarStackSize;
  /** Ring color class separating overlapped avatars from each other —
   *  MUST match the surface the stack sits on (default: card surface).
   *  Without the surface-colored ring, overlapping photos read as one
   *  smeared blob — the ring is what makes a stack look deliberate. */
  ringClassName?: string;
  /** What these people ARE, for the group's accessible name ("Hosts: Ada, Lin").
   *  Default "Assignees". */
  label?: string;
  className?: string;
}

/** Face diameter and how far each later face tucks under the previous one — the
 *  `SquareAvatar` buckets and the `-ml-*` classes below, in px, for `slots`. */
const SIZE_PX: Record<AvatarStackSize, number> = { xs: 24, sm: 32, md: 40, lg: 48 };
const OVERLAP_PX: Record<AvatarStackSize, number> = { xs: 8, sm: 12, md: 12, lg: 12 };

const OVERFLOW_CIRCLE_SIZE: Record<AvatarStackSize, string> = {
  xs: 'h-6 min-w-6',
  sm: 'h-8 min-w-8',
  md: 'h-10 min-w-10',
  lg: 'h-12 min-w-12',
};

export function AvatarStack({
  people,
  max = 3,
  slots,
  size = 'md',
  ringClassName = 'ring-ods-card',
  label = 'Assignees',
  className,
}: AvatarStackProps) {
  if (people.length === 0) return null;
  const faces = slots ? (people.length > slots ? slots - 1 : slots) : max;
  const visible = people.slice(0, faces);
  const overflow = people.slice(faces);
  const compact = size === 'xs';
  return (
    <div
      className={cn('flex items-center', slots && 'shrink-0', className)}
      style={slots ? { width: SIZE_PX[size] + (slots - 1) * (SIZE_PX[size] - OVERLAP_PX[size]) } : undefined}
      role="group"
      aria-label={`${label}: ${people.map(p => p.name).join(', ')}`}
    >
      {visible.map((person, i) => (
        <SquareAvatar
          key={person.key ?? `${person.name}-${i}`}
          variant="round"
          size={size}
          src={person.avatarUrl ?? undefined}
          alt={person.name}
          fallback={person.name}
          title={person.name}
          className={cn('relative ring-2', ringClassName, i > 0 && (compact ? '-ml-2' : '-ml-3'))}
          // Leftmost (primary assignee) on TOP — later avatars tuck
          // BEHIND, so the first face is always fully visible.
          style={{ zIndex: visible.length - i }}
        />
      ))}
      {overflow.length > 0 && (
        <span
          title={overflow.map(p => p.name).join(', ')}
          className={cn(
            'relative z-0 flex shrink-0 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary ring-2',
            ringClassName,
            // The circle tucks under the last face like every other avatar, so
            // its left edge is covered: the left padding equals that overlap,
            // centering "+N" in the part that shows. `min-w` (not a fixed
            // width) lets a two-digit count widen the circle instead of clipping.
            compact ? '-ml-2 pl-2 pr-1 text-badge' : '-ml-3 pl-3 pr-1.5 text-h6',
            OVERFLOW_CIRCLE_SIZE[size],
          )}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  );
}
