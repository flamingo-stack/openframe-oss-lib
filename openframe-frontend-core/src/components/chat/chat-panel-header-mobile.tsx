'use client';

import { cn } from '../../utils/cn';
import { Chevron02LeftIcon, ClockHistoryIcon, XmarkIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import type { ChatPanelHeaderProps } from './chat-panel-header';

export interface ChatPanelHeaderMobileProps extends ChatPanelHeaderProps {
  className?: string;
}

/**
 * Mobile chat panel header — Figma node `7363:85532`. A distinct layout from
 * the desktop bar (which packs full-height divider cells into a fixed `h-14`):
 *
 *   - Surface: `ods-card` with a bottom border; generous `l` side padding,
 *     `l` bottom padding, and `xl` top padding on the title block (so the row
 *     bottom-aligns under a tall header).
 *   - Title: `text-h2` (vs the desktop `h3`/`h4`), truncated.
 *   - Actions: 44px outlined icon buttons (`Button variant="outline"
 *     size="icon"`) — a back chevron (when applicable), a trailing `⋯` menu
 *     carrying the view-dependent actions (hidden when no action applies),
 *     and an X Close. The X is REQUIRED here: on mobile the drawer is
 *     full-screen (`w-screen`), so there is no visible backdrop to tap —
 *     without it the panel cannot be dismissed at all.
 *
 * Same prop contract as `ChatPanelHeader`; the orchestrator renders this on
 * mobile and the desktop bar on `md+`.
 */
export function ChatPanelHeaderMobile({
  showBack = false,
  title,
  backAriaLabel = 'Back',
  isArchivedView = false,
  onBack,
  onClose,
  onRestore,
  onRename,
  onArchive,
  onOpenArchive,
  className,
}: ChatPanelHeaderMobileProps) {
  // The right-hand ⋯ menu carries the view-dependent actions. Close is not
  // listed (the panel is dismissed elsewhere); the trigger is hidden entirely
  // when no action applies (e.g. the archive list view).
  const menuItems = [
    !showBack &&
      onOpenArchive && {
        id: 'open-archive',
        label: 'Chat archive',
        icon: <ClockHistoryIcon className="h-full w-full" />,
        onClick: onOpenArchive,
      },
    isArchivedView && onRestore && { id: 'unarchive', label: 'Unarchive chat', onClick: onRestore },
    !isArchivedView && onRename && { id: 'rename', label: 'Rename chat', onClick: onRename },
    !isArchivedView && onArchive && { id: 'archive', label: 'Archive chat', onClick: onArchive },
  ].filter(Boolean) as ActionsMenuItem[];

  return (
    <div
      className={cn(
        'flex flex-shrink-0 flex-col border-b border-ods-border bg-ods-card',
        'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex w-full items-end gap-[var(--spacing-system-sf)]">
        {showBack && (
          <Button variant="outline" size="icon" aria-label={backAriaLabel} onClick={onBack} className="shrink-0">
            <Chevron02LeftIcon />
          </Button>
        )}

        {/* Title block — `xl` top padding pushes the title down so the row
            bottom-aligns the title, back chevron, and ⋯ menu. */}
        <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-m)] pt-[var(--spacing-system-xl)]">
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xs)]">
            <p className="min-w-0 truncate text-ods-text-primary text-h2" title={title}>
              {title}
            </p>
          </div>

          {menuItems.length > 0 && (
            <ActionsMenuDropdown
              groups={[{ items: menuItems }]}
              triggerAriaLabel="Chat actions"
              triggerClassName="flex shrink-0 items-center justify-center border-ods-border bg-ods-card hover:bg-ods-bg-hover focus-visible:ring-0"
            />
          )}

          {onClose && (
            <Button variant="outline" size="icon" aria-label="Close chat" onClick={onClose} className="shrink-0">
              <XmarkIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
