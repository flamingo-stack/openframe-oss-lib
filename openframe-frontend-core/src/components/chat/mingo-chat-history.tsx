'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { MoreActionsMenu } from '../ui/more-actions-menu'
import { Ellipsis01Icon } from '../icons-v2-generated'
import type { DialogItem } from './types/component.types'

// =============================================================================
// Types
// =============================================================================

export interface MingoChatHistoryProps {
  /** Dialogs to list, assumed already sorted newest-first by the host. */
  dialogs: ReadonlyArray<DialogItem>
  /** Currently-open dialog id (highlighted). */
  activeDialogId?: string
  /** Open a dialog. */
  onSelectDialog?: (id: string) => void
  /** Request rename — enables the row "Rename chat" action. The host opens
   *  the Rename modal; the list does no inline editing. */
  onRequestRename?: (dialog: DialogItem) => void
  /** Request archive — enables the row "Archive chat" action. The host opens
   *  the Archive confirmation modal. */
  onRequestArchive?: (dialog: DialogItem) => void
  /** Whether more dialogs remain (cursor pagination). */
  hasMore?: boolean
  /** True while the next page is loading. */
  isLoadingMore?: boolean
  /** Fetch the next page — fired when the bottom sentinel scrolls into view. */
  onLoadMore?: () => void
  /** Appended to the root element. */
  className?: string
}

interface DialogGroup {
  key: string
  label: string
  items: DialogItem[]
}

// =============================================================================
// Date grouping — Today / Yesterday / Older
// =============================================================================

function dialogTime(d: DialogItem): number | null {
  if (!d.timestamp) return null
  const t =
    typeof d.timestamp === 'string'
      ? Date.parse(d.timestamp)
      : d.timestamp.getTime()
  return Number.isNaN(t) ? null : t
}

function groupDialogs(dialogs: ReadonlyArray<DialogItem>): DialogGroup[] {
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

  const today: DialogItem[] = []
  const yesterday: DialogItem[] = []
  const older: DialogItem[] = []
  for (const d of dialogs) {
    const t = dialogTime(d)
    if (t !== null && t >= startOfToday) today.push(d)
    else if (t !== null && t >= startOfYesterday) yesterday.push(d)
    else older.push(d) // includes timestamp-less dialogs
  }

  return [
    { key: 'today', label: 'Today', items: today },
    { key: 'yesterday', label: 'Yesterday', items: yesterday },
    { key: 'older', label: 'Older', items: older },
  ].filter((g) => g.items.length > 0)
}

// =============================================================================
// Row
// =============================================================================

interface RowProps {
  dialog: DialogItem
  isActive: boolean
  onSelect?: (id: string) => void
  onRequestRename?: (dialog: DialogItem) => void
  onRequestArchive?: (dialog: DialogItem) => void
}

function MingoChatHistoryRow({
  dialog,
  isActive,
  onSelect,
  onRequestRename,
  onRequestArchive,
}: RowProps) {
  const title = dialog.title || 'Untitled Chat'
  const unread = dialog.unreadMessagesCount ?? 0
  const hasMenu = !!onRequestRename || !!onRequestArchive
  // Keep the `⋯` visible while its menu is open — once Radix moves focus into
  // the portalled content the row loses hover/focus-within.
  const [menuOpen, setMenuOpen] = React.useState(false)

  const menuItems = [
    onRequestRename && {
      label: 'Rename chat',
      onClick: () => onRequestRename(dialog),
    },
    onRequestArchive && {
      label: 'Archive chat',
      onClick: () => onRequestArchive(dialog),
    },
  ].filter(Boolean) as { label: string; onClick: () => void }[]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(dialog.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(dialog.id)
        }
      }}
      className={cn(
        'group/row flex h-12 items-center gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-s)]',
        'bg-ods-bg border-b border-ods-border last:border-b-0',
        'cursor-pointer transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:bg-ods-bg-hover',
        isActive && 'bg-ods-bg-hover',
      )}
    >
      {unread > 0 ? (
        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)] text-h5 text-ods-text-on-accent">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
      <span
        className="min-w-0 flex-1 truncate text-h4 text-ods-text-primary"
        title={title}
      >
        {title}
      </span>
      {hasMenu ? (
        // Stop propagation so opening the menu doesn't also select the dialog.
        // Hidden until the row is hovered/focused (or its menu is open).
        <span
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 transition-opacity',
            menuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100',
          )}
        >
          <MoreActionsMenu
            ariaLabel="Chat actions"
            items={menuItems}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            // Don't return focus (and its ring) to the `⋯` trigger on close.
            onCloseAutoFocus={(e) => e.preventDefault()}
            trigger={
              <button
                type="button"
                aria-label="Chat actions"
                className="flex size-6 items-center justify-center rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
              >
                <Ellipsis01Icon size={24} />
              </button>
            }
          />
        </span>
      ) : null}
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

