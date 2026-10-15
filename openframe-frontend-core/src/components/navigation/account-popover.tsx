'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils';
import { Chevron02UpIcon } from '../icons-v2-generated';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { SquareAvatar } from '../ui/square-avatar';

/** One action in the account menu: a link (`href`) or a callback (`onSelect`). */
export interface AccountPopoverItem {
  type?: 'item';
  id: string;
  label: string;
  icon?: ReactNode;
  /** Navigates as a real link (the host's router link where one is registered). */
  href?: string;
  /** Runs on select (click, Enter, Space). Also runs for an `href` item, before it navigates. */
  onSelect?: () => void;
  /** `'danger'` draws the row in the error colour — Log out. Default `'default'`. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** A rule between two runs of items. */
export interface AccountPopoverDivider {
  type: 'divider';
  id: string;
}

export type AccountPopoverEntry = AccountPopoverItem | AccountPopoverDivider;

export interface AccountPopoverProps {
  /** The user's name: the trigger's first line and the menu header. */
  name: string;
  /** Shown under the name in the menu header. */
  email?: string;
  /** The trigger's second line, in mono — e.g. the tenant host. */
  subtitle?: string;
  /** Image for the 28px avatar; without one it draws the name's initials. */
  avatarUrl?: string | null;
  items: AccountPopoverEntry[];
  /**
   * The collapsed sidebar's form: the trigger is the avatar alone, and the menu
   * opens beside the rail instead of above the row. In `NavigationSidebar`, pass
   * the `footerSlot` render function's `minimized`.
   */
  collapsed?: boolean;
  /** Controlled open state; pair with `onOpenChange`. Uncontrolled by default. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Merged onto the trigger row. */
  className?: string;
}

const ITEM_CLASSES =
  'cursor-pointer gap-[var(--spacing-system-xsf)] rounded-none p-[var(--spacing-system-s)] text-h6 [&_svg]:size-5';

/**
 * The account row at the foot of the sidebar and the menu it opens: name and
 * email, the host's items (Settings, Help Center, Log out …) and dividers.
 *
 * Built on the lib's `DropdownMenu` (Radix): it portals into the active portal
 * container like every other popup, positions and flips itself, and closes on
 * an outside click, on Escape and when an item is selected, with arrow-key
 * navigation between items. Upward (`side="top"`) from the expanded row; beside
 * the rail (`side="right"`) when `collapsed`.
 */
export function AccountPopover({
  name,
  email,
  subtitle,
  avatarUrl,
  items,
  collapsed = false,
  open: openProp,
  onOpenChange,
  disabled = false,
  className,
}: AccountPopoverProps) {
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          // The visible name is the label when expanded; the rail shows only the
          // avatar, so it gets the name as its accessible name and tooltip.
          aria-label={collapsed ? `Account: ${name}` : undefined}
          title={collapsed ? name : undefined}
          className={cn(
            'group/account flex h-11 w-full min-w-0 items-center gap-[var(--spacing-system-xsf)] rounded-md text-left',
            'transition-colors duration-150 hover:bg-ods-bg-hover data-[state=open]:bg-ods-bg-hover',
            collapsed ? 'justify-center px-0' : 'px-[var(--spacing-system-xsf)]',
            disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            className,
          )}
        >
          <SquareAvatar
            src={avatarUrl ?? undefined}
            alt={name}
            fallback={name}
            sizePx={28}
            variant="round"
            aria-hidden="true"
          />
          {!collapsed && (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ods-text-primary text-h6">{name}</span>
                {subtitle && <span className="truncate text-ods-text-secondary text-code">{subtitle}</span>}
              </span>
              <Chevron02UpIcon
                size={16}
                className="shrink-0 text-ods-text-secondary transition-transform duration-200 group-data-[state=open]/account:rotate-180"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        sideOffset={8}
        className="w-[248px] min-w-0 rounded-md border border-ods-border bg-ods-bg p-0"
      >
        <div className="flex min-w-0 flex-col border-b border-ods-border p-[var(--spacing-system-s)]">
          <span className="truncate text-ods-text-primary text-h6">{name}</span>
          {email && <span className="truncate text-ods-text-secondary text-h6">{email}</span>}
        </div>

        {items.map(entry => {
          if (entry.type === 'divider') {
            return <DropdownMenuSeparator key={entry.id} className="mx-0 my-0" />;
          }
          const danger = entry.tone === 'danger';
          const itemClassName = cn(ITEM_CLASSES, danger && 'text-ods-error hover:text-ods-error focus:text-ods-error');
          const content = (
            <>
              {entry.icon && (
                <span
                  className={cn('flex shrink-0 items-center', danger ? 'text-ods-error' : 'text-ods-text-secondary')}
                >
                  {entry.icon}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            </>
          );

          if (entry.href) {
            return (
              <DropdownMenuItem
                key={entry.id}
                asChild
                disabled={entry.disabled}
                onSelect={entry.onSelect}
                className={itemClassName}
              >
                <Link href={entry.href}>{content}</Link>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={entry.id}
              disabled={entry.disabled}
              onSelect={entry.onSelect}
              className={itemClassName}
            >
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
