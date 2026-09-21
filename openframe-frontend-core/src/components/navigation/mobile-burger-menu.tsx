'use client';

import { usePreventScroll } from '@react-aria/overlays';
import React, { useCallback, useRef } from 'react';
import { useFocusTrap } from '../../hooks/ui/use-focus-trap';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { Logout02Icon, PenEditIcon, UserSearchIcon } from '../icons-v2-generated';
import { Button, SquareAvatar } from '../ui';
import { OVERLAY_BACKDROP_CLASS } from '../ui/drawer';

// Header height constant — the unified top-navigation `small` bar (56px on all screens)
const HEADER_HEIGHT = 56;

export interface MobileBurgerMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** Sidebar configuration */
  config: NavigationSidebarConfig;
  /** User info for the header card */
  user?: {
    userName?: string;
    userEmail?: string;
    userAvatarUrl?: string | null;
    userRole?: string;
  };
  /** Callback when search user button is clicked */
  onSearchUser?: () => void;
  /** Callback when edit profile button is clicked */
  onEditProfile?: () => void;
  /** Callback when logout button is clicked */
  onLogout?: () => void;
  /**
   * When true, all interactive items inside the menu (nav items, action buttons,
   * logout) are disabled. The burger toggle and backdrop click to close still work.
   */
  disabled?: boolean;
}

