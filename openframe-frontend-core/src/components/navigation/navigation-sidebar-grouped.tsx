'use client';

import { cloneElement, isValidElement, type MouseEvent, type ReactNode, useId, useState } from 'react';
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
 * the container `navigation-sidebar.tsx` declares), not off `minimized`: the
 * labels fade and the inset glides as the width crosses 140px, and a JS flag
 * cannot be right on the first paint (before hydration it can only carry the
 * server's answer). The width can. Collapsed is the default because container
 * queries are min-width; the burger menu declares the same container at its
 * full width, so it always gets the expanded rows.
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
 * the palette's `accent-secondary` stands in (design: no new colours, palette only).
 */
const ACTIVE_PILL = 'bg-ods-accent-secondary text-ods-accent';

/**
 * An open group's parent row, flush inside its card: the card's 6px less its 1px border,
 * so the hover and the focus ring run parallel to the border instead of a rounder curve.
 */
const CARD_INNER_RADIUS = 'rounded-[calc(var(--radius)-3px)] after:rounded-[calc(var(--radius)-3px)]';

/** The motion curve of the grouped sidebar: quick off the mark, a long soft landing. */
const EASE = '[transition-timing-function:cubic-bezier(0.2,0,0,1)]';

/**
 * The hover wash — the design system's `bg-hover`, a press its `bg-active` — on
 * its own `::after` layer so the active pill never fades (see the hover-layer
 * note in `navigation-sidebar-item.tsx`). Quick to answer the cursor, slower to
 * let it go.
 */
const HOVER_LAYER = cn(
  "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:content-['']",
  'after:bg-ods-bg-hover after:opacity-0 after:transition-opacity after:duration-200 after:ease-out',
  'hover:after:duration-75 active:after:bg-ods-bg-active',
  'motion-reduce:after:transition-none',
);

/** Keyboard focus, drawn inside the row so the card and the scroller do not clip it. */
const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus';

/**
 * The 44px row geometry shared by a top-level entry, a group's parent and an
 * action row. The icon never moves while the rail widens or narrows: 8px in at
 * both widths (2px left of the centre of the rail's 40px cell); only the right
 * inset comes and goes. A row that re-centred its icon (`justify-center` in the
 * rail) moved it ~50px in the frame the width crossed 140px, mid-toggle, and one
 * that centred it with a wider inset nudged every icon sideways on each toggle.
 */
const ROW_CLASSES = cn(
  'relative isolate flex h-11 w-full items-center overflow-hidden rounded-md text-left',
  'pl-[var(--spacing-system-xsf)] pr-0 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]',
  'transition-[padding] duration-300 motion-reduce:transition-none',
  EASE,
  FOCUS_RING,
  HOVER_LAYER,
);

/**
 * The idle icon brightens with its row's hover. Lit icons get no transition, so
 * the accent arrives in the commit that makes the row the page, like the pill.
 */
const idleIcon = (group: 'row' | 'child') =>
  cn(
    'text-ods-text-secondary transition-colors duration-150',
    group === 'row' ? 'group-hover/nav-row:text-ods-text-primary' : 'group-hover/nav-child:text-ods-text-primary',
  );

/**
 * What only the expanded sidebar shows (labels, stamps, counts). In the rail it
 * is still there, zero-wide and transparent, so crossing 140px fades it rather
 * than popping it in or out.
 */
const EXPANDED_ONLY =
  'opacity-0 transition-opacity duration-150 @[140px]/of-nav-sidebar:opacity-100 motion-reduce:transition-none';

interface RowStateProps {
  showLabel: boolean;
  disabled: boolean;
}

/** The count pill: 24px, widening for "99+". */
function CountPill({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xxs)]',
        className,
      )}
    >
      <span className="text-ods-text-on-accent text-h5">{count > 99 ? '99+' : count}</span>
    </span>
  );
}

/** The row's end, flush right where every row's count sits. */
function RowEnd({ count }: { count: number }) {
  return count > 0 ? <CountPill count={count} className="ml-auto" /> : null;
}

