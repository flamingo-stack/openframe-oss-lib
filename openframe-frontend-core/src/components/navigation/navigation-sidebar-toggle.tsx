'use client';

import { cn } from '../../utils';
import { Chevrons03LeftIcon, SidebarFlipIcon, SidebarIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';

export interface NavigationSidebarToggleProps {
  minimized: boolean;
  showLabel: boolean;
  onToggle: () => void;
  /**
   * The grouped variant's footer: a 44px row cell inset like the tree's rows,
   * with their hover and a 20px chevron on their icons' line, and the label
   * beside it. Default false: the flat sidebar's 56px row with a 24px chevron.
   */
  compact?: boolean;
  /**
   * The sidebar's edge (`NavigationSidebarConfig.side`). A right sidebar's
   * chevron is mirrored: it points right to hide the menu, left to show it.
   */
  side?: 'left' | 'right';
  /** The border above the toggle. Default `border-ods-border`. */
  borderClassName?: string;
}

export function NavigationSidebarToggle({
  minimized,
  showLabel,
  onToggle,
  compact = false,
  side = 'left',
  borderClassName = 'border-ods-border',
}: NavigationSidebarToggleProps) {
  return (
    <div
      className={cn(
        'border-t',
        borderClassName,
        compact && 'px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)]',
      )}
    >
      <Button
        variant="row"
        onClick={onToggle}
        className={cn(
          // Compact: the tree's row geometry — inset, rounded, the chevron on the
          // rows' icon line in both widths — so the rail's cells are all one kind.
          // Otherwise the sidebar's row height (its entries are `h-14` too).
          compact
            ? 'h-11 gap-0 overflow-hidden pl-[var(--spacing-system-xsf)] pr-0 transition-[padding,background-color] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)] motion-reduce:transition-none'
            : 'h-14',
        )}
        title={minimized ? 'Hide Menu' : undefined}
        aria-label={'Hide Menu'}
      >
        <div className="flex flex-shrink-0 items-center justify-center">
          {/* Direction follows the rail's measured width (the `of-nav-sidebar`
              container declared in `navigation-sidebar.tsx`), not `minimized`:
              before hydration that prop can only carry the server's answer, and
              a chevron pointing the wrong way in a 56px rail is the one piece of
              sidebar state a user actually notices arriving late.

              Collapsed is the default because container queries are min-width —
              the rail is narrower than every threshold, so it needs no query of
              its own. */}
          <Chevrons03LeftIcon
            className={cn(
              'text-ods-text-secondary transition-transform duration-300',
              side === 'right'
                ? 'rotate-0 @[140px]/of-nav-sidebar:rotate-180'
                : 'rotate-180 @[140px]/of-nav-sidebar:rotate-0',
              compact ? 'size-5' : 'h-6 w-6',
            )}
          />
        </div>

        <span
          className={cn(
            'flex-1 truncate text-left transition-[opacity,margin-left] duration-300 text-h4',
            // Compact: the width, not `showLabel`, says when it is the rail — the
            // label fades as the width crosses 140px, as the rows' labels do.
            compact
              ? 'ml-[var(--spacing-system-xs)] min-w-0 opacity-0 duration-150 @[140px]/of-nav-sidebar:opacity-100'
              : showLabel
                ? 'ml-[var(--spacing-system-xs)] opacity-100'
                : 'ml-0 opacity-0',
          )}
          aria-hidden={!showLabel}
        >
          Hide Menu
        </span>
      </Button>
    </div>
  );
}

export interface NavigationSidebarIconToggleProps {
  minimized: boolean;
  onToggle: () => void;
  side?: 'left' | 'right';
  /** The border above the footer. Default `border-ods-border`. */
  borderClassName?: string;
}

/**
 * The `toggle: 'icon'` footer: 56px, the border above it, a 32px button with the
 * sidebar glyph (mirrored for a right sidebar) — at the left edge of the expanded
 * sidebar, centred in the rail.
 */
export function NavigationSidebarIconToggle({
  minimized,
  onToggle,
  side = 'left',
  borderClassName = 'border-ods-border',
}: NavigationSidebarIconToggleProps) {
  const label = minimized ? 'Show Menu' : 'Hide Menu';
  const Icon = side === 'right' ? SidebarFlipIcon : SidebarIcon;
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center justify-center border-t px-[var(--spacing-system-xsf)] @[140px]/of-nav-sidebar:justify-start',
        borderClassName,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        title={label}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md text-ods-text-panel-secondary transition-colors',
          'hover:bg-ods-bg-hover hover:text-ods-text-primary active:bg-ods-bg-active',
          'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
        )}
      >
        <Icon size={20} />
      </button>
    </div>
  );
}
