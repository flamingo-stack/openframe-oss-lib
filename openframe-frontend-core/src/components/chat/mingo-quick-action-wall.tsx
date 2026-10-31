'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Ellipsis01Icon } from '../icons-v2-generated';
import { ActionsMenuDropdown } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';
import type { MingoQuickAction } from './mingo-welcome';
import {
  QuickActionChipButton,
  QuickActionChipFromData,
  type QuickActionChip,
  type QuickActionThemeSpec,
  isQuickActionIconSpec,
  renderQuickActionIcon,
} from './quick-action-chip';
import { WALL_SKELETON_LABEL_CH } from './quick-action-wall';

/**
 * The slots a chat's quick-action set holds: what it shows, and what it reserves. Suggested-prompt research and
 * every leading AI chat show three to five starters at once (NN/g, "Designing use-case prompt suggestions", 2025;
 * ChatGPT, Claude, Gemini, Copilot), so four slots, the last one "More" when there are more actions.
 */
export const QUICK_ACTION_SET_SLOTS = 4;

export interface QuickActionSetProps {
  /** The actions, in the order to show them (the host puts the page topic's own first). */
  chips: ReadonlyArray<QuickActionChip>;
  /** Default theme for chips without their own (the agent's accent). */
  theme?: QuickActionThemeSpec;
  /** The actions are still read: every slot draws its chip's loading form. */
  loading?: boolean;
  /** The group's accessible name. */
  label?: string;
  className?: string;
}

/**
 * A chat's quick actions: a STATIC set of {@link QUICK_ACTION_SET_SLOTS} fixed slots above the composer, never a
 * moving wall. Its height is decided by its container's width alone (one column under 24rem, two under 48rem, four
 * above), never by the actions: fewer actions leave their slots empty, more turn the last slot into "More (n)", which
 * opens the rest in a menu that floats over the page, and a long name clips on its one line (its tooltip shows it
 * whole). Loading draws the same slots, each the chip's own loading form. So the set is the same box loading,
 * loaded, with 1 action or 40, and opening "More" moves nothing.
 *
 * Hover or focus on a chip previews its prompt (`onHoverStart`), a click sends it (`onSelect`).
 */
export function QuickActionSet({
  chips,
  theme,
  loading: loadingProp = false,
  label = 'Quick actions',
  className,
}: QuickActionSetProps) {
  const loading = useLoadingScope() || loadingProp;
  const overflows = chips.length > QUICK_ACTION_SET_SLOTS;
  const shown = overflows ? chips.slice(0, QUICK_ACTION_SET_SLOTS - 1) : chips;
  const rest = overflows ? chips.slice(QUICK_ACTION_SET_SLOTS - 1) : [];
  const empty = loading ? 0 : QUICK_ACTION_SET_SLOTS - shown.length - (overflows ? 1 : 0);

  const moreItems = rest.map(chip => {
    const icon =
      theme && isQuickActionIconSpec(chip.icon) && !chip.icon.accent
        ? { ...chip.icon, accent: theme.accent }
        : chip.icon;
    return { id: chip.id, label: chip.label, icon: renderQuickActionIcon(icon), onClick: chip.onSelect };
  });

  return (
    <div role="group" aria-label={label} className={cn('shrink-0 @container', className)}>
      <div className="grid grid-cols-1 gap-[var(--spacing-system-xs)] @[24rem]:grid-cols-2 @[48rem]:grid-cols-4">
        {loading ? (
          <LoadingItems count={QUICK_ACTION_SET_SLOTS}>
            {i => (
              <Slot>
                <QuickActionChipButton
                  loading
                  fill
                  label=""
                  icon
                  labelCh={WALL_SKELETON_LABEL_CH[i % WALL_SKELETON_LABEL_CH.length]}
                  data-loading-item
                />
              </Slot>
            )}
          </LoadingItems>
        ) : (
          <>
            {shown.map(chip => (
              <Slot key={chip.id}>
                <QuickActionChipFromData chip={chip} defaultTheme={theme} fill data-loading-item />
              </Slot>
            ))}
            {overflows && (
              <Slot>
                <ActionsMenuDropdown
                  groups={[{ items: moreItems }]}
                  align="end"
                  side="top"
                  customTrigger={
                    <Button
                      variant="card"
                      type="button"
                      aria-label={`More quick actions (${rest.length})`}
                      className="w-full min-w-0"
                    >
                      <QuickActionChipButton
                        interactive={false}
                        fill
                        label={`More (${rest.length})`}
                        icon={<Ellipsis01Icon size={16} />}
                      />
                    </Button>
                  }
                />
              </Slot>
            )}
            {/* Unused slots keep their place, so the set never shrinks: the chip's own box, unseen. */}
            {Array.from({ length: empty }, (_, i) => (
              <Slot key={`empty-${i}`} unused>
                <QuickActionChipButton loading fill label="" icon />
              </Slot>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** One cell of the set's grid: whatever it holds (a chip, its loading form, "More", or an unused slot's unseen box)
 *  fills it. */
function Slot({ unused = false, children }: { unused?: boolean; children: ReactNode }) {
  return (
    <div
      data-testid="quick-action-slot"
      aria-hidden={unused || undefined}
      className={cn('min-w-0', unused && 'invisible')}
    >
      {children}
    </div>
  );
}

export interface MingoQuickActionWallProps {
  quickActions: ReadonlyArray<MingoQuickAction>;
  /** Pointer/keyboard focus enters a chip — e.g. preview its prompt in the composer. */
  onQuickActionHover?: (action: MingoQuickAction) => void;
  /** Pointer/keyboard focus leaves the chip. */
  onQuickActionHoverEnd?: () => void;
  /**
   * The actions are still being read: the set draws its chips' loading form in every slot, so a host that holds its
   * layout around it (a composer under it, a greeting centred above) does not move when the actions land.
   */
  loading?: boolean;
  className?: string;
}

/**
 * Mingo's quick actions as the chat's empty state draws them (`MingoWelcome`): the {@link QuickActionSet}. One
 * component, so a host that shows the actions outside the chat (a docked composer's home) draws the very same set.
 */
export function MingoQuickActionWall({
  quickActions,
  onQuickActionHover,
  onQuickActionHoverEnd,
  loading = false,
  className,
}: MingoQuickActionWallProps) {
  if (quickActions.length === 0 && !loading) return null;
  return (
    <QuickActionSet
      chips={quickActions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        variant: action.variant,
        onSelect: action.onClick,
        onHoverStart: () => onQuickActionHover?.(action),
        onHoverEnd: () => onQuickActionHoverEnd?.(),
      }))}
      loading={loading}
      className={className}
    />
  );
}
