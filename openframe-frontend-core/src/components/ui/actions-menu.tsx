'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { Check } from 'lucide-react';
import React, { useCallback } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { Chevron02RightIcon, Ellipsis01Icon } from '../icons-v2-generated';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { useReportOverlayOpen } from './overlay-open-registry';
import { COLLISION_PADDING_PX, useCollisionBoundary, usePortalContainer } from './portal-container';

/** Trigger movement (px) that counts as "the user scrolled away" rather than
 *  touch-momentum jitter or the sub-pixel settle right after opening. */
const SCROLL_DISMISS_THRESHOLD_PX = 12;

export interface ActionsMenuItemIconAction {
  icon: React.ReactNode;
  'aria-label': string;
  onClick?: () => void;
  href?: string;
  openInNewTab?: boolean;
  disabled?: boolean;
}

export interface ActionsMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'item' | 'checkbox' | 'submenu' | 'separator';
  checked?: boolean;
  /**
   * Keep the dropdown open after this item is clicked instead of closing it
   * (e.g. multi-select add). Only affects ActionsMenuDropdown; `checkbox` and
   * `submenu` items always keep the menu open regardless. Defaults to closing.
   */
  closeOnSelect?: boolean;
  submenu?: ActionsMenuItem[];
  /** Render the row in the error/destructive color (label + icon). */
  danger?: boolean;
  /** Optional URL for navigation items */
  href?: string;
  /** Open the main-row `href` in a new tab (external app deep-links). */
  openInNewTab?: boolean;
  /**
   * Optional secondary action — a 40px-wide button on the right of the row
   * with a vertical divider. The main row keeps its primary click target;
   * the secondary is independently clickable (e.g. "open in new tab").
   */
  iconAction?: ActionsMenuItemIconAction;
}

export interface ActionsMenuGroup {
  id?: string;
  items: ActionsMenuItem[];
  separator?: boolean;
}

export interface ActionsMenuProps {
  groups: ActionsMenuGroup[];
  className?: string;
  onItemClick?: (item: ActionsMenuItem) => void;
  /**
   * Optional node rendered as the menu's first row, above every group — e.g.
   * the mobile "…" menu surfaces the page's view-mode `TabSelector` here (the
   * tickets design). Separated from the rows below by the same border the rows
   * use; interaction stays the node's own — clicking it does not close the
   * menu by itself.
   */
  header?: React.ReactNode;
}

interface MenuItemProps {
  item: ActionsMenuItem;
  onItemClick?: (item: ActionsMenuItem) => void;
}

const ROW_CLASSES =
  'flex flex-1 min-w-0 items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-s)] cursor-pointer transition-colors bg-ods-bg outline-none';
const WRAPPER_CLASSES = 'relative flex items-stretch border-b border-ods-border last:border-b-0';

const SECONDARY_ACTION_CLASSES =
  'flex p-[var(--spacing-system-s)] shrink-0 items-center justify-center self-stretch border-l border-ods-border transition-colors hover:bg-ods-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus [&_svg]:w-4 [&_svg]:h-4 md:[&_svg]:w-6 md:[&_svg]:h-6';

