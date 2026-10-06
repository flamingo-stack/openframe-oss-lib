'use client';

import { Arrow02RightIcon, Ellipsis01Icon, Refresh01LeftIcon, SidebarIcon, XmarkIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { SquareAvatar } from '../ui/square-avatar';
import { ChatHeaderIconButton } from './chat-header-icon-button';

export interface MingoChatHeaderProps {
  title: string;
  /** Second line: the chat's owner. */
  subtitle?: string | null;
  /** The owner's avatar at the title cell's end. */
  avatar?: { name?: string | null; avatarUrl?: string | null } | null;
  /** Shows the chat list toggle at the start. */
  onToggleList?: () => void;
  /** The list is on screen beside the chat; drives the toggle's state. */
  listOpen?: boolean;
  /** The chat's ⋯ menu. Empty or omitted leaves it out. */
  menuItems?: ActionsMenuItem[];
  /** An archived chat: offers "Unarchive". */
  onRestore?: () => void;
  /** Collapse the chat back to the list alone (the panel's minimum). */
  onCollapse?: () => void;
  /** Close the panel; only a panel that can close passes it. */
  onClose?: () => void;
}

/**
 * Top bar of the Mingo v2 chat (Figma `chat-top-navigation`): the chat list
 * toggle, the title over its owner with the owner's avatar, then the chat's ⋯
 * menu and the collapse arrow, split by vertical dividers. It sits over the
 * chat column only; the list beside it has no bar.
 */
export function MingoChatHeader({
  title,
  subtitle,
  avatar,
  onToggleList,
  listOpen = false,
  menuItems = [],
  onRestore,
  onCollapse,
  onClose,
}: MingoChatHeaderProps) {
  return (
    <div className="flex h-14 w-full shrink-0 overflow-hidden border-b border-ods-border">
      {onToggleList && (
        <ChatHeaderIconButton
          divider="right"
          onClick={onToggleList}
          aria-label={listOpen ? 'Hide chat list' : 'Show chat list'}
          aria-pressed={listOpen}
        >
          <SidebarIcon size={24} />
        </ChatHeaderIconButton>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-ods-text-primary text-h3">{title}</p>
          {subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}
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

      {onRestore && (
        <ChatHeaderIconButton onClick={onRestore} aria-label="Unarchive chat">
          <Refresh01LeftIcon size={24} />
        </ChatHeaderIconButton>
      )}
      {menuItems.length > 0 && (
        <ActionsMenuDropdown
          triggerAriaLabel="Chat actions"
          onCloseAutoFocus={e => e.preventDefault()}
          groups={[{ items: menuItems }]}
          customTrigger={
            <ChatHeaderIconButton aria-label="Chat actions">
              <Ellipsis01Icon size={24} />
            </ChatHeaderIconButton>
          }
        />
      )}
      {onCollapse && (
        <ChatHeaderIconButton onClick={onCollapse} aria-label="Collapse chat">
          <Arrow02RightIcon size={24} />
        </ChatHeaderIconButton>
      )}
      {onClose && (
        <ChatHeaderIconButton onClick={onClose} aria-label="Close">
          <XmarkIcon size={24} />
        </ChatHeaderIconButton>
      )}
    </div>
  );
}
