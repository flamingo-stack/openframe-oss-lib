'use client';

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { LoadingItems, loadingItemProps, useLoadingScope } from '../ui/loading-scope';
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
  /** The chat is still being read: the row draws its skeleton (as it does in a loading scope). */
  loading?: boolean;
  /** The row's place in its list: picks the loading title bar's width, so a page of loading rows reads like a list. */
  index?: number;
}

/** A loading chat row's title widths, cycled by index: a believable spread, the same on every load. Shared by every
 *  chat list's loading rows. */
export const SKELETON_TITLE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2', 'w-2/3'];

/** The row's box, loaded and loading. */
const CHAT_LIST_ITEM_CLASS =
  'flex w-full shrink-0 items-center gap-[var(--spacing-system-xs)] rounded-md p-[var(--spacing-system-xs)] text-left';

/**
 * One row of the `ChatNavSidebar` list (Figma `chat-list-item`): a one-line
 * title over a caption, an optional mark before the title and a status glyph
 * at the end. The selected row takes the accent's secondary fill, so a tenant
 * accent recolours it with the rest of the brand. ONE switch (`useLoadingScope() || loading`): while the chat is read
 * the SAME row (an inert `div`) draws its title, caption and trailing text as bars; the `leading` mark stays.
 */
const ChatListItem = forwardRef<HTMLButtonElement, ChatListItemProps>(
  (
    { className, title, subtitle, leading, trailing, active, loading: loadingProp = false, index = 0, ...props },
    ref,
  ) => {
    const loading = useLoadingScope() || loadingProp;
    const content = (
      <>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            {leading && <span className="flex shrink-0 items-center [&_svg]:size-4">{leading}</span>}
            {loading ? (
              <TextLineSkeleton type="h4" className={SKELETON_TITLE_WIDTHS[index % SKELETON_TITLE_WIDTHS.length]} />
            ) : (
              <span
                className={cn('min-w-0 flex-1 truncate text-h4', active ? 'text-ods-accent' : 'text-ods-text-primary')}
              >
                {title}
              </span>
            )}
          </span>
          {subtitle != null &&
            (loading ? (
              <TextLineSkeleton type="h6" className="w-1/3" />
            ) : (
              <span className={cn('truncate text-h6', active ? 'text-ods-text-primary' : 'text-ods-text-secondary')}>
                {subtitle}
              </span>
            ))}
        </span>
        {loading
          ? trailing != null && <TextLineSkeleton type="h6" className="w-12 shrink-0" />
          : trailing && <span className="flex shrink-0 items-center [&_svg]:size-6">{trailing}</span>}
      </>
    );
    if (loading) {
      return (
        <div aria-hidden className={cn(CHAT_LIST_ITEM_CLASS, className)} {...loadingItemProps(props)}>
          {content}
        </div>
      );
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
        {content}
      </button>
    );
  },
);

ChatListItem.displayName = 'ChatListItem';

/**
 * A chat list's first page while it is read: `count` loading {@link ChatListItem} rows (the list's page size), each a
 * list item, with the caption and trailing parts the list's loaded rows have.
 */
function ChatListItemLoadingPage({
  count,
  subtitle = false,
  trailing = false,
}: {
  count: number;
  subtitle?: boolean;
  trailing?: boolean;
}) {
  return (
    <LoadingItems count={count}>
      {index => (
        <ChatListItem
          loading
          index={index}
          title=""
          subtitle={subtitle ? '' : undefined}
          trailing={trailing ? '' : undefined}
          data-loading-item
        />
      )}
    </LoadingItems>
  );
}

export { ChatNavSidebar, ChatListItem, ChatListItemLoadingPage };
