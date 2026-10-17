'use client';

import { usePreventScroll } from '@react-aria/overlays';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/ui/use-focus-trap';
import type {
  NavigationSidebarConfig,
  NavigationSidebarItem,
  NavigationSidebarSlotState,
} from '../../types/navigation';
import { cn } from '../../utils';
import { Logout02Icon, PenEditIcon, UserSearchIcon } from '../icons-v2-generated';
import { Button, SquareAvatar } from '../ui';
import { OVERLAY_BACKDROP_CLASS } from '../ui/drawer';
import { PortalContainerContext } from '../ui/portal-container';
import { NavigationItemBadge } from './navigation-item-badge';
import { isModifiedClick } from './navigation-sidebar';
import { NavigationSidebarGroupedEntries, useOpenNavigationGroup } from './navigation-sidebar-grouped';
import { resolveNavigationActive } from './navigation-sidebar-match';
import { hasNavigationSidebarSlot, renderNavigationSidebarSlot } from './navigation-sidebar-slot';

// Header height constant — the unified top-navigation `small` bar (56px on all screens)
const HEADER_HEIGHT = 56;

/** The drawer always lays its slots out expanded. */
const DRAWER_SLOT_STATE: NavigationSidebarSlotState = { minimized: false, inDrawer: true };

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

  // Grouped variant: the sidebar's own tree and active resolution. A parent
  // only opens and folds, as in the sidebar.
  const grouped = config.variant === 'grouped';
  const { activeId, groupId: activeGroupId } = useMemo(
    () => resolveNavigationActive(config.items, { currentPath: config.currentPath, includeChildren: true }),
    [config.items, config.currentPath],
  );
  const [openGroupId, setOpenGroupId] = useOpenNavigationGroup(activeGroupId);
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  // A grouped row is a real anchor (the sidebar's row), so a plain click must
  // not ALSO let the browser follow it when the host routes through
  // `onNavigate`; a modified click is the browser's (new tab) and leaves the
  // menu as it is.
  const handleGroupedItemClick = useCallback(
    (item: NavigationSidebarItem, event?: React.MouseEvent) => {
      if (item.path && !item.onClick) {
        if (isModifiedClick(event)) return;
        if (config.onNavigate) event?.preventDefault();
      }
      handleItemClick(item);
    },
    [config.onNavigate, handleItemClick],
  );
  const handleGroupClick = useCallback(
    (item: NavigationSidebarItem) => setOpenGroupId(current => (current === item.id ? null : item.id)),
    [setOpenGroupId],
  );

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
        // The same name the sidebar row announces — "Scripts (Beta)" — rather than
        // the content read raw, which Chrome hands over as "Scripts BETA".
        aria-label={item.badge ? `${item.label} (${item.badge})` : undefined}
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

        {/* Label, with its stamp when the entry carries one. The button's
            accessible name is its content, so the stamp reads as part of it. */}
        <span className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]">
          <span
            className={cn(
              'min-w-0 truncate text-left text-h6',
              isActive && !disabled ? 'text-ods-accent' : 'text-ods-text-primary',
            )}
          >
            {item.label}
          </span>
          {item.badge && <NavigationItemBadge compact label={item.badge} />}
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

  // User card — the flat menu's header; the grouped drawer keeps it too when the host passes `user`.
  const userCard = user && (
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
  );

  // Logout button — last in both forms of the menu.
  const logoutButton = onLogout && (
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
  );

  if (grouped) {
    const { sectionSlot, footerSlot } = config;
    return (
      // The drawer's own stacking layer, below the header: the scrim, the panel
      // and the host its popups portal into (the account menu), so a menu opened
      // in the panel stacks over it instead of under its `z-[101]`. The layer
      // itself takes no clicks; its children opt back in.
      <div className="pointer-events-none absolute inset-0 z-[101] md:hidden" style={{ top: HEADER_HEIGHT }}>
        <div
          className={cn(
            'absolute inset-0',
            OVERLAY_BACKDROP_CLASS,
            'transition-all duration-300 motion-reduce:transition-none',
            isOpen ? 'pointer-events-auto opacity-100' : 'opacity-0',
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* The sidebar as a drawer from the left, 300px (at most 85% of the
            phone), with the sidebar's rows, slots and active resolution. */}
        <div
          ref={panelRef}
          className={cn(
            'absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col',
            'border-r border-ods-border bg-ods-card',
            'transition-transform duration-300 ease-out motion-reduce:transition-none',
            isOpen ? 'pointer-events-auto translate-x-0' : '-translate-x-full',
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          tabIndex={-1}
          inert={!isOpen || undefined}
        >
          <PortalContainerContext.Provider value={portalHost}>
            {/* The rail's container, declared at the drawer's width, so the
                grouped rows — which read it — lay out expanded. */}
            <div className="flex min-h-0 flex-1 flex-col @container/of-nav-sidebar">
              <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-mf)] overflow-y-auto overflow-x-hidden overscroll-contain px-[var(--spacing-system-xsf)] py-[var(--spacing-system-mf)]">
                {userCard}

                {/* The top slot, the tree and the section as one block, spaced as in
                    the sidebar: no gap between them, a divider before the section. */}
                <div className="flex flex-col">
                  {config.topSlot?.({ minimized: false })}

                  <nav aria-label="Primary navigation" className="flex flex-col gap-[var(--spacing-system-xxs)]">
                    <NavigationSidebarGroupedEntries
                      items={primaryItems}
                      activeId={activeId}
                      pendingId={null}
                      openGroupId={openGroupId}
                      showLabel
                      disabled={disabled}
                      onItemClick={handleGroupedItemClick}
                      onGroupClick={handleGroupClick}
                    />
                  </nav>

                  {/* In the flow at its full height, as in the sidebar: the drawer's
                      body scrolls the tree and the section as one. */}
                  {hasNavigationSidebarSlot(sectionSlot) && (
                    <div className="mt-[var(--spacing-system-xsf)] flex flex-col border-t border-ods-border pt-[var(--spacing-system-sf)]">
                      {renderNavigationSidebarSlot(sectionSlot, DRAWER_SLOT_STATE)}
                    </div>
                  )}
                </div>

                {secondaryItems.length > 0 && (
                  <nav aria-label="Secondary navigation" className="flex flex-col">
                    <NavigationSidebarGroupedEntries
                      items={secondaryItems}
                      activeId={activeId}
                      pendingId={null}
                      openGroupId={openGroupId}
                      showLabel
                      disabled={disabled}
                      onItemClick={handleGroupedItemClick}
                      onGroupClick={handleGroupClick}
                    />
                  </nav>
                )}

                {logoutButton}
              </div>

              {hasNavigationSidebarSlot(footerSlot) && (
                <div className="shrink-0 border-t border-ods-border px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)]">
                  {renderNavigationSidebarSlot(footerSlot, DRAWER_SLOT_STATE)}
                </div>
              )}
            </div>
          </PortalContainerContext.Provider>
        </div>

        {/* Outside the panel: its slide is a transform, which would anchor the
            menus' `position: fixed` to the panel. */}
        <div ref={setPortalHost} className="pointer-events-auto contents" />
      </div>
    );
  }

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
          {userCard}

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
          {logoutButton}
        </div>
      </div>
    </>
  );
});
