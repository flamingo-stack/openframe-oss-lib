'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import type { ReactNode } from 'react';
import { useClippedLabelTooltip } from '../../hooks/ui/use-clipped-label-tooltip';
import { cn } from '../../utils';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from '../ui/actions-menu';
import { FloatingTooltip } from '../ui/floating-tooltip';
import { SquareAvatar } from '../ui/square-avatar';
import { UnreadCountBadge, UnreadDot } from './unread-dot';

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
  /**
   * Unread updates behind the item (e.g. support replies): the count pill on its
   * icon, and the unread dot on the avatar so the closed row says so too.
   */
  count?: number;
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
   * The collapsed sidebar's form: the trigger is named for screen readers, and
   * the menu opens beside the rail instead of above the row. In
   * `NavigationSidebar`, pass the `footerSlot` render function's `minimized`.
   * The trigger's shape follows the sidebar's width on its own (the avatar alone
   * in the rail), so outside a sidebar it is the avatar alone.
   */
  collapsed?: boolean;
  /**
   * Where the avatar sits while `collapsed`:
   * - `start` (default): 8px in, on the rail rows' icon line;
   * - `center`: centred in the trigger, for a rail whose buttons are centred
   *   (the name is taken out of the row, so it no longer holds the avatar left).
   */
  collapsedAlign?: 'start' | 'center';
  /**
   * The trigger is the avatar alone at every width, the name and email only in the menu's
   * header (a footer row that keeps its room for other buttons). Named for screen readers
   * and in its tooltip; the menu still opens above it unless `collapsed`. Default `false`.
   */
  avatarOnly?: boolean;
  /** Controlled open state; pair with `onOpenChange`. Uncontrolled by default. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Merged onto the trigger row. */
  className?: string;
}

/** The host's entries as the design system's menu groups: a divider ends a group. */
function toMenuGroups(entries: AccountPopoverEntry[]): ActionsMenuGroup[] {
  const groups: ActionsMenuGroup[] = [];
  let current: ActionsMenuItem[] = [];
  const close = (separator: boolean) => {
    if (current.length > 0) groups.push({ id: current[0].id, items: current, separator });
    current = [];
  };
  for (const entry of entries) {
    if (entry.type === 'divider') {
      close(true);
      continue;
    }
    const danger = entry.tone === 'danger';
    current.push({
      id: entry.id,
      label: entry.label,
      // The menu's icon cell sizes the glyph; the colour is the menu's secondary
      // (the error colour on a danger row, from the menu).
      icon: entry.icon ? (
        <span
          className={cn(
            'relative flex size-full items-center justify-center [&>svg]:size-full',
            !danger && 'text-ods-text-secondary',
          )}
        >
          {entry.icon}
          <UnreadCountBadge count={entry.count ?? 0} />
        </span>
      ) : undefined,
      href: entry.href,
      onClick: entry.onSelect,
      disabled: entry.disabled,
      danger,
    });
  }
  close(false);
  return groups;
}

/**
 * The account row at the foot of the sidebar and the menu it opens: name and
 * email, the host's items (Settings, Help Center, Log out …) and dividers.
 *
 * The menu is the design system's `ActionsMenuDropdown` — the rows, type,
 * icons and separators of every other menu — with the name and email as its
 * header. Upward (`side="top"`) from the expanded row; beside the rail
 * (`side="right"`) when `collapsed`.
 */