const SecondaryAction: React.FC<{ action: ActionsMenuItemIconAction }> = ({ action }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (action.disabled) {
        e.preventDefault();
        return;
      }
      action.onClick?.();
    },
    [action],
  );

  const classes = cn(
    SECONDARY_ACTION_CLASSES,
    action.openInNewTab && 'max-md:hidden',
    action.disabled && 'pointer-events-none cursor-not-allowed opacity-60',
  );

  if (action.href) {
    return (
      <Link
        href={action.href}
        prefetch={false}
        target={action.openInNewTab ? '_blank' : undefined}
        rel={action.openInNewTab ? 'noopener noreferrer' : undefined}
        aria-label={action['aria-label']}
        aria-disabled={action.disabled || undefined}
        tabIndex={action.disabled ? -1 : undefined}
        className={classes}
        onClick={handleClick}
      >
        {action.icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={action['aria-label']}
      disabled={action.disabled}
      className={classes}
      onClick={handleClick}
    >
      {action.icon}
    </button>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({ item, onItemClick }) => {
  // Submenus below portal + collide against the OWNING surface, matching the
  // root menu (`DropdownMenuContent`). Read unconditionally — hooks first.
  const portalContainer = usePortalContainer();
  const collisionBoundary = useCollisionBoundary();
  const activate = useCallback(() => {
    if (item.disabled) return;
    if (item.type === 'checkbox') {
      item.onClick?.();
      onItemClick?.(item);
      return;
    }
    if (item.type === 'submenu') return;
    item.onClick?.();
    onItemClick?.(item);
  }, [item, onItemClick]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      activate();
    },
    [activate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      activate();
    },
    [activate],
  );

  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (item.disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      item.onClick?.();
      onItemClick?.(item);
    },
    [item, onItemClick],
  );

  if (item.type === 'separator') {
    return <div className="h-1 w-full bg-ods-divider" />;
  }

  const itemClasses = cn(
    ROW_CLASSES,
    item.disabled
      ? 'pointer-events-none cursor-not-allowed text-ods-text-secondary opacity-60'
      : 'text-ods-text-primary hover:bg-ods-bg-hover',
  );

  const subTriggerClasses = cn(itemClasses, 'focus:bg-ods-bg-hover data-[state=open]:bg-ods-bg-active');

  const renderAsLink = !!item.href && item.type !== 'submenu' && item.type !== 'checkbox';

  const rowContent = (
    <>
      {item.icon && (
        <div
          className={cn(
            'flex h-4 w-4 flex-shrink-0 items-center justify-center md:h-6 md:w-6',
            item.danger && 'text-ods-error',
            item.disabled && 'opacity-50',
          )}
        >
          {item.icon}
        </div>
      )}

      <span
        className={cn(
          'flex-1 font-medium leading-6 text-h4',
          item.disabled ? 'text-ods-text-secondary' : item.danger ? 'text-ods-error' : 'text-ods-text-primary',
        )}
      >
        {item.label}
      </span>

      {item.type === 'checkbox' && (
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-md transition-colors md:h-6 md:w-6',
            item.checked ? 'bg-ods-accent' : 'border-2 border-ods-border bg-transparent',
          )}
        >
          {item.checked && <Check className="h-3 w-3 text-ods-text-on-accent md:h-4 md:w-4" strokeWidth={3} />}
        </div>
      )}

      {item.type === 'submenu' && <Chevron02RightIcon className="h-4 w-4 text-ods-text-secondary md:h-6 md:w-6" />}
    </>
  );

  if (renderAsLink && item.href) {
    return (
      <div className={WRAPPER_CLASSES}>
        <Link
          href={item.href}
          prefetch={false}
          target={item.openInNewTab ? '_blank' : undefined}
          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
          className={itemClasses}
          onClick={handleLinkClick}
          aria-disabled={item.disabled}
          tabIndex={item.disabled ? -1 : undefined}
        >
          {rowContent}
        </Link>
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  if (item.type === 'submenu' && item.submenu) {
    return (
      <div className={WRAPPER_CLASSES}>
        <DropdownMenuPrimitive.Sub>
          <DropdownMenuPrimitive.SubTrigger disabled={item.disabled} className={subTriggerClasses}>
            {rowContent}
          </DropdownMenuPrimitive.SubTrigger>
          <DropdownMenuPrimitive.Portal container={portalContainer ?? undefined}>
            <DropdownMenuPrimitive.SubContent
              sideOffset={4}
              // Confine flip/shift (and the available-height this menu sizes
              // itself by) to the owning surface — see `useCollisionBoundary`.
              collisionBoundary={collisionBoundary ?? undefined}
              collisionPadding={collisionBoundary ? COLLISION_PADDING_PX : undefined}
              hideWhenDetached
              className="z-[1500] max-h-[var(--radix-popper-available-height)] min-w-[256px] overflow-y-auto rounded-md border border-ods-border bg-ods-bg p-0 shadow-xl"
            >
              {item.submenu.map((subItem, index) => (
                <MenuItem key={subItem.id || index} item={subItem} onItemClick={onItemClick} />
              ))}
            </DropdownMenuPrimitive.SubContent>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Sub>
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  return (
    <div className={WRAPPER_CLASSES}>
      <div
        role="menuitem"
        tabIndex={item.disabled ? -1 : 0}
        aria-disabled={item.disabled}
        className={itemClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {rowContent}
      </div>
      {item.iconAction && <SecondaryAction action={item.iconAction} />}
    </div>
  );
};

const GroupSeparator: React.FC = () => <div className="h-[3px] w-full bg-ods-bg-surface" />;

export const ActionsMenu: React.FC<ActionsMenuProps> = ({ groups, className = '', onItemClick, header }) => {
  return (
    <div
      className={`relative max-h-[var(--radix-popper-available-height)] min-w-[256px] overflow-y-auto rounded-md border border-ods-border bg-ods-bg shadow-lg ${className}`}
    >
      {header && <div className="border-b border-ods-border">{header}</div>}
      {groups.map((group, groupIndex) => {
        const groupKey = group.id || group.items.map(i => i.id).join('|');
        return (
          <React.Fragment key={groupKey}>
            {group.items.map((item, itemIndex) => (
              <MenuItem key={item.id || `${groupKey}-${itemIndex}`} item={item} onItemClick={onItemClick} />
            ))}
            {group.separator && groupIndex < groups.length - 1 && <GroupSeparator />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export interface ActionsMenuDropdownProps extends ActionsMenuProps {
  trigger?: React.ReactNode;
  /** Replace the entire default trigger button. When set, rendered directly as the DropdownMenuTrigger child. */
  customTrigger?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  /** Controlled open state. Pair with `onOpenChange`. Uncontrolled by default. */
  open?: boolean;
  /** Open-state change handler (also fires when an item closes the menu). */
  onOpenChange?: (open: boolean) => void;
  /** Forwarded to the dropdown content — e.g. `e.preventDefault()` to stop
   *  Radix returning focus (and its focus ring) to the trigger on close. */
  onCloseAutoFocus?: (event: Event) => void;
}

export const ActionsMenuDropdown: React.FC<ActionsMenuDropdownProps> = ({
  groups,
  onItemClick,
  className,
  header,
  trigger,
  customTrigger,
  triggerAriaLabel = 'More actions',
  triggerClassName,
  contentClassName,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  open: openProp,
  onOpenChange,
  onCloseAutoFocus,
}) => {
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  });

  // Tell the surrounding surface an overlay is open, so it can stop moving
  // the ground under it (the chat thread suspends its follow-the-bottom
  // auto-scroll — see `OverlayOpenRegistryProvider`). Inert without a
  // provider, so menus elsewhere are unaffected.
  useReportOverlayOpen(open);

  // Dismiss once the USER scrolls the trigger away.
  //
  // Two different situations, two different answers. Content moving on its own
  // (a streaming reply) is handled above by suspending the auto-scroll — the
  // menu must survive that, nobody asked for it to close. A deliberate scroll
  // is the opposite: the reader left, and an anchored menu would ride along
  // until it hovers over unrelated chrome. `hideWhenDetached` only kicks in
  // once the trigger is FULLY clipped, so a half-scrolled trigger still drags
  // a visible menu across the header.
  //
  // Scoped deliberately:
  //   • only scrolls of containers that actually contain the trigger — a
  //     scroll in a neighbouring column is none of our business;
  //   • only past `SCROLL_DISMISS_THRESHOLD_PX` of movement, so touch
  //     momentum and the ~1px settle after opening don't close the menu the
  //     user is reaching for.
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined') return undefined;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return undefined;
    const anchorTop = triggerEl.getBoundingClientRect().top;
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      // `document` fires for the page scroll and contains everything.
      const scrolledTheTrigger = target === document || (target instanceof Node && target.contains(triggerEl));
      if (!scrolledTheTrigger) return;
      const moved = Math.abs(triggerEl.getBoundingClientRect().top - anchorTop);
      if (moved > SCROLL_DISMISS_THRESHOLD_PX) setOpen(false);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [open, setOpen]);

  const handleItemClick = useCallback(
    (item: ActionsMenuItem) => {
      onItemClick?.(item);
      if (item.type !== 'checkbox' && item.type !== 'submenu' && item.closeOnSelect !== false) {
        setOpen(false);
      }
    },
    [onItemClick, setOpen],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        {customTrigger ?? (
          <Button
            variant="outline"
            size="icon"
            aria-label={triggerAriaLabel}
            className={
              triggerClassName ||
              'flex items-center justify-center border-ods-border bg-ods-card hover:bg-ods-bg-hover focus-visible:ring-0'
            }
            leftIcon={trigger ?? <Ellipsis01Icon size={24} className="text-ods-text-primary" />}
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn('overflow-visible border-0 bg-transparent p-0 shadow-none', contentClassName)}
      >
        <ActionsMenu groups={groups} onItemClick={handleItemClick} className={className} header={header} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsMenu;
