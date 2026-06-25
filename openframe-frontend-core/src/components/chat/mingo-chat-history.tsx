'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { useDebounce } from '../../hooks/ui/use-debounce'
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Ellipsis01Icon, SearchIcon } from '../icons-v2-generated'
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
  /** Seed value for the search input. The host owns the search term and refetches
   *  the dialog list server-side; the list itself does no filtering. */
  searchQuery?: string
  /** Emit the (debounced) search term — enables the dialog search bar above the
   *  list. Omit to hide the search bar entirely. */
  onSearchChange?: (query: string) => void
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
        'group/row flex h-12 items-center bg-ods-bg border-b border-ods-border last:border-b-0',
        'transition-colors hover:bg-ods-bg-hover',
        isActive && 'bg-ods-bg-hover',
      )}
    >
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
        className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-s)] cursor-pointer focus:outline-none focus-visible:bg-ods-bg-hover"
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
      </div>
      {hasMenu ? (
        // Sibling of the padded content (not inside it): sits at the item's
        // right edge, free of the content's left padding. Revealed on row
        // hover/focus; kept visible while its menu is open. Hidden on mobile —
        // it's a hover affordance (no hover on touch).
        <span
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // `self-stretch` so the wrapper fills the row height — gives the
            // button's `h-full` a definite parent to resolve against (under the
            // row's `items-center` the wrapper would otherwise collapse to its
            // content and `h-full` on the button would no-op).
            'self-stretch shrink-0 transition-opacity max-md:hidden',
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
                // Square, grey icon → white on hover. `h-full` matches the row
                // height exactly (no breakpoint poke from `size="icon"`'s
                // responsive `md:h-12`); `w-9` keeps it compact; `p-0` drops the
                // icon-size padding. tailwind-merge so these win over defaults.
                className="h-full md:h-full rounded-none p-0 text-ods-text-secondary hover:text-ods-text-primary"
              >
                <Ellipsis01Icon />
              </Button>
            }
          />
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
  searchable = false,
}: {
  className?: string
  /** Render a search-bar placeholder above the groups — match the real list,
   *  which shows the search bar only when search is wired. */
  searchable?: boolean
}) {
  // Mirror the real grouped list: a group label, then a bordered container of
  // `h-12` rows. `withBadge` adds the leading unread-badge square on the first
  // N rows; `widths` varies the title-bar length so the placeholder reads like
  // a list of differing-length chat titles, not identical bars. `bg-ods-border`
  // (not `bg-ods-bg-secondary`) so the placeholders are actually visible on the
  // dark surface.
  const groups: ReadonlyArray<{ withBadge: number; widths: ReadonlyArray<string> }> = [
    { withBadge: 2, widths: ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4'] },
    { withBadge: 0, widths: ['w-1/2', 'w-3/5', 'w-2/3'] },
  ]
  return (
    <div
      aria-hidden
      // `overflow-hidden` clips the placeholder rows to the flex-1 box (the real
      // list scrolls; the skeleton just needs to stay within bounds). Without it
      // the rows bleed past their allotment and render under the pinned composer
      // — which has no surface of its own — so the input appears to overlap them.
      className={cn(
        'flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-hidden',
        className,
      )}
    >
      {/* Search-bar placeholder — mirrors the real `Input` (border, rounded,
          h-11/12) with a leading icon + text bar so the loading state matches
          the searchable layout. */}
      {searchable && (
        <div className="flex h-11 md:h-12 shrink-0 items-center gap-2 rounded-[6px] border border-ods-border bg-ods-card px-3">
          <div className="size-4 md:size-6 shrink-0 animate-pulse rounded bg-ods-border" />
          <div className="h-4 w-32 animate-pulse rounded bg-ods-border" />
        </div>
      )}
      {groups.map((group, g) => (
        <div key={g} className="flex shrink-0 flex-col gap-[var(--spacing-system-xxs)]">
          {/* Group label (Today / Yesterday). */}
          <div className="h-3 w-16 animate-pulse rounded bg-ods-border" />
          <div className="overflow-hidden rounded-md border border-ods-border">
            {group.widths.map((w, i) => (
              <div
                key={i}
                // Match the real row surface: `bg-ods-bg` (#161616) sits darker
                // than the `bg-ods-card` (#212121) panel, which is what makes
                // the `bg-ods-border` (#3a3a3a) placeholders read clearly. On
                // the bare card they'd be muddy (too close in value).
                className="flex h-12 items-center gap-[var(--spacing-system-xsf)] bg-ods-bg border-b border-ods-border px-[var(--spacing-system-s)] last:border-b-0"
              >
                {i < group.withBadge && (
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-ods-border" />
                )}
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
// Search bar
// =============================================================================

/**
 * Dialog search field. Holds its own input text for snappy typing and emits 
 * the DEBOUNCED term via `onSearchChange` — the host owns the search state 
 * and refetches the dialog list server-side, so the list never
 * filters locally. `initialValue` only seeds the field on mount.
 */
function DialogSearchBar({
  initialValue,
  onSearchChange,
}: {
  initialValue?: string
  onSearchChange: (query: string) => void
}) {
  const [value, setValue] = React.useState(initialValue ?? '')
  const debounced = useDebounce(value, 300)
  const lastEmitted = React.useRef(initialValue ?? '')

  React.useEffect(() => {
    if (debounced === lastEmitted.current) return
    lastEmitted.current = debounced
    onSearchChange(debounced)
  }, [debounced, onSearchChange])

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search for Chats"
      aria-label="Search chats"
      startAdornment={<SearchIcon />}
      className="shrink-0"
    />
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
  onSearchChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className,
}: MingoChatHistoryProps) {
  const groups = React.useMemo(() => groupDialogs(dialogs), [dialogs])
  const noSearchResults = groups.length === 0 && !!searchQuery?.trim()

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
    <div className={cn('relative flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)]', className)}>
      {/* Pinned search bar — stays put while the grouped list scrolls below. */}
      {onSearchChange ? (
        <DialogSearchBar initialValue={searchQuery} onSearchChange={onSearchChange} />
      ) : null}

      {/* Scroll region — `relative` so the fades anchor here (below the search
          bar), not over it. */}
      <div className="relative flex flex-1 min-h-0 flex-col">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-y-auto"
        >
          {noSearchResults ? (
            <p className="py-[var(--spacing-system-m)] text-center text-h5 text-ods-text-secondary">
              No chats found
            </p>
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
    </div>
  )
}