export const MobileBurgerMenu = React.memo(function MobileBurgerMenuImpl({
  isOpen,
  onClose,
  config,
  user,
  onSearchUser,
  onEditProfile,
  onLogout,
  disabled = false,
}: MobileBurgerMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Shared ref-counted, iOS-aware scroll lock (react-aria) while open.
  usePreventScroll({ isDisabled: !isOpen });
  // Initial focus, Tab containment, Escape-to-close, guarded focus restore.
  useFocusTrap(panelRef, isOpen, { onEscape: onClose });

  const handleItemClick = useCallback(
    (item: NavigationSidebarItem) => {
      if (item.onClick) {
        item.onClick();
      } else if (item.path) {
        config.onNavigate?.(item.path);
      }
      onClose();
    },
    [config, onClose],
  );

  // Separate primary and secondary items
  const primaryItems = config.items.filter(item => item.section !== 'secondary');
  const secondaryItems = config.items.filter(item => item.section === 'secondary');

  const renderNavigationItem = (item: NavigationSidebarItem, isGridItem = false) => {
    const isActive = item.isActive ?? false;

    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        disabled={disabled}
        className={cn(
          'relative flex items-center gap-1 p-3',
          'focus:outline-none focus-visible:outline-none',
          'transition-colors duration-200',
          'rounded-md border border-ods-border bg-ods-card',
          !disabled && 'hover:bg-ods-bg-hover',
          isGridItem ? 'w-full min-w-0' : 'w-full',
          // Active state
          isActive && !disabled && 'border-ods-accent',
          // Disabled state
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Icon */}
        {item.icon && (
          <div className="flex size-4 flex-shrink-0 items-center justify-center">
            {React.cloneElement(item.icon as React.ReactElement<{ size?: number; color?: string }>, {
              size: 16,
              color: isActive && !disabled ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            })}
          </div>
        )}

        {/* Label */}
        <span
          className={cn(
            'flex-1 truncate text-left text-h6',
            isActive && !disabled ? 'text-ods-accent' : 'text-ods-text-primary',
          )}
        >
          {item.label}
        </span>
      </button>
    );
  };

  // Render grid of navigation items (2 columns). CSS grid keeps a lone last-row
  // item exactly one column wide (aligned with the column above) instead of
  // stretching to fill the row.
  const renderNavigationGrid = (items: NavigationSidebarItem[]) => (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => (
        <React.Fragment key={item.id}>{renderNavigationItem(item, true)}</React.Fragment>
      ))}
    </div>
  );

  return (
    <>
      {/* Dim backdrop (no blur, unified with Drawer) - positioned below header.
          `absolute` (not `fixed`) so it anchors to the AppLayout row it renders in
          — the row that sits BELOW the optional `topBar` banner — rather than the
          viewport. This keeps `top: HEADER_HEIGHT` measured from just under the
          header even when a top banner pushes the header down. With no banner the
          row fills the viewport, so this is identical to the previous behavior. */}
      <div
        className={cn(
          'absolute inset-0 z-[100] md:hidden',
          OVERLAY_BACKDROP_CLASS,
          'transition-all duration-300 motion-reduce:transition-none',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ top: HEADER_HEIGHT }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel - positioned below header with slide-down animation. `absolute`
          for the same reason as the backdrop above (anchors below the topBar). */}
      <div
        ref={panelRef}
        className={cn(
          'absolute left-0 right-0 z-[101] md:hidden',
          'flex flex-col',
          'border-b border-ods-border bg-ods-bg',
          'transition-all duration-300 ease-out motion-reduce:transition-none',
          'overflow-hidden',
          isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0',
        )}
        style={{
          top: HEADER_HEIGHT,
          maxHeight: `calc(100% - ${HEADER_HEIGHT}px)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        tabIndex={-1}
        // Stays mounted while hidden (opacity-0) — inert keeps its items out
        // of the tab order when closed.
        inert={!isOpen || undefined}
      >
        {/* Scrollable Content */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain p-4">
          {/* User Card */}
          {user && (
            <div
              className={cn(
                'flex items-center gap-3 rounded-md border border-ods-border bg-ods-card p-3',
                disabled && 'pointer-events-none opacity-50',
              )}
              aria-disabled={disabled || undefined}
            >
              <SquareAvatar
                src={user.userAvatarUrl || undefined}
                alt={user.userName || 'User'}
                fallback={user.userName}
                size="lg"
                variant="round"
                className="h-14 w-14 shrink-0"
              />

              {/* User Info */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-ods-text-primary text-h6">{user.userName || 'User'}</span>
                  {user.userRole && (
                    <span className="shrink-0 rounded-md border border-ods-border bg-ods-card px-2 py-0.5 uppercase text-ods-text-primary text-h6">
                      {user.userRole}
                    </span>
                  )}
                </div>
                {user.userEmail && <span className="truncate text-ods-text-secondary text-h6">{user.userEmail}</span>}
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-center gap-2">
                {onSearchUser && (
                  <Button size="icon" onClick={onSearchUser} variant="outline" aria-label="Search users">
                    <UserSearchIcon className="size-4 text-ods-text-primary" />
                  </Button>
                )}
                {onEditProfile && (
                  <Button size="icon" onClick={onEditProfile} variant="outline" aria-label="Edit profile">
                    <PenEditIcon className="size-4 text-ods-text-primary" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Host-owned action above the nav — the same slot the sidebar
              renders, so a host passes `topSlot` once and both surfaces get it.
              Never minimized: this panel is always the full width of the phone. */}
          {config.topSlot?.({ minimized: false })}

          {/* Primary Navigation Items - Grid Layout */}
          <nav aria-label="Primary navigation">{renderNavigationGrid(primaryItems)}</nav>

          {/* Secondary Navigation Items - Full Width */}
          {secondaryItems.length > 0 && (
            <nav aria-label="Secondary navigation" className="flex flex-col gap-3">
              {secondaryItems.map(item => (
                <React.Fragment key={item.id}>{renderNavigationItem(item, false)}</React.Fragment>
              ))}
            </nav>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              disabled={disabled}
              className={cn(
                'flex w-full items-center gap-1 rounded-md border border-ods-border bg-ods-card p-3 transition-colors',
                !disabled && 'hover:bg-ods-bg-hover',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <Logout02Icon className="size-4 text-ods-error" />
              <span className="flex-1 text-left text-ods-text-primary text-h6">Log Out</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
});
