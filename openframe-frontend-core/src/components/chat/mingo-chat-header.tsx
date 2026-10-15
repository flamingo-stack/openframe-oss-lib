'use client';

import { cn } from '../../utils/cn';
import { Arrow02RightIcon, Ellipsis01Icon, Refresh01LeftIcon, SidebarIcon, XmarkIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from '../ui/actions-menu';
import { SquareAvatar } from '../ui/square-avatar';
import { ChatHeaderIconButton } from './chat-header-icon-button';
import { ChatHeaderRenameField } from './chat-header-rename-field';

export interface MingoChatHeaderProps {
  /**
   * `'panel'` (default): the bar over the chat in a panel — title over its
   * owner, the owner's avatar, and whichever list / collapse / close controls
   * the panel passes. `'page'`: the bar over a chat that IS the page (a chat
   * that cannot be closed) — the title with `meta` beside it and the chat's
   * ⋯; the list toggle, collapse and close are never drawn, whatever is passed.
   */
  variant?: 'panel' | 'page';
  title: string;
  /** Second line: the chat's owner. Panel variant. */
  subtitle?: string | null;
  /** Page variant: small parts after the title, each led by "·" (e.g. the
   *  owner and the day). Empty parts are skipped. */
  meta?: ReadonlyArray<string | null | undefined>;
  /** The owner's avatar at the title cell's end. Panel variant. */
  avatar?: { name?: string | null; avatarUrl?: string | null } | null;
  /** Shows the chat list toggle at the start. Panel variant. */
  onToggleList?: () => void;
  /** The list is on screen beside the chat; drives the toggle's state. */
  listOpen?: boolean;
  /** The chat's ⋯ menu. Empty or omitted (with no `extraMenuItems`) leaves it out. */
  menuItems?: ActionsMenuItem[];
  /** Items under the chat's own, after a separator: actions that are not about this chat. */
  extraMenuItems?: ActionsMenuItem[];
  /** An archived chat: offers "Unarchive". */
  onRestore?: () => void;
  /** Collapse the chat back to the list alone (the panel's minimum). Panel variant. */
  onCollapse?: () => void;
  /** Close the panel; only a panel that can close passes it. Panel variant. */
  onClose?: () => void;
  /** The title is being renamed in place: it turns into a field, text selected. */
  renaming?: boolean;
  /** Enter or blur in the rename field, with its raw value. */
  onRenameSubmit?: (title: string) => void;
  /** Escape in the rename field. */
  onRenameCancel?: () => void;
}

/**
 * Top bar of the Mingo v2 chat (Figma `chat-top-navigation`): the chat list
 * toggle, the title over its owner with the owner's avatar, then the chat's ⋯
 * menu and the collapse arrow, split by vertical dividers. It sits over the
 * chat column only; the list beside it has no bar.
 */
export function MingoChatHeader({
  variant = 'panel',
  title,
  subtitle,
  meta,
  avatar,
  onToggleList,
  listOpen = false,
  menuItems = [],
  extraMenuItems = [],
  onRestore,
  onCollapse,
  onClose,
  renaming = false,
  onRenameSubmit,
  onRenameCancel,
}: MingoChatHeaderProps) {
  const isPage = variant === 'page';
  const menuGroups: ActionsMenuGroup[] = [
    ...(menuItems.length > 0 ? [{ items: menuItems, separator: true }] : []),
    ...(extraMenuItems.length > 0 ? [{ items: extraMenuItems }] : []),
  ];
  const metaParts = (meta ?? []).filter((part): part is string => !!part && part.trim().length > 0);
  // Keyed on the title, so a rename opened again after the title changed seeds
  // from the new one.
  const titleNode = renaming ? (
    <ChatHeaderRenameField
      key={title}
      initialValue={title}
      onSubmit={value => onRenameSubmit?.(value)}
      onCancel={() => onRenameCancel?.()}
    />
  ) : (
    <p className={cn('truncate text-ods-text-primary text-h3', isPage && 'min-w-0')}>{title}</p>
  );

  return (
    <div className="flex h-14 w-full shrink-0 overflow-hidden border-b border-ods-border">
      {!isPage && onToggleList && (
        <ChatHeaderIconButton
          divider="right"
          onClick={onToggleList}
          aria-label={listOpen ? 'Hide chat list' : 'Show chat list'}
          aria-pressed={listOpen}
        >
          <SidebarIcon size={24} />
        </ChatHeaderIconButton>
      )}

      {isPage ? (
        // The page variant: one line, the title then its meta.
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]">
          {titleNode}
          {!renaming && metaParts.length > 0 && (
            <p className="min-w-0 max-w-[60%] shrink-0 truncate text-ods-text-secondary text-h6">
              {metaParts.map(part => `· ${part}`).join(' ')}
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]">
          <div className="flex min-w-0 flex-1 flex-col">
            {titleNode}
            {!renaming && subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}
          </div>
          {avatar && (avatar.name || avatar.avatarUrl) ? (
            <SquareAvatar
              variant="round"
              sizePx={32}
              src={avatar.avatarUrl || undefined}
              alt={avatar.name || undefined}
              fallback={avatar.name || undefined}
              title={avatar.name || undefined}
            />
          ) : null}
        </div>
      )}

      {onRestore && (
        <ChatHeaderIconButton onClick={onRestore} aria-label="Unarchive chat">
          <Refresh01LeftIcon size={24} />
        </ChatHeaderIconButton>
      )}
      {menuGroups.length > 0 && (
        <ActionsMenuDropdown
          triggerAriaLabel="Chat actions"
          onCloseAutoFocus={e => e.preventDefault()}
          groups={menuGroups}
          customTrigger={
            <ChatHeaderIconButton aria-label="Chat actions">
              <Ellipsis01Icon size={24} />
            </ChatHeaderIconButton>
          }
        />
      )}
      {!isPage && onCollapse && (
        <ChatHeaderIconButton onClick={onCollapse} aria-label="Collapse chat">
          <Arrow02RightIcon size={24} />
        </ChatHeaderIconButton>
      )}
      {!isPage && onClose && (
        <ChatHeaderIconButton onClick={onClose} aria-label="Close">
          <XmarkIcon size={24} />
        </ChatHeaderIconButton>
      )}
    </div>
  );
}
