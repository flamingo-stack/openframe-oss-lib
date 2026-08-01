'use client';

import React from 'react';
import { useMdUp } from '../../hooks/ui/use-media-query';
import { cn } from '../../utils/cn';
import { useOptionalNotifications } from '../features/notifications/notifications-context';
import { TimeTrackerHeaderButton } from '../features/time-tracker';
import { LogOutIcon, OpenFrameLogo, OpenFrameText, UserIcon } from '../icons';
import { Menu01Icon, SearchIcon, XmarkIcon } from '../icons-v2-generated';
import { BellIcon } from '../icons-v2-generated/interface/bell-icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SquareAvatar } from '../ui';
import { HeaderButton } from './header-button';
import { HeaderGlobalSearch } from './header-global-search';
import { TicketAlertsButton } from './ticket-alerts-button';
import { HeaderMingoButton } from './header-mingo-button';
import { HeaderOrganizationFilter } from './header-organization-filter';
import { TopNavigation } from './top-navigation';

export interface AppHeaderProps {
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  showOrganizations?: boolean;
  organizations?: { id: string; name: string }[];
  selectedOrgId?: string;
  onOrgChange?: (id: string) => void;
  showNotifications?: boolean;
  unreadCount?: number;
  /** Render the support-ticket alerts cell (`TicketAlertsButton`).
   *  Requires wrapping the app in `<TicketLiveProvider>` — without it
   *  the cell renders nothing. */
  showTicketAlerts?: boolean;
  /** Navigation target for the tickets surface (e.g. '/help-center/tickets'). */
  ticketAlertsHref?: string;
  /** Host navigation for the tickets cell (router push). Wins over href. */
  onTicketAlerts?: () => void;
  /** Render the time-tracker button + popup. Requires wrapping the app in `<TimeTrackerProvider>`. */
  showTimeTracker?: boolean;
  /** Render the "Mingo AI" launcher button (drawer-style trigger for an
   *  in-layout `AppLayoutDrawer` hosting the chat panel). Defaults to off. */
  showMingoAI?: boolean;
  /** Click handler for the Mingo AI button — typically toggles the drawer. */
  onMingoAI?: () => void;
  /** Whether the Mingo drawer is currently open (visually pressed state). */
  isMingoAIActive?: boolean;
  // User block
  showUser?: boolean;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string | null;
  onProfile?: () => void;
  onLogout?: () => void;
  className?: string;
  /** Whether the mobile menu is open */
  isMobileMenuOpen: boolean;
  /** Callback to toggle mobile menu */
  onToggleMobileMenu?: () => void;
  /**
   * When true, all header controls are disabled and visually dimmed
   * EXCEPT the mobile burger menu toggle, which remains interactive.
   */
  disabled?: boolean;
  /**
   * Draw placeholder cells instead of the live controls.
   *
   * Solves a problem this header cannot solve on its own: its mobile/desktop split
   * is decided by `useMdUp()`, which answers `undefined` until an effect has run —
   * and `?? false` turns that into "mobile". The first render is therefore always
   * the phone header (burger + wordmark, no side actions), which on a desktop load
   * is a visible flash before the real layout appears. It is also what a host has
   * to show while the user and the action flags are still loading.
   *
   * The placeholder decides mobile vs desktop in CSS instead, so it is correct at
   * every width on the very first paint, server-rendered included.
   */
  loading?: boolean;
  /**
   * Shape of the trailing action cells `loading` reserves.
   *
   * Needed because the `show*` props are usually the very thing the host is still
   * waiting on — they are typically driven by feature flags or permissions, so during
   * `loading` they all read `false` and the placeholder collapses to whatever is
   * hardcoded on (often just the avatar), which looks nothing like the loaded header.
   *
   * Pass the cells the header settles on, in order — see `HeaderLoadingCell` for the
   * footprints. A bare number is accepted as shorthand for all-`'icon'`.
   *
   * Unlike the sidebar's rows, a cell that turns out not to exist is cheap here: the
   * cells are a right-aligned cluster in otherwise empty space, so one disappearing
   * shifts nothing else on the page.
   *
   * Defaults to the shape implied by the `show*` props, which is right for a host whose
   * header composition is known up front.
   */
  loadingActionCells?: number | ReadonlyArray<HeaderLoadingCell>;
}