function RowLabel({ item }: { item: NavigationSidebarItem }) {
  const unreadCount = item.unreadCount ?? 0;
  return (
    <span
      className={cn(
        'ml-[var(--spacing-system-xsf)] flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] overflow-hidden',
        EXPANDED_ONLY,
      )}
    >
      <span className="min-w-0 truncate text-h4">{item.label}</span>
      {item.badge && <NavigationItemBadge label={item.badge} compact />}
      <RowEnd count={unreadCount} />
    </span>
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
  const lit = isActive && !disabled;
  const className = cn(
    'group/nav-row',
    ROW_CLASSES,
    !disabled && !isActive && 'text-ods-text-primary hover:after:opacity-100',
    !disabled && !isActive && isPending && 'after:opacity-100',
    lit && ACTIVE_PILL,
    disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
  );
  const content = (
    <>
      <RowIcon item={item} size={20} className={lit ? 'text-ods-accent' : idleIcon('row')} />
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
 * The hover wash is the pill's shape, lit by the whole row.
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
    // The icon column flush, under the parent's icon at both widths.
    'group/nav-child relative flex h-11 w-full items-stretch gap-[var(--spacing-system-xxs)] rounded-md text-left',
    FOCUS_RING,
    disabled && 'cursor-not-allowed opacity-50',
  );
  const content = (
    <>
      <span className="flex w-5 shrink-0 flex-col items-center" aria-hidden="true">
        <span className="h-2.5 w-px shrink-0 bg-ods-border" />
        <RowIcon
          item={item}
          size={16}
          className={cn('my-[var(--spacing-system-xxs)]', lit ? 'text-ods-accent' : idleIcon('child'))}
        />
        <span className="h-2.5 w-px shrink-0 bg-ods-border" />
      </span>
      <span
        className={cn(
          'relative isolate flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] overflow-hidden rounded-md px-[var(--spacing-system-xsf)]',
          EXPANDED_ONLY,
          HOVER_LAYER,
          lit && ACTIVE_PILL,
          !lit &&
            (disabled ? 'text-ods-text-secondary' : 'text-ods-text-primary group-hover/nav-child:after:opacity-100'),
          !lit && !disabled && isPending && 'after:opacity-100',
        )}
      >
        <span className="min-w-0 truncate text-h4">{item.label}</span>
        {item.badge && <NavigationItemBadge label={item.badge} compact />}
        <RowEnd count={item.unreadCount ?? 0} />
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
 * A parent and its card. The parent row stays the wrapper's first child in
 * both states, so opening a group re-styles the button rather than remounting
 * it — keyboard focus stays on the parent the user just toggled.
 *
 * The children stay mounted so the card can open and fold as a motion: the
 * grid row eases between `0fr` and `1fr` (the design system's collapse, see
 * `AnnouncementBar`), the rows fade and settle, the card's border and ground
 * fade in. A folded group is `inert` and, once folded, `invisible`: out of the
 * tab order and the accessibility tree, as an unmounted one was.
 *
 * The border is transparent while folded, and the `-m-px` hands its pixel back,
 * so a folded group's row sits exactly where a leaf row does.
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
  const lit = isOpen && !disabled;
  return (
    <div
      className={cn(
        '-m-px rounded-md border transition-[border-color,background-color] duration-300 motion-reduce:transition-none',
        EASE,
        isOpen ? 'border-ods-border bg-ods-bg' : 'border-transparent',
      )}
    >
      <button
        type="button"
        onClick={() => onGroupClick(item)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={groupDomId}
        aria-label={name}
        title={showLabel ? undefined : name}
        className={cn(
          'group/nav-row',
          ROW_CLASSES,
          // The open group's parent is accent with no background, whether or
          // not one of its children is the current page.
          !disabled && (isOpen ? 'text-ods-accent' : 'text-ods-text-primary'),
          !disabled && 'hover:after:opacity-100',
          isOpen && CARD_INNER_RADIUS,
          disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
        )}
      >
        <RowIcon item={item} size={20} className={lit ? 'text-ods-accent' : idleIcon('row')} />
        <RowLabel item={item} />
      </button>
      <div
        id={groupDomId}
        role="group"
        aria-label={item.label}
        inert={!isOpen}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 motion-reduce:transition-none',
          EASE,
          isOpen ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              'flex flex-col px-[var(--spacing-system-xsf)] pb-[var(--spacing-system-xsf)]',
              'transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              EASE,
              isOpen ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
            )}
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
        </div>
      </div>
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
 * 44px with an 8px inset, the icon centred in the rail — its hover, active pill
 * and count pill, for what is not a nav entry: an action ("New chat",
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
    'group/nav-row',
    ROW_CLASSES,
    outline && 'border border-ods-border',
    !disabled && !lit && 'text-ods-text-primary hover:after:opacity-100',
    lit && ACTIVE_PILL,
    disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
    className,
  );
  const content = (
    <>
      <RowIcon item={entry} size={20} className={lit || (outline && !disabled) ? 'text-ods-accent' : idleIcon('row')} />
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
      className="flex h-11 w-full items-center overflow-hidden pl-[var(--spacing-system-xsf)] @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]"
      aria-hidden="true"
    >
      <UnifiedSkeleton className="size-5 shrink-0 rounded" />
      {/* The label's fade rides a wrapper, not the bar: its `duration-*` also sets
          `animation-duration` (tailwindcss-animate), which would run the bar's pulse
          at the fade's 150ms while the icon beside it keeps the shared one. */}
      <div className={cn('ml-[var(--spacing-system-xsf)] min-w-0 flex-1', EXPANDED_ONLY)}>
        <UnifiedSkeleton className="h-4 w-full rounded" />
      </div>
    </div>
  );
}
