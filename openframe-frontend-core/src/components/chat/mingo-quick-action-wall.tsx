'use client';

import { cn } from '../../utils/cn';
import type { MingoQuickAction } from './mingo-welcome';
import { QuickActionWall } from './quick-action-wall';

export interface MingoQuickActionWallProps {
  quickActions: ReadonlyArray<MingoQuickAction>;
  /** Pointer/keyboard focus enters a chip — e.g. preview its prompt in the composer. */
  onQuickActionHover?: (action: MingoQuickAction) => void;
  /** Pointer/keyboard focus leaves the chip. */
  onQuickActionHoverEnd?: () => void;
  /** A built-in agent (`'fae'`/`'mingo'`) caps the wall at 2 rows. Default `'mingo'`. */
  agentSlug?: string;
  /**
   * The actions are still being read: the wall draws its chips' loading form at its full
   * row count, so a host that holds its layout around the wall (a composer under it, a
   * greeting centred above) does not move when the actions land.
   */
  loading?: boolean;
  className?: string;
}

/**
 * Mingo's quick actions as the chat's empty state draws them (`MingoWelcome`): the
 * shared {@link QuickActionWall} in BRICK mode — stacked row marquees (2 for a built-in
 * agent) under left/right edge fades, so a long action set gets "reach" without
 * squeezing the composer. `pauseOnHover` freezes the hovered row so a moving chip
 * never dodges a click. One component, so a host that shows the actions outside the
 * chat (a docked composer's home) draws the very same wall.
 */
export function MingoQuickActionWall({
  quickActions,
  onQuickActionHover,
  onQuickActionHoverEnd,
  agentSlug = 'mingo',
  loading = false,
  className,
}: MingoQuickActionWallProps) {
  if (quickActions.length === 0 && !loading) return null;
  return (
    <QuickActionWall
      chips={quickActions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        variant: action.variant,
        onSelect: action.onClick,
        onHoverStart: () => onQuickActionHover?.(action),
        onHoverEnd: () => onQuickActionHoverEnd?.(),
      }))}
      agentSlug={agentSlug}
      loading={loading}
      rows={4}
      pauseOnHover
      dragScroll
      fade={['left', 'right']}
      fadeSize={{ left: 32 }}
      fadeColor="var(--color-bg)"
      copyGap="var(--spacing-system-xxs)"
      className={cn('max-h-44 shrink-0', className)}
    />
  );
}