/**
 * A trailing header cell's footprint while loading — see `loadingActionCells`.
 *
 * The breakpoint-scoped members exist because several live cells are themselves
 * responsive, and a placeholder that ignores that is wider than the header it hands
 * off to on exactly the viewports where the cluster is tightest:
 *
 * - `'icon'` — a fixed 48/56px cell at every width (time tracker, notifications).
 * - `'icon-md'` — the same cell, from md only (the avatar: `isMdUp && showUser`).
 * - `'icon-lg'` — the same cell, from lg only (the organization filter, which the
 *   live header renders `hidden lg:flex`).
 * - `'wide'` — the Mingo launcher: a 48px square below md, where the live button is
 *   `iconOnly`, and the fixed 140px labelled cell from md.
 */
export type HeaderLoadingCell = 'icon' | 'icon-md' | 'icon-lg' | 'wide';

export const AppHeader = React.memo(function AppHeader({
  showSearch,
  onSearch,
  showOrganizations,
  organizations = [],
  selectedOrgId,
  onOrgChange,
  showNotifications,
  unreadCount = 0,
  showTicketAlerts = false,
  ticketAlertsHref,
  onTicketAlerts,
  showTimeTracker = false,
  showMingoAI = false,
  onMingoAI,
  isMingoAIActive = false,
  showUser,
  userName,
  userEmail,
  userAvatarUrl,
  onProfile,
  onLogout,
  className,
  isMobileMenuOpen,
  onToggleMobileMenu,
  disabled = false,
  loading = false,
  loadingActionCells,
}: AppHeaderProps) {
  const isMdUp = useMdUp() ?? false;

  // After the only hook above, so the hook order is identical in both branches.
  if (loading) {
    return (
      <AppHeaderSkeleton
        showSearch={showSearch}
        actionCells={
          loadingActionCells ??
          // Fallback: what the `show*` props imply, in the order the live cells are
          // mounted below. Only correct for a host that knows its header composition
          // before it starts loading. The cell types carry each control's own
          // breakpoint — the organization filter is `hidden lg:flex`, the avatar is
          // gated on `isMdUp`, and Mingo is `iconOnly` below md.
          ([
            showOrganizations && 'icon-lg',
            showTimeTracker && 'icon',
            showNotifications && 'icon',
            showTicketAlerts && 'icon',
            showUser && 'icon-md',
            showMingoAI && 'wide',
          ].filter(Boolean) as HeaderLoadingCell[])
        }
        className={className}
      />
    );
  }

  const dimmedClass = disabled ? 'pointer-events-none opacity-50' : '';
  // Cells carry their own dividers in the unified TopNavigation model
  // (the shell no longer applies divide-x).
  const cellDivider = 'border-l border-ods-border';

  return (
    <TopNavigation
      className={cn('sticky top-0 z-40', className)}
      centerBreakpoint="md"
      leading={
        // Mobile: Burger Menu Button
        !isMdUp && (
          <HeaderButton
            onClick={onToggleMobileMenu}
            isActive={isMobileMenuOpen}
            icon={isMobileMenuOpen ? <XmarkIcon className="w-6 h-6" /> : <Menu01Icon className="w-6 h-6" />}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            className="border-r border-ods-border"
          />
        )
      }
      logo={
        !isMdUp && (
          <>
            <OpenFrameLogo
              className="w-6 h-6 shrink-0"
              upperPathColor="var(--color-text-primary)"
              lowerPathColor="var(--color-accent-primary)"
            />
            <OpenFrameText textColor="var(--color-text-primary)" className="h-4" />
          </>
        )
      }
      logoClassName="gap-2"
      center={showSearch ? <HeaderGlobalSearch onSubmit={onSearch} className={cn('w-full', dimmedClass)} /> : undefined}
      sideActions={
        <>
          {/* Mobile: Search button */}
          {showSearch && (
            <HeaderButton
              icon={<SearchIcon className="w-6 h-6" />}
              aria-label="Search"
              className={cn('md:hidden', cellDivider, dimmedClass)}
              disabled={disabled}
            />
          )}

          {/* Desktop: Organizations filter (carries its own border-l) */}
          {showOrganizations && (
            <HeaderOrganizationFilter
              organizations={organizations}
              selectedOrgId={selectedOrgId}
              onOrgChange={onOrgChange}
              className={cn('hidden lg:flex', dimmedClass)}
            />
          )}

          {/* Time tracker button */}
          {showTimeTracker && <TimeTrackerHeaderButton disabled={disabled} className={cn(cellDivider, dimmedClass)} />}

          {/* Notifications button */}
          {showNotifications && (
            <NotificationsHeaderButton
              fallbackUnreadCount={unreadCount}
              disabled={disabled}
              dimmedClass={cn(cellDivider, dimmedClass)}
            />
          )}

          {/* Support-ticket alerts (Help Center) — renders nothing when
              no <TicketLiveProvider> is mounted. */}
          {showTicketAlerts && (
            <TicketAlertsButton
              href={ticketAlertsHref}
              onClick={onTicketAlerts}
              disabled={disabled}
              className={cn(cellDivider, dimmedClass)}
            />
          )}

          {isMdUp && showUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <HeaderButton
                  icon={
                    <SquareAvatar
                      src={userAvatarUrl || undefined}
                      alt={userName || 'User'}
                      size="sm"
                      variant="round"
                      className="shrink-0 w-8 h-8 md:w-10 md:h-10"
                    />
                  }
                  aria-label="User"
                  disabled={disabled}
                  className={cn(
                    'outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
                    cellDivider,
                    dimmedClass,
                  )}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                // z-[104] — above the in-layout AppLayoutDrawer panel (z-[103]) so the
                // user menu stays clickable while the Mingo AI drawer is open
                className="w-[280px] p-0 bg-ods-bg border-ods-border rounded-[6px] overflow-hidden z-[104]"
              >
                {/* User info header section */}
                <div className="bg-ods-card border-b border-ods-border p-3 flex items-center gap-2">
                  <SquareAvatar
                    src={userAvatarUrl || undefined}
                    alt={userName || 'User'}
                    size="sm"
                    variant="round"
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {userName && <div className="text-h4 text-ods-text-primary truncate">{userName}</div>}
                    {userEmail && <div className="text-h6 text-ods-text-secondary truncate">{userEmail}</div>}
                  </div>
                </div>

                {/* Menu items */}
                <DropdownMenuItem
                  onClick={onProfile}
                  className="bg-ods-card border-b border-ods-border rounded-none px-3 py-3 hover:bg-ods-card/80 focus:bg-ods-card/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-6 w-6 text-ods-text-primary shrink-0" />
                    <span className="text-h4 text-ods-text-primary">Profile Settings</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onLogout}
                  className="bg-ods-card rounded-none px-3 py-3 hover:bg-ods-card/80 focus:bg-ods-card/80 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <LogOutIcon className="text-ods-error shrink-0" size={24} />
                    <span className="text-h4 text-ods-text-primary">Log Out</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mingo AI launcher — anchored at the very end of the header. On mobile
          it collapses to an icon-only affordance (no "Mingo AI" wordmark). */}
          {showMingoAI && (
            <HeaderMingoButton
              onClick={onMingoAI}
              isActive={isMingoAIActive}
              iconOnly={!isMdUp}
              disabled={disabled || !onMingoAI}
              className={cn(cellDivider, dimmedClass)}
            />
          )}
        </>
      }
    />
  );
});

