'use client';

import type React from 'react';
import { ActionsMenuDropdown, type ActionsMenuItemConfig } from './actions-menu';

/**
 * @deprecated Use `ActionsMenuItem` from `./actions-menu` with
 * `ActionsMenuDropdown` instead. `MoreActionsMenu` is being phased out in favor
 * of the `ActionsMenu*` family.
 */
export type MoreActionsItem = {
  label: string;
  /** Click handler. Optional when `href` is provided. */
  onClick?: () => void;
  /** If set, the item renders as a Next.js Link (real <a href> in the DOM). */
  href?: string;
  /** Only relevant with `href` — opens the link in a new tab. */
  openInNewTab?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * @deprecated Use `ActionsMenuDropdownProps` from `./actions-menu` instead.
 */
export interface MoreActionsMenuProps {
  items: MoreActionsItem[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  className?: string;
  /** Appended to the dropdown content. To render the menu above a high-z
   *  surface (drawer, modal), prefer wrapping that surface in a
   *  `PortalContainerContext` provider rather than escalating z-index here. */
  contentClassName?: string;
  ariaLabel?: string;
  /** Custom trigger element. When provided, replaces the default ellipsis icon button. */
  trigger?: React.ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Called when the open state changes — use together with `open`. */
  onOpenChange?: (open: boolean) => void;
  /** Forwarded to the dropdown content. Call `e.preventDefault()` to stop
   *  Radix returning focus (and its focus ring) to the trigger on close. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Compact, reusable menu triggered by an ellipsis icon button.
 * Built on top of Radix DropdownMenu used in the UI Kit.
 *
 * @deprecated Use `ActionsMenuDropdown` from `./actions-menu` instead — it
 * supports the same trigger override (`customTrigger`), controlled `open` /
 * `onOpenChange`, `onCloseAutoFocus`, and `danger` items, plus grouped items,
 * checkboxes, and submenus. This component will be removed in a future release.
 *
 * This is now a thin wrapper around `ActionsMenuDropdown` to guarantee
 * behavioral parity until removal.
 */
export function MoreActionsMenu({
  items,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  className,
  contentClassName,
  ariaLabel = 'More actions',
  trigger,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: MoreActionsMenuProps) {
  const mappedItems: ActionsMenuItemConfig[] = items.map(item => ({
    label: item.label,
    onClick: item.onClick,
    href: item.href,
    openInNewTab: item.openInNewTab,
    icon: item.icon,
    disabled: item.disabled,
    danger: item.danger,
  }));

  return (
    <ActionsMenuDropdown
      items={mappedItems}
      align={align}
      side={side}
      sideOffset={sideOffset}
      triggerClassName={className}
      contentClassName={contentClassName}
      ariaLabel={ariaLabel}
      customTrigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}