/**
 * MingoChatHistory — Figma node `7532:223950`.
 *
 * The returning-user variation of the Mingo empty state: the dialog history
 * rendered inline in the main panel, grouped into Today / Yesterday / Older
 * sections. Each row shows an optional unread badge, the title, and a `⋯`
 * menu (Rename / Archive — each gated on the matching handler and surfaced as
 * a request the host fulfils via a modal). Owns its own scroll + bottom/top
 * fade and an infinite-scroll
 * sentinel that fires `onLoadMore`.
 */
export function MingoChatHistory({
  dialogs,
  activeDialogId,
  onSelectDialog,
  onRequestRename,
  onRequestArchive,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: MingoChatHistoryProps) {
  const groups = React.useMemo(() => groupDialogs(dialogs), [dialogs])

  // Scroll-fade affordances (same pattern as MingoWelcome's greeting region).
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [fade, setFade] = React.useState({ top: false, bottom: false })
  const updateFade = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setFade((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }))
  }, [])
  React.useEffect(() => {
    updateFade()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(updateFade)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateFade, dialogs])

  // Infinite scroll — load the next page when the sentinel enters the
  // scroll viewport.
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const onLoadMoreRef = React.useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore
  const isLoadingMoreRef = React.useRef(isLoadingMore)
  isLoadingMoreRef.current = isLoadingMore
  React.useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || !hasMore || typeof IntersectionObserver === 'undefined')
      return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMoreRef.current) {
          onLoadMoreRef.current?.()
        }
      },
      { root, rootMargin: '120px', threshold: 0.1 },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore])

  return (
    <div className={cn('relative flex flex-1 min-h-0 flex-col', className)}>
      <div
        ref={scrollRef}
        onScroll={updateFade}
        className="flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-y-auto"
      >
        {groups.map((group) => (
          <div
            key={group.key}
            className="flex flex-col gap-[var(--spacing-system-xxs)]"
          >
            <p className="text-h5 text-ods-text-secondary">{group.label}</p>
            <div className="overflow-hidden rounded-md border border-ods-border">
              {group.items.map((dialog) => (
                <MingoChatHistoryRow
                  key={dialog.id}
                  dialog={dialog}
                  isActive={dialog.id === activeDialogId}
                  onSelect={onSelectDialog}
                  onRequestRename={onRequestRename}
                  onRequestArchive={onRequestArchive}
                />
              ))}
            </div>
          </div>
        ))}
        {hasMore ? <div ref={sentinelRef} className="h-px shrink-0" /> : null}
      </div>

      {/* Scroll-fade — only while content is hidden in that direction. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-12 transition-opacity duration-150',
          fade.top ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background:
            'linear-gradient(0deg, transparent 0%, var(--color-bg-card) 100%)',
        }}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-12 transition-opacity duration-150',
          fade.bottom ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--color-bg-card) 100%)',
        }}
      />
    </div>
  )
}