interface NotificationsHeaderButtonProps {
  fallbackUnreadCount: number;
  disabled: boolean;
  dimmedClass: string;
}

function NotificationsHeaderButton({ fallbackUnreadCount, disabled, dimmedClass }: NotificationsHeaderButtonProps) {
  const ctx = useOptionalNotifications();
  const hasUnread = (ctx?.unreadCount ?? fallbackUnreadCount) > 0;
  const isActive = ctx?.isOpen ?? false;
  const onClick = ctx?.toggle;

  return (
    <HeaderButton
      icon={isActive ? <XmarkIcon className="w-6 h-6" /> : <BellIcon className="w-6 h-6" />}
      // Shared dot primitive on the cell — same markup every indicator
      // cell renders (see HeaderButton.showUnreadDot / <UnreadDot>).
      showUnreadDot={!isActive && hasUnread}
      aria-label={isActive ? 'Close notifications' : 'Notifications'}
      onClick={onClick}
      isActive={isActive}
      disabled={disabled || !onClick}
      className={dimmedClass}
    />
  );
}

export default AppHeader;

// Literal class strings — Tailwind's scanner needs to see them spelled out.
const CELL_VISIBILITY: Record<Exclude<HeaderLoadingCell, 'wide'>, string | undefined> = {
  icon: undefined,
  'icon-md': 'hidden md:flex',
  'icon-lg': 'hidden lg:flex',
};

