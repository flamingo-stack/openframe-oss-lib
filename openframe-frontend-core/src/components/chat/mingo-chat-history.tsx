'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu'
import { Button } from '../ui/button'
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade'
import { SquareAvatar } from '../ui/square-avatar'
import { Ellipsis01Icon, SearchXmarkIcon } from '../icons-v2-generated'
import { ChatListEmptyState } from './chat-list-empty-state'
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
  /** Current server-side search term. Drives the "No chats found" empty state;
   *  the search INPUT lives in the panel header, not in this list. The host
   *  owns the term and refetches server-side — the list does no filtering. */
  searchQuery?: string
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
  const owner = dialog.owner
  const hasAvatar = !!(owner?.name || owner?.avatarUrl)
  // Keep the `⋯` visible while its menu is open — once Radix moves focus into
  // the portalled content the row loses hover/focus-within.
  const [menuOpen, setMenuOpen] = React.useState(false)

  const menuItems = [
    onRequestRename && {
      id: 'rename',
      label: 'Rename chat',
      onClick: () => onRequestRename(dialog),
    },
    onRequestArchive && {
      id: 'archive',
      label: 'Archive chat',
      onClick: () => onRequestArchive(dialog),
    },
  ].filter(Boolean) as ActionsMenuItem[]

  // The item is the full-width row (inside the group's bordered box). Padding
  // lives on the inner content button (badge + title) only — the `⋯` is a
  // SIBLING of that padded content, so it sits at the item's right edge, inside
  // the item but outside its padded content area.
  return (
    <div
      className={cn(
        'group/row relative flex h-12 items-center border-b border-ods-border last:border-b-0 transition-colors',
        // Active (selected) dialog — Figma 259:91610: an open-yellow-secondary
        // fill, a 4px open-yellow accent bar down the leading edge, and yellow
        // title text. Inactive rows keep the dark surface with a hover tint.
        isActive
          ? 'bg-ods-open-yellow-secondary'
          : 'bg-ods-bg hover:bg-ods-bg-hover',
      )}
    >
      {isActive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-ods-open-yellow"
        />
      ) : null}
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
        className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-s)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent"
      >
        {unread > 0 ? (
          <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)] text-h5 text-ods-text-on-accent">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-h4',
            isActive ? 'text-ods-open-yellow' : 'text-ods-text-primary',
          )}
          title={title}
        >
          {title}
        </span>
      </div>
      {hasMenu || hasAvatar ? (
        // Trailing 48px cell (Figma 113:63224): the owner avatar sits centred
        // by default; hovering the row (or opening the menu) swaps it for the
        // `⋯` actions button IN PLACE, so the title never reflows. Without an
        // avatar the cell exists only for the hover menu, so it collapses on
        // mobile exactly like the old hover-only gutter (no hover on touch).
        <span
          className={cn(
            'relative w-12 self-stretch shrink-0',
            !hasAvatar && 'max-md:hidden',
          )}
        >
          {hasMenu ? (
            // Revealed on row hover/its own focus; kept visible while the menu
            // is open. Hidden on mobile — it's a hover affordance. `peer/menu`
            // so the avatar layer (a later sibling) can fade when the trigger
            // holds keyboard focus.
            <span
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'peer/menu absolute inset-0 transition-opacity max-md:hidden',
                menuOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100',
              )}
            >
              <ActionsMenuDropdown
                triggerAriaLabel="Chat actions"
                groups={[{ items: menuItems }]}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                // Don't return focus (and its ring) to the `⋯` trigger on close.
                onCloseAutoFocus={(e) => e.preventDefault()}
                customTrigger={
                  <Button
                    variant="transparent"
                    size="icon"
                    aria-label="Chat actions"
                    // Square, grey icon → white on hover. `h-full`/`w-full` fill
                    // the 48px cell exactly (no breakpoint poke from
                    // `size="icon"`'s responsive `md:h-12`); `p-0` drops the
                    // icon-size padding. tailwind-merge so these win over
                    // defaults.
                    className="h-full md:h-full w-full rounded-none p-0 text-ods-text-secondary hover:text-ods-text-primary"
                  >
                    <Ellipsis01Icon />
                  </Button>
                }
              />
            </span>
          ) : null}
          {hasAvatar ? (
            // Avatar layer — clicks fall through to row selection (it covers
            // the cell whenever the menu trigger is faded out). On desktop it
            // fades for the menu swap; on mobile it's always shown.
            <span
              onClick={() => onSelect?.(dialog.id)}
              title={owner?.name || undefined}
              className={cn(
                'absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity',
                hasMenu &&
                  (menuOpen
                    ? 'opacity-0 pointer-events-none'
                    : 'md:group-hover/row:opacity-0 md:group-hover/row:pointer-events-none md:peer-[:focus-within]/menu:opacity-0 md:peer-[:focus-within]/menu:pointer-events-none'),
              )}
            >
              <SquareAvatar
                variant="round"
                sizePx={24}
                src={owner?.avatarUrl || undefined}
                alt={owner?.name || undefined}
                fallback={owner?.name || undefined}
                initialsClassName="text-[10px] text-ods-text-secondary"
              />
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

/**
 * Loading placeholder for the dialog history, shaped like the grouped row list
 * above. Shown while the FIRST page of dialogs is in flight so the Mingo empty
 * state doesn't flash the new-user greeting+grid before the list arrives (the
 * two layouts are mutually exclusive — swapping between them mid-load reads as
 * a flicker). Pure ODS tokens, `animate-pulse`.
 */
export function MingoChatHistorySkeleton({
  className,
}: {
  className?: string
}) {
  // Mirror the real grouped list exactly: a small group label, then a bordered
  // rounded container of `h-12` rows, each with a single title bar of varying
  // width (no unread-badge squares — the real rows currently never show one, so
  // a badge placeholder would mis-promise the layout). `bg-ods-border` matches
  // the kit's canonical `Skeleton` placeholder colour; `bg-ods-bg` rows read a
  // touch darker than the `bg-ods-card` panel so the bars stay legible.
  const groups: ReadonlyArray<ReadonlyArray<string>> = [
    ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4'],
    ['w-1/2', 'w-2/3'],
  ]
  return (
    <div
      aria-hidden
      // `overflow-hidden` clips the placeholder rows to the flex-1 box (the real
      // list scrolls; the skeleton just needs to stay within bounds).
      className={cn(
        'flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-hidden',
        className,
      )}
    >
      {groups.map((widths, g) => (
        <div key={g} className="flex shrink-0 flex-col gap-[var(--spacing-system-xxs)]">
          {/* Group label (Today / Older). */}
          <div className="h-3 w-16 animate-pulse rounded bg-ods-border" />
          <div className="overflow-hidden rounded-md border border-ods-border">
            {widths.map((w, i) => (
              <div
                key={i}
                className="flex h-12 items-center bg-ods-bg border-b border-ods-border px-[var(--spacing-system-s)] last:border-b-0"
              >
                <div className={cn('h-4 animate-pulse rounded bg-ods-border', w)} />
              </div>
            ))}
          </div>
        </div>
      ))}
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
  searchQuery,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: MingoChatHistoryProps) {
  const groups = React.useMemo(() => groupDialogs(dialogs), [dialogs])
  const noSearchResults = groups.length === 0 && !!searchQuery?.trim()

  // Scroll-fade affordances — shared ui/scroll-fade (re-measures on resize
  // and content mutations, so no manual `dialogs` dependency is needed).
  const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>()

  // Infinite scroll — load the next page when the sentinel enters the
  // scroll viewport.
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const onLoadMoreRef = React.useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore
  const isLoadingMoreRef = React.useRef(isLoadingMore)
  isLoadingMoreRef.current = isLoadingMore
  const dialogCount = dialogs.length
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
    // `dialogCount`/`isLoadingMore` deps re-arm the observer after every page
    // lands: `observe()` re-reports the CURRENT intersection, so a sentinel
    // that stays in view (short host-filtered list — e.g. the "My Chats"
    // scope keeps a handful of rows out of a 20-row page) keeps chaining
    // loads until the viewport fills or `hasMore` flips. A continuously
    // visible sentinel never re-crosses the threshold, so the previous
    // [hasMore]-only observer fired exactly once per mount and the list
    // grew by a single page per drawer open.
  }, [hasMore, isLoadingMore, dialogCount])

  return (
    <div className={cn('relative flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)]', className)}>
      {/* Scroll region — the search INPUT now lives in the panel header
          (Figma 116:51217), so the list is just the grouped rows + fades. */}
      <div className="relative flex flex-1 min-h-0 flex-col">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-y-auto overscroll-contain"
        >
          {noSearchResults ? (
            // No search matches — same centred glyph + title + caption layout as
            // the other chat-list empty states (Figma 113:60939).
            <ChatListEmptyState
              icon={<SearchXmarkIcon size={24} />}
              title="No Chats Found"
              description="Try a different search term"
            />
          ) : (
            groups.map((group) => (
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
            ))
          )}
          {hasMore ? <div ref={sentinelRef} className="h-px shrink-0" /> : null}
        </div>

        {/* Scroll-fade — only while content is hidden in that direction. */}
        <ScrollFadeOverlay edge="top" visible={fadeTop} color="var(--color-bg-card)" className="h-12" />
        <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color="var(--color-bg-card)" className="h-12" />
      </div>
    </div>
  )
}
