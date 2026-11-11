'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface ChatListEmptyStateProps {
  /** Centred muted glyph. Pass the icon already sized: 24px by default
   *  (`<ChatsIcon size={24} />`), 20px for `density="compact"`. */
  icon: ReactNode;
  /** Title line (`h4`; the shell's body type when compact). */
  title: ReactNode;
  /** Caption line under the title (`h6`). Omitted → title alone. */
  description?: ReactNode;
  /**
   * `'compact'`: the three-column shell's chat list (Figma `chat-list` / `empty`,
   * 1409:305752): a 20px glyph, the lines 8px apart in the panel's grey, no inset
   * of its own (the list's caption already sets it).
   */
  density?: 'default' | 'compact';
  /** Appended to the root element. */
  className?: string;
}

/**
 * Shared empty state for the chat-list surfaces — the "Current Chats" rail and
 * the Chat Archive page (Figma node 113:60939). A centred muted glyph over
 * a title + caption, both in the secondary text colour. It grows into the space
 * its list leaves (`flex-1`) and centres there. Kept in one place so the lists
 * can't drift apart.
 */
export function ChatListEmptyState({
  icon,
  title,
  description,
  density = 'default',
  className,
}: ChatListEmptyStateProps) {
  const compact = density === 'compact';
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center text-center',
        compact
          ? 'gap-[var(--spacing-system-xsf)] text-ods-text-panel-secondary'
          : 'gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)] text-ods-text-secondary',
        className,
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center', compact ? 'size-5' : 'size-6')}>{icon}</span>
      <div className={cn('flex flex-col', compact && 'gap-[var(--spacing-system-xsf)]')}>
        <p className={compact ? 'text-shell-body' : 'text-h4'}>{title}</p>
        {description && <p className="text-h6">{description}</p>}
      </div>
    </div>
  );
}
