'use client';

import React from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu';
import { Button, type ButtonProps } from './button';

/** The button's own action, when its label does something itself and the chevron holds the alternatives. */
export interface DropdownButtonAction {
  href?: string;
  /** Fetch `href` as a file (an installer) instead of navigating to it. */
  download?: boolean | string;
  openInNewTab?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
}

export interface DropdownButtonProps {
  /** Button label rendered next to the chevron. */
  label: React.ReactNode;
  /**
   * Makes the label a button of its own (Figma `button-action`): it runs this
   * action, and the chevron beside it opens the menu of alternatives. Two click
   * targets on one surface. Without it the whole button opens the menu.
   */
  action?: DropdownButtonAction;
  /** The chevron's accessible name when `action` is set (it has no text of its own). Default: "More options". */
  menuAriaLabel?: string;
  /** Optional leading icon rendered before the label. */
  icon?: React.ReactNode;
  /**
   * Items shown in the dropdown (single flat group). For grouped menus with
   * separators pass `groups` instead — exactly one of the two is required.
   */
  items?: ActionsMenuItem[];
  /** Grouped items (with optional separators). Takes precedence over `items`. */
  groups?: ActionsMenuGroup[];
  /**
   * Render the trigger as a standard `Button` of this variant (`outline`,
   * `accent`, …) instead of the default card-colored seam trigger. Use this
   * when the dropdown sits in a row of ordinary buttons and must match them.
   */
  variant?: ButtonProps['variant'];
  /** Button size for the `variant` trigger. Ignored without `variant`. */
  size?: ButtonProps['size'];
  /** Spinner state for the trigger (either look). */
  loading?: boolean;
  disabled?: boolean;
  /**
   * Stretch the trigger to fill its container. Prefer this over a `w-full`
   * className: the seam trigger's main half only absorbs the extra width — keeping
   * the chevron flush against the trailing edge instead of floating mid-button —
   * when the underlying `Button` is told it is full width, which a className
   * cannot communicate.
   */
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Forwarded to the dropdown content. The standard Radix dropdown→dialog
   * recipe: pass `(e) => e.preventDefault()` when a menu item opens a modal,
   * otherwise closing the menu refocuses its trigger AFTER the dialog has
   * taken focus, yanking focus back OUT of the modal the action just opened.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * THE multi-action button — a labeled trigger with a chevron opening an
 * `ActionsMenu`. One component, so the trigger styling, chevron, and menu
 * chrome cannot drift between surfaces.
 *
 * With `action`, the label is a button of its own and the chevron alone opens
 * the menu (two targets, one surface). Otherwise, two trigger looks — BOTH
 * render through the unified `Button`:
 * - default (no `variant`): the card-colored seam trigger — `Button
 *   variant="outline"` with the chevron in its `splitIcon` slot, so the label
 *   and chevron are separated by a divider, the whole surface is one click
 *   target, and the chevron rotates while open. Used standalone or via
 *   `PageActions` when a `PageActionButton` has `dropdownItems` set.
 * - `variant="outline"` (or any Button variant): a standard `Button` with the
 *   chevron as its right icon, so the trigger matches sibling buttons in the
 *   same row — including `loading` and `leftIcon` support.
 *
 * Item clicks close the menu (ActionsMenuDropdown's default; opt out per item
 * with `closeOnSelect: false`).
 */
export function DropdownButton({
  label,
  action,
  menuAriaLabel = 'More options',
  icon,
  items,
  groups,
  variant,
  size = 'small-legacy',
  loading = false,
  disabled,
  fullWidth,
  className,
  ariaLabel,
  align = 'end',
  side = 'bottom',
  onCloseAutoFocus,
}: DropdownButtonProps) {
  const [open, setOpen] = React.useState(false);

  // If the trigger becomes disabled/loading WHILE the menu is open, close it —
  // and only ever block OPEN transitions below, so Escape/outside-click can
  // still dismiss an already-open menu.
  //
  // Closed while rendering, not from an effect: the disabling render would
  // otherwise commit with the menu still hanging off a control the user can no
  // longer interact with, and only take it away on the pass after. Guarded on
  // `open`, so the second render pass this triggers takes the early exit —
  // and unlike a mask, an unrelated later re-enable cannot pop the menu back up.
  if (open && (disabled || loading)) setOpen(false);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (next && (disabled || loading)) return;
      setOpen(next);
    },
    [disabled, loading],
  );

  const resolvedAriaLabel = ariaLabel || (typeof label === 'string' ? label : undefined);

  // With its own action: two common `Button`s attached into one surface. The
  // label runs the action, the chevron is the menu's trigger.
  if (action) {
    const skin = variant ?? 'outline';
    return (
      <div
        role="group"
        aria-label={resolvedAriaLabel}
        className={cn('inline-flex items-stretch', fullWidth && 'w-full', className)}
      >
        <Button
          variant={skin}
          attach="start"
          href={action.href}
          download={action.download}
          openInNewTab={action.openInNewTab}
          onClick={action.onClick}
          disabled={disabled}
          loading={loading}
          leftIcon={icon}
          className={fullWidth ? 'flex-1' : undefined}
        >
          {label}
        </Button>
        <ActionsMenuDropdown
          groups={groups ?? [{ items: items ?? [] }]}
          open={open}
          onOpenChange={handleOpenChange}
          align={align}
          side={side}
          onCloseAutoFocus={onCloseAutoFocus}
          triggerAriaLabel={menuAriaLabel}
          customTrigger={
            <Button
              type="button"
              variant={skin}
              size="icon"
              attach="end"
              disabled={disabled || loading}
              aria-label={menuAriaLabel}
              className={cn(open && 'bg-ods-bg-hover')}
              leftIcon={
                <Chevron02DownIcon className={cn('transition-transform duration-fast', open && 'rotate-180')} />
              }
            />
          }
        />
      </div>
    );
  }

  const trigger = variant ? (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading}
      fullWidth={fullWidth}
      aria-label={resolvedAriaLabel}
      leftIcon={icon}
      rightIcon={
        <Chevron02DownIcon className={cn('h-4 w-4 transition-transform duration-fast', open && 'rotate-180')} />
      }
      className={className}
    >
      {label}
    </Button>
  ) : (
    // The unified `Button`'s split layout IS the seam anatomy (label, full-height
    // divider, trailing glyph, one click target) — no bespoke <button> here, so
    // the trigger can't drift from the house button chrome.
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      loading={loading}
      fullWidth={fullWidth}
      aria-label={resolvedAriaLabel}
      leftIcon={icon}
      splitIcon={<Chevron02DownIcon className={cn('transition-transform duration-fast', open && 'rotate-180')} />}
      className={cn(open && 'bg-ods-bg-hover', className)}
    >
      {label}
    </Button>
  );

  return (
    <ActionsMenuDropdown
      groups={groups ?? [{ items: items ?? [] }]}
      open={open}
      onOpenChange={handleOpenChange}
      align={align}
      side={side}
      onCloseAutoFocus={onCloseAutoFocus}
      triggerAriaLabel={resolvedAriaLabel}
      customTrigger={trigger}
    />
  );
}
