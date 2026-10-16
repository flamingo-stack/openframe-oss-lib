'use client';

import { cloneElement, isValidElement, useId, useState, type MouseEvent, type ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import type { NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { NavigationItemBadge } from './navigation-item-badge';
import { UnreadDot } from './unread-dot';

/*
 * The grouped variant (`NavigationSidebarConfig.variant: 'grouped'`), drawn from
 * the Figma `navigation-sidebar` component set: 44px rows, 20px icons, a group
 * that opens into a bordered card with 16px child icons on a connector line, and
 * an active pill that covers only a child's label.
 *
 * Expanded vs. collapsed is read off the RAIL'S WIDTH (`@[140px]/of-nav-sidebar:`,
 * the container `navigation-sidebar.tsx` declares), not off `minimized`. Unlike
 * the flat rows, which fade a `flex-1` label that a 56px rail leaves no room
 * for, these rows change geometry between the two states — a centred 40px cell
 * vs. an 8px inset — and a JS flag cannot be right on the first paint (before
 * hydration it can only carry the server's answer). The width can. Collapsed is
 * the default because container queries are min-width; the burger menu declares
 * the same container at its full width, so it always gets the expanded rows.
 *
 * `showLabel` is still taken, for the one thing CSS cannot carry: the rail's
 * `title` tooltip.
 */

interface IconProps {
  size?: number;
  color?: string;
}

/** The host's icon at the row's size, coloured by the row (`currentColor`). */
function sizedIcon(icon: ReactNode, size: number): ReactNode {
  return isValidElement<IconProps>(icon) ? cloneElement(icon, { size, color: 'currentColor' }) : icon;
}

function accessibleName(item: NavigationSidebarItem): string {
  return item.badge ? `${item.label} (${item.badge})` : item.label;
}

/**
 * Which group is open. One at a time: the group holding the current page,
 * re-derived whenever that changes (a navigation into another group closes this
 * one and opens that one; leaving every group closes them all). Between route
 * changes the user's own folds and opens hold.
 *
 * Adjusted while rendering — React's pattern for a reset driven by a value the
 * render already has — so the commit that lights the new page is the same one
 * that opens its group.
 */
export function useOpenNavigationGroup(activeGroupId: string | null) {
  const [openGroupId, setOpenGroupId] = useState(activeGroupId);
  const [openFor, setOpenFor] = useState(activeGroupId);
  if (openFor !== activeGroupId) {
    setOpenFor(activeGroupId);
    setOpenGroupId(activeGroupId);
  }
  return [openGroupId, setOpenGroupId] as const;
}

/**
 * The active pill. Figma paints it `yellow sec` #614c12, which has no ODS token;
 * `accent-secondary` is the nearest semantic one — swap it here once design
 * names the token.
 */
const ACTIVE_PILL = 'bg-ods-accent-secondary text-ods-accent';

const ROW_HOVER_LAYER =
  "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-ods-bg-hover after:opacity-0 after:transition-opacity after:duration-150 after:content-['']";

interface RowStateProps {
  showLabel: boolean;
  disabled: boolean;
}

function RowLabel({ item }: { item: NavigationSidebarItem }) {
  const unreadCount = item.unreadCount ?? 0;
  return (
    <>
      <span className="ml-[var(--spacing-system-xsf)] hidden min-w-0 flex-1 items-center @[140px]/of-nav-sidebar:flex">
        <span className="min-w-0 truncate text-h4">{item.label}</span>
        {item.badge && <NavigationItemBadge label={item.badge} className="ml-[var(--spacing-system-xs)] shrink-0" />}
      </span>
      {unreadCount > 0 && (
        <span className="ml-[var(--spacing-system-xs)] hidden size-6 flex-shrink-0 items-center justify-center rounded-md bg-ods-accent p-2 @[140px]/of-nav-sidebar:flex">
          <span className="text-ods-text-on-accent text-h5">{unreadCount > 99 ? '99+' : unreadCount}</span>
        </span>
      )}
    </>
  );
}

function RowIcon({ item, size, className }: { item: NavigationSidebarItem; size: 16 | 20; className?: string }) {
  return (
    <span
      className={cn('relative flex shrink-0 items-center justify-center', size === 20 ? 'size-5' : 'size-4', className)}
    >
      {sizedIcon(item.icon, size)}
      {(item.unreadCount ?? 0) > 0 && <UnreadDot size="fixed" className="@[140px]/of-nav-sidebar:hidden" />}
    </span>
  );
}

/** The 44px row geometry shared by a top-level entry and a group's parent. */
const ROW_CLASSES = cn(
  'relative isolate flex h-11 w-full items-center justify-center rounded-md px-0 text-left',
  '@[140px]/of-nav-sidebar:justify-start @[140px]/of-nav-sidebar:px-[var(--spacing-system-xsf)]',
  ROW_HOVER_LAYER,
);

/** An entry without children: a link (or a button for `onClick` / disabled). */
function GroupedLeafRow({
  item,
  isActive,
  isPending,
  showLabel,
  disabled,
  onClick,
}: RowStateProps & {
  item: NavigationSidebarItem;
  isActive: boolean;
  isPending: boolean;
  onClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
}) {
  const name = accessibleName(item);
  const className = cn(
    ROW_CLASSES,
    !disabled && !isActive && 'text-ods-text-primary hover:after:opacity-100',
    !disabled && !isActive && isPending && 'after:opacity-100',
    // The pill is a statement of fact, so it switches in one frame rather than
    // fading — see the hover-layer note in `navigation-sidebar-item.tsx`.
    !disabled && isActive && ACTIVE_PILL,
    disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
  );
  const content = (
    <>
      <RowIcon
        item={item}
        size={20}
        className={isActive && !disabled ? 'text-ods-accent' : 'text-ods-text-secondary'}
      />
      <RowLabel item={item} />
    </>
  );
  const shared = {
    className,
    title: showLabel ? undefined : name,
    'aria-label': name,
    'aria-current': isActive ? ('page' as const) : undefined,
  };
  if (disabled || !item.path || item.onClick) {
    return (
      <button type="button" onClick={event => onClick(item, event)} disabled={disabled} {...shared}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.path} onClick={event => onClick(item, event)} {...shared}>
      {content}
    </Link>
  );
}

/**
 * One child of an open group: a 20px column holding the 16px icon between two
 * connector segments, then the label. The active pill covers the label only;
 * in the rail, where there is no label, the active child is its accent icon.
 */
function GroupedChildRow({
  item,
  isActive,
  isPending,
  showLabel,
  disabled,
  onClick,
}: RowStateProps & {
  item: NavigationSidebarItem;
  isActive: boolean;
  isPending: boolean;
  onClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
}) {
  const name = accessibleName(item);
  const lit = isActive && !disabled;
  const className = cn(
    'group/nav-child relative flex h-11 w-full items-stretch justify-center text-left',
    '@[140px]/of-nav-sidebar:justify-start @[140px]/of-nav-sidebar:gap-[var(--spacing-system-xxs)]',
    disabled && 'cursor-not-allowed opacity-50',
  );
  const content = (
    <>
      <span className="flex w-5 shrink-0 flex-col items-center" aria-hidden="true">
        <span className="h-2.5 w-px shrink-0 bg-ods-border" />
        <RowIcon
          item={item}
          size={16}
          className={cn(
            'my-[var(--spacing-system-xxs)]',
            lit ? 'text-ods-accent' : 'text-ods-text-secondary',
            !lit && !disabled && 'group-hover/nav-child:text-ods-text-primary',
          )}
        />
        <span className="h-2.5 w-px shrink-0 bg-ods-border" />
      </span>
      <span
        className={cn(
          'hidden min-w-0 flex-1 items-center rounded-md px-[var(--spacing-system-xsf)] @[140px]/of-nav-sidebar:flex',
          lit && ACTIVE_PILL,
          !lit &&
            (disabled ? 'text-ods-text-secondary' : 'text-ods-text-primary group-hover/nav-child:bg-ods-bg-hover'),
          !lit && !disabled && isPending && 'bg-ods-bg-hover',
        )}
      >
        <span className="min-w-0 truncate text-h4">{item.label}</span>
        {item.badge && <NavigationItemBadge label={item.badge} className="ml-[var(--spacing-system-xs)] shrink-0" />}
        {(item.unreadCount ?? 0) > 0 && (
          <span className="ml-auto flex size-6 flex-shrink-0 items-center justify-center rounded-md bg-ods-accent p-2">
            <span className="text-ods-text-on-accent text-h5">
              {(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}
            </span>
          </span>
        )}
      </span>
    </>
  );
  const shared = {
    className,
    title: showLabel ? undefined : name,
    'aria-label': name,
    'aria-current': isActive ? ('page' as const) : undefined,
  };
  if (disabled || !item.path || item.onClick) {
    return (
      <button type="button" onClick={event => onClick(item, event)} disabled={disabled} {...shared}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.path} onClick={event => onClick(item, event)} {...shared}>
      {content}
    </Link>
  );
}

/**
 * A parent and, while open, its card. The parent row stays the wrapper's first
 * child in both states, so opening a group re-styles the button rather than
 * remounting it — keyboard focus stays on the parent the user just toggled.
 */
function GroupedGroup({
  item,
  isOpen,
  activeId,
  pendingId,
  showLabel,
  disabled,
  onItemClick,
  onGroupClick,
}: RowStateProps & {
  item: NavigationSidebarItem;
  isOpen: boolean;
  activeId: string | null;
  pendingId: string | null;
  onItemClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
  onGroupClick: (item: NavigationSidebarItem) => void;
}) {
  const groupDomId = `${useId()}-group`;
  const name = accessibleName(item);
  const children = item.children ?? [];
  return (
    <div className={cn(isOpen && 'rounded-md border border-ods-border bg-ods-bg')}>
      <button
        type="button"
        onClick={() => onGroupClick(item)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={isOpen ? groupDomId : undefined}
        aria-label={name}
        title={showLabel ? undefined : name}
        className={cn(
          ROW_CLASSES,
          // The open group's parent is accent with no background, whether or
          // not one of its children is the current page.
          !disabled && (isOpen ? 'text-ods-accent' : 'text-ods-text-primary'),
          !disabled && 'hover:after:opacity-100',
          disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
        )}
      >
        <RowIcon
          item={item}
          size={20}
          className={isOpen && !disabled ? 'text-ods-accent' : 'text-ods-text-secondary'}
        />
        <RowLabel item={item} />
      </button>
      {isOpen && (
        <div
          id={groupDomId}
          role="group"
          aria-label={item.label}
          className="flex flex-col px-[var(--spacing-system-xsf)] pb-[var(--spacing-system-xsf)]"
        >
          {children.map(child => (
            <GroupedChildRow
              key={child.id}
              item={child}
              isActive={child.id === activeId}
              isPending={child.id === pendingId}
              showLabel={showLabel}
              disabled={disabled}
              onClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface NavigationSidebarGroupedEntriesProps {
  items: readonly NavigationSidebarItem[];
  activeId: string | null;
  pendingId: string | null;
  openGroupId: string | null;
  showLabel: boolean;
  disabled: boolean;
  onItemClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
  /** A parent row was clicked; the owner applies the open/fold/navigate rule. */
  onGroupClick: (item: NavigationSidebarItem) => void;
}

/** The entries of one `<nav>` block in the grouped variant (the caller owns the landmark and the gap). */
export function NavigationSidebarGroupedEntries({
  items,
  activeId,
  pendingId,
  openGroupId,
  showLabel,
  disabled,
  onItemClick,
  onGroupClick,
}: NavigationSidebarGroupedEntriesProps) {
  return (
    <>
      {items.map(item =>
        (item.children?.length ?? 0) > 0 ? (
          <GroupedGroup
            key={item.id}
            item={item}
            isOpen={item.id === openGroupId}
            activeId={activeId}
            pendingId={pendingId}
            showLabel={showLabel}
            disabled={disabled}
            onItemClick={onItemClick}
            onGroupClick={onGroupClick}
          />
        ) : (
          <GroupedLeafRow
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            isPending={item.id === pendingId}
            showLabel={showLabel}
            disabled={disabled}
            onClick={onItemClick}
          />
        ),
      )}
    </>
  );
}

export interface NavigationSidebarActionRowProps {
  icon: ReactNode;
  label: string;
  /** A link (prefetch, open in a new tab); without it the row is a button. */
  href?: string;
  /** Runs on click, before a link's own navigation (e.g. to close a menu). */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** The page the row leads to is open: the active pill and, on a link, `aria-current="page"`. */
  active?: boolean;
  /** A count pill after the label (capped at "99+"); a dot on the icon in the rail. 0 = none. */
  count?: number;
  /** `'outline'`: a bordered row with an accent icon — an action rather than a place ("New chat"). */
  variant?: 'default' | 'outline';
  disabled?: boolean;
  /** The sidebar's `minimized` (from the slot's render function): the rail's tooltip. The geometry follows the rail's width on its own. */
  minimized?: boolean;
  /** Accessible name. Default: the label, with the count — "Needs approval (3)". */
  'aria-label'?: string;
  className?: string;
}

/**
 * A row for a grouped sidebar's slots (`topSlot`): the nav entry's geometry —
 * 44px with an 8px inset, a centred 40px cell in the rail — its active pill and
 * count pill, for what is not a nav entry: an action ("New chat",
 * `variant="outline"`) or a host-owned destination with its own count ("Needs
 * approval"). Renders in the mobile burger menu too, expanded.
 */
export function NavigationSidebarActionRow({
  icon,
  label,
  href,
  onClick,
  active = false,
  count = 0,
  variant = 'default',
  disabled = false,
  minimized = false,
  'aria-label': ariaLabel,
  className,
}: NavigationSidebarActionRowProps) {
  // The nav row's own parts, fed a stand-in entry: one geometry, one pill.
  const entry: NavigationSidebarItem = { id: 'action', label, icon, unreadCount: count };
  const lit = active && !disabled;
  const outline = variant === 'outline';
  const name = ariaLabel ?? (count > 0 ? `${label} (${count > 99 ? '99+' : count})` : label);
  const classes = cn(
    ROW_CLASSES,
    outline && 'border border-ods-border',
    !disabled && !lit && 'text-ods-text-primary hover:after:opacity-100',
    lit && ACTIVE_PILL,
    disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
    className,
  );
  const content = (
    <>
      <RowIcon
        item={entry}
        size={20}
        className={lit || (outline && !disabled) ? 'text-ods-accent' : 'text-ods-text-secondary'}
      />
      <RowLabel item={entry} />
    </>
  );
  const shared = { className: classes, title: minimized ? name : undefined, 'aria-label': name };
  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} aria-current={lit ? 'page' : undefined} {...shared}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...shared}>
      {content}
    </button>
  );
}

/** A placeholder row in the grouped geometry, for `NavigationSidebarConfig.loading`. */
export function NavigationSidebarGroupedSkeleton() {
  return (
    <div
      className="flex h-11 w-full items-center justify-center @[140px]/of-nav-sidebar:justify-start @[140px]/of-nav-sidebar:px-[var(--spacing-system-xsf)]"
      aria-hidden="true"
    >
      <UnifiedSkeleton className="size-5 shrink-0 rounded" />
      <UnifiedSkeleton className="ml-[var(--spacing-system-xsf)] hidden h-4 flex-1 rounded @[140px]/of-nav-sidebar:block" />
    </div>
  );
}
