'use client';

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade';

export interface ChatNavSidebarItem {
  id: string;
  label: string;
  /** 24px glyph before the label. */
  icon: ReactNode;
  /** The view this item opens is the one on screen. */
  active?: boolean;
  onClick?: () => void;
}

export interface ChatNavSidebarProps extends HTMLAttributes<HTMLElement> {
  /** Brand row at the top. */
  logo?: ReactNode;
  /** Primary actions under the logo (new chat, archive, help, ...). */
  items: ChatNavSidebarItem[];
  /** Caption over the list (e.g. "Your Current Chats"). */
  sectionLabel?: string;
  /** Control at the caption's end (e.g. a ⋯ menu that filters or searches the list). */
  sectionActions?: ReactNode;
  /** Pinned between the caption and the list (e.g. a search field). */
  listHeader?: ReactNode;
  /** The list itself, typically `ChatListItem` rows or an empty state. Scrolls
   *  on its own; everything above it stays put. */
  children?: ReactNode;
  /** Pinned under the list, full width, above a divider (e.g. the MSP card). */
  footer?: ReactNode;
}

/**
 * Left rail of the fae chat v2 layout (Figma `chat-sidebar`): brand, a stack of
 * navigation actions, a captioned scrolling list and a pinned footer. It only
 * lays things out; which rows exist, what they show and what selecting them
 * does belong to the host.
 */
const ChatNavSidebar = forwardRef<HTMLElement, ChatNavSidebarProps>(
  ({ className, logo, items, sectionLabel, sectionActions, listHeader, children, footer, ...props }, ref) => {
    const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>();

    return (
      <aside
        ref={ref}
        className={cn('flex h-full w-[296px] shrink-0 flex-col border-r border-ods-border bg-ods-bg', className)}
        {...props}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] px-[var(--spacing-system-xs)] pt-[var(--spacing-system-mf)]">
          {logo && <div className="flex shrink-0 items-center px-[var(--spacing-system-xs)]">{logo}</div>}

          <nav className="flex shrink-0 flex-col gap-[var(--spacing-system-xxs)]">
            {items.map(item => (
              <ChatNavSidebarButton key={item.id} icon={item.icon} active={item.active} onClick={item.onClick}>
                {item.label}
              </ChatNavSidebarButton>
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
            {sectionLabel && (
              <div className="flex shrink-0 items-end gap-[var(--spacing-system-m)] px-[var(--spacing-system-xs)] pt-[var(--spacing-system-xs)]">
                <p className="min-w-0 flex-1 text-ods-text-secondary text-h5">{sectionLabel}</p>
                {sectionActions}
              </div>
            )}
            {listHeader && <div className="shrink-0">{listHeader}</div>}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                onScroll={updateFade}
                className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xxs)] overflow-y-auto overscroll-contain pb-[var(--spacing-system-mf)]"
              >
                {children}
              </div>
              <ScrollFadeOverlay edge="top" visible={fadeTop} />
              <ScrollFadeOverlay edge="bottom" visible={fadeBottom} />
            </div>
          </div>
        </div>

        {footer && <div className="shrink-0 border-t border-ods-border">{footer}</div>}
      </aside>
    );
  },
);

ChatNavSidebar.displayName = 'ChatNavSidebar';

interface ChatNavSidebarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  active?: boolean;
}

function ChatNavSidebarButton({ icon, active, className, children, ...props }: ChatNavSidebarButtonProps) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-[var(--spacing-system-xs)] rounded-md p-[var(--spacing-system-xs)] text-left text-h4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        '[&_svg]:size-6 [&_svg]:shrink-0',
        active ? 'text-ods-accent' : 'text-ods-text-primary [&_svg]:text-ods-text-secondary',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export interface ChatListItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: ReactNode;
  /** Second line (e.g. the ticket number). */
  subtitle?: ReactNode;
  /** 16px mark before the title (e.g. a resolved check). */
  leading?: ReactNode;
  /** 24px status glyph at the row's end. */
  trailing?: ReactNode;
  /** The chat open on screen. */
  active?: boolean;
}

/** The row's box, shared by the loaded row and its skeleton so both take the same space. */
const CHAT_LIST_ITEM_CLASS =
  'flex w-full shrink-0 items-center gap-[var(--spacing-system-xs)] rounded-md p-[var(--spacing-system-xs)] text-left';

/**
 * One row of the `ChatNavSidebar` list (Figma `chat-list-item`): a one-line
 * title over a caption, an optional mark before the title and a status glyph
 * at the end. The selected row takes the accent's secondary fill, so a tenant
 * accent recolours it with the rest of the brand. Inside a `LoadingScope` it
 * draws its own skeleton ({@link ChatListItemSkeleton}).
 */
const ChatListItem = forwardRef<HTMLButtonElement, ChatListItemProps>(
  ({ className, title, subtitle, leading, trailing, active, ...props }, ref) => {
    if (useLoadingScope()) {
      return <ChatListItemSkeleton subtitle={subtitle != null} trailing={trailing != null} className={className} />;
    }
    return (
      <button
        ref={ref}
        type="button"
        aria-current={active ? 'true' : undefined}
        className={cn(
          CHAT_LIST_ITEM_CLASS,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
          active && 'bg-ods-accent-secondary',
          className,
        )}
        {...props}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            {leading && <span className="flex shrink-0 items-center [&_svg]:size-4">{leading}</span>}
            <span
              className={cn('min-w-0 flex-1 truncate text-h4', active ? 'text-ods-accent' : 'text-ods-text-primary')}
            >
              {title}
            </span>
          </span>
          {subtitle != null && (
            <span className={cn('truncate text-h6', active ? 'text-ods-text-primary' : 'text-ods-text-secondary')}>
              {subtitle}
            </span>
          )}
        </span>
        {trailing && <span className="flex shrink-0 items-center [&_svg]:size-6">{trailing}</span>}
      </button>
    );
  },
);

ChatListItem.displayName = 'ChatListItem';

/** Title widths the loading rows cycle through (`index`), so a list of them reads like a list of chats. */
const SKELETON_TITLE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2', 'w-2/3'];

export interface ChatListItemSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Draw the caption line (the loaded row has a `subtitle`). */
  subtitle?: boolean;
  /** Draw a short bar at the row's end (the loaded row has `trailing` text, e.g. a time). */
  trailing?: boolean;
  /** The row's place in its list: picks the title bar's width. */
  index?: number;
}

/** {@link ChatListItem}'s loading state: the same box, a title bar, and the caption and trailing parts the loaded row
 *  has. A list's loading state is a page of these (each marked `data-loading-item` by the list). */
function ChatListItemSkeleton({
  subtitle = false,
  trailing = false,
  index = 0,
  className,
  ...props
}: ChatListItemSkeletonProps) {
  return (
    <div aria-hidden className={cn(CHAT_LIST_ITEM_CLASS, className)} {...props}>
      <span className="flex min-w-0 flex-1 flex-col">
        <TextLineSkeleton type="h4" className={SKELETON_TITLE_WIDTHS[index % SKELETON_TITLE_WIDTHS.length]} />
        {subtitle && <TextLineSkeleton type="h6" className="w-1/3" />}
      </span>
      {trailing && <TextLineSkeleton type="h6" className="w-12 shrink-0" />}
    </div>
  );
}

export { ChatNavSidebar, ChatListItem, ChatListItemSkeleton };