/** One trailing action cell placeholder — mirrors the live cells' 48/56px box. */
function HeaderCellSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full w-14 shrink-0 items-center justify-center border-l border-ods-border',
        className,
      )}
    >
      <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
    </div>
  );
}

/**
 * Wide cell placeholder — mirrors `HeaderMingoButton` at both widths, which are
 * two different shapes: the live button gets `iconOnly={!isMdUp}`, so below md it
 * drops its wordmark and collapses to the same 48px square as any other cell, and
 * from md it is the fixed 140px labelled cell. Reserving 140px-worth of icon,
 * label, gap and padding on a phone would make the placeholder cluster ~70px
 * wider than the header it hands off to.
 */
function HeaderWideCellSkeleton() {
  return (
    <div className="flex h-full w-14 shrink-0 items-center justify-center gap-2 border-l border-ods-border md:w-[140px] md:px-4">
      <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-ods-border" />
      <div className="hidden h-5 animate-pulse rounded bg-ods-border md:block md:w-[72px]" />
    </div>
  );
}

/**
 * `AppHeader`'s loading state — see `AppHeaderProps.loading`.
 *
 * Keep in sync with `AppHeader` above; a diverging placeholder makes the handoff
 * jump. Every breakpoint decision here is a Tailwind variant on purpose: this is the
 * one thing the live header cannot do (its split runs through `useMdUp()`), and it
 * is the whole reason this branch exists.
 */
function AppHeaderSkeleton({
  showSearch,
  actionCells,
  className,
}: {
  showSearch?: boolean;
  actionCells: number | ReadonlyArray<HeaderLoadingCell>;
  className?: string;
}) {
  const cells: ReadonlyArray<HeaderLoadingCell> =
    typeof actionCells === 'number'
      ? Array.from({ length: Math.max(0, actionCells) }, () => 'icon' as const)
      : actionCells;
  return (
    <TopNavigation
      className={cn('sticky top-0 z-40', className)}
      centerBreakpoint="md"
      aria-busy="true"
      leading={
        // Burger cell: mobile only, in CSS.
        <div className="flex h-full w-14 shrink-0 items-center justify-center border-r border-ods-border md:hidden">
          <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
        </div>
      }
      logo={
        <>
          <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-ods-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-ods-border" />
        </>
      }
      // `md:hidden` belongs on the WRAPPER, not the placeholder inside it:
      // `TopNavigation` builds its padded logo zone whenever `logo` is truthy, and
      // that padding runs to 24px at md and 80px at lg. The live header passes
      // `false` here from md up, so the zone does not exist at all — leaving the
      // wrapper visible would inset the search field by 80px on desktop and shift
      // it back on handoff, which is the exact jump this branch removes.
      logoClassName="gap-2 md:hidden"
      // `TopNavigation` already hides the center zone below `centerBreakpoint`.
      center={showSearch ? <div className="h-10 w-full animate-pulse rounded-md bg-ods-border" /> : undefined}
      sideActions={
        <>
          {/* Mobile-only search trigger; from md the search lives in the center zone. */}
          {showSearch && <HeaderCellSkeleton className="md:hidden" />}
          {cells.map((cell, i) =>
            cell === 'wide' ? (
              <HeaderWideCellSkeleton key={i} />
            ) : (
              <HeaderCellSkeleton key={i} className={CELL_VISIBILITY[cell]} />
            ),
          )}
        </>
      }
    />
  );
}