export function AccountPopover({
  name,
  email,
  subtitle,
  avatarUrl,
  items,
  collapsed = false,
  collapsedAlign = 'start',
  avatarOnly = false,
  open: openProp,
  onOpenChange,
  disabled = false,
  className,
}: AccountPopoverProps) {
  const unread = items.some(entry => entry.type !== 'divider' && (entry.count ?? 0) > 0);
  const centred = collapsed && collapsedAlign === 'center';
  // No visible name: the trigger is named instead (its accessible name and tooltip).
  const unnamed = collapsed || avatarOnly;
  // The name and subtitle a narrow sidebar clips: their full text in a tooltip
  // over them, only while clipped and where a pointer can hover. The rail's
  // tooltip is the trigger's `title`.
  const { ref: nameRef, enabled: nameTooltip } = useClippedLabelTooltip<HTMLSpanElement>(name);
  const { ref: subtitleRef, enabled: subtitleTooltip } = useClippedLabelTooltip<HTMLSpanElement>(subtitle);
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  });

  return (
    <ActionsMenuDropdown
      open={open}
      onOpenChange={setOpen}
      side={collapsed ? 'right' : 'top'}
      align={collapsed ? 'end' : 'start'}
      sideOffset={8}
      header={
        <div className="flex min-w-0 flex-col p-[var(--spacing-system-s)]">
          <span className="truncate text-ods-text-primary text-h4">{name}</span>
          {email && <span className="truncate text-ods-text-secondary text-h6">{email}</span>}
        </div>
      }
      groups={toMenuGroups(items)}
      customTrigger={
        <button
          type="button"
          disabled={disabled}
          // The visible name is the label when expanded; the rail shows only the
          // avatar, so it gets the name as its accessible name and tooltip.
          aria-label={unnamed ? `Account: ${name}` : undefined}
          title={unnamed ? name : undefined}
          // The shape follows the sidebar's width (the `of-nav-sidebar`
          // container), as its rows do: the avatar holds its place — 8px in at
          // both widths, on the rows' icon line — and the name fades as the width
          // crosses 140px. `collapsed` flips on the click, mid-way through that.
          className={cn(
            'group/account flex h-11 min-w-0 items-center gap-[var(--spacing-system-xsf)] overflow-hidden rounded-md text-left',
            // Avatar only: a square around it, the size of the row's other buttons.
            avatarOnly && !collapsed ? 'size-8 shrink-0 justify-center gap-0 p-0' : 'w-full',
            centred && 'justify-center gap-0 px-0',
            !centred &&
              !avatarOnly &&
              'pl-[var(--spacing-system-xsf)] pr-0 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]',
            'transition-[padding,background-color] duration-200 hover:bg-ods-bg-hover data-[state=open]:bg-ods-bg-hover motion-reduce:transition-none',
            disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            className,
          )}
        >
          <span className="relative inline-flex shrink-0">
            <SquareAvatar
              src={avatarUrl ?? undefined}
              alt={name}
              fallback={name}
              sizePx={28}
              variant="round"
              aria-hidden="true"
            />
            {unread && <UnreadDot size="fixed" />}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 flex-col opacity-0 transition-opacity duration-150 @[140px]/of-nav-sidebar:opacity-100 motion-reduce:transition-none',
              centred || avatarOnly ? 'hidden' : 'flex',
            )}
            aria-hidden={unnamed || undefined}
          >
            {/* The chevron follows the name, so it reads as this row's menu and not
                as one more of the buttons a host sets at the row's end. */}
            <span className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
              <FloatingTooltip
                content={name}
                side="top"
                as="span"
                disabled={collapsed || !nameTooltip}
                triggerClassName="min-w-0"
              >
                <span ref={nameRef} className="block truncate text-ods-text-primary text-h4">
                  {name}
                </span>
              </FloatingTooltip>
              <Chevron02DownIcon
                size={16}
                className="shrink-0 text-ods-text-secondary transition-transform duration-200 group-data-[state=open]/account:rotate-180"
                aria-hidden="true"
              />
            </span>
            {subtitle && (
              <FloatingTooltip
                content={subtitle}
                side="top"
                as="span"
                disabled={collapsed || !subtitleTooltip}
                triggerClassName="min-w-0"
              >
                <span ref={subtitleRef} className="block truncate text-ods-text-secondary text-code">
                  {subtitle}
                </span>
              </FloatingTooltip>
            )}
          </span>
        </button>
      }
    />
  );
}
