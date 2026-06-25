'use client'

/**
 * Shared building blocks for the entity-context picker's ITEMS level
 * (Figma 31:29102). The picker SHELL (root menu, type list, search, Back) lives
 * in `chat-context-picker.tsx`; the per-type DATA is host-owned and rendered
 * via `ChatContextPickerConfig.renderItems`, which returns a `<ContextItemsList>`
 * fed from the host's own hooks (TanStack / react-relay).
 *
 * Row chrome here matches the design-system menu rows (same as `ActionsMenu`):
 * 16px→24px responsive icon, h4 label, border-b, hover surface.
 */

import * as React from 'react'
import { CheckFillIcon } from '../icons-v2-generated/signs-and-symbols/check-fill-icon'
import { Skeleton } from '../ui/skeleton'
import { cn } from '../../utils/cn'
import type { ChatContextItem } from './types/context-item.types'

const itemKey = (i: { type: string; id: string }) => `${i.type}:${i.id}`

// Shared row classes — used by the picker (root / types) and the item rows so
// every level is visually identical and there's one source of truth.
export const CONTEXT_ROW_CLASS =
  'flex w-full items-center gap-2 border-b border-ods-border bg-ods-bg py-3 pl-4 pr-2 text-left outline-none transition-colors last:border-b-0 hover:bg-ods-bg-hover focus-visible:bg-ods-bg-hover [&_svg]:size-4 md:[&_svg]:size-6'
export const CONTEXT_ICON_CLASS =
  'flex size-4 shrink-0 items-center justify-center text-ods-text-secondary md:size-6'
export const CONTEXT_LABEL_CLASS = 'flex-1 truncate text-h4 font-medium leading-6 text-ods-text-primary'
export const CONTEXT_BACK_CLASS =
  'flex shrink-0 items-center gap-2 border-b border-ods-border bg-ods-bg px-2 py-3 text-left text-h4 font-medium leading-6 text-ods-text-secondary outline-none transition-colors hover:text-ods-text-primary [&_svg]:size-4 md:[&_svg]:size-6'
export const CONTEXT_STATE_CLASS = 'bg-ods-bg px-4 py-3 text-h4 text-ods-text-secondary'

// ===========================================================================
// ROW — one menu row (icon + label + optional trailing). Shared primitive.
// ===========================================================================

export interface ContextMenuRowProps {
  /** Lead glyph (entity-type icon). Omit for item rows (label only). */
  icon?: React.ReactNode
  label: React.ReactNode
  /** Trailing slot (e.g. the selected ✓). */
  trailing?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  /** Selected state for `role="option"` rows (aria + caller styling). */
  selected?: boolean
  role?: 'menuitem' | 'option'
  title?: string
}

export function ContextMenuRow({
  icon,
  label,
  trailing,
  onClick,
  disabled = false,
  selected,
  role = 'menuitem',
  title,
}: ContextMenuRowProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? selected : undefined}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(CONTEXT_ROW_CLASS, disabled && 'cursor-not-allowed opacity-40 hover:bg-ods-bg')}
    >
      {icon != null && <span className={CONTEXT_ICON_CLASS}>{icon}</span>}
      <span className={CONTEXT_LABEL_CLASS}>{label}</span>
      {trailing}
    </button>
  )
}

// ===========================================================================
// SKELETON — Suspense fallback (initial load) + inline load-more rows.
// ===========================================================================

export function ContextItemsSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`ctx-skeleton-${i}`}
          className="flex items-center border-b border-ods-border bg-ods-bg py-3 pl-4 pr-2 last:border-b-0"
        >
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </>
  )
}

// ===========================================================================
// LIST — host-fed items + scroll-driven load-more. (Initial load / errors are
// handled by the picker's <Suspense> / error boundary around renderItems.)
// ===========================================================================

export interface ContextItemsListProps {
  items: ChatContextItem[]
  /** Selected keys (`${type}:${id}`) for the ✓ state. */
  selectedKeys: Set<string>
  onToggle: (item: ChatContextItem) => void
  /** Selection cap reached → non-selected rows disabled. */
  atLimit: boolean
  /** Another page is available. */
  hasMore?: boolean
  /** Load the next page (called when the user nears the bottom). */
  onLoadMore?: () => void
  /** A page is currently loading (shows inline skeleton rows). */
  loadingMore?: boolean
  emptyLabel?: string
  className?: string
}

export function ContextItemsList({
  items,
  selectedKeys,
  onToggle,
  atLimit,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  emptyLabel = 'No results',
  className,
}: ContextItemsListProps) {
  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || loadingMore || !onLoadMore) return
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 48) onLoadMore()
    },
    [hasMore, loadingMore, onLoadMore],
  )

  if (items.length === 0 && !loadingMore) {
    return <div className={CONTEXT_STATE_CLASS}>{emptyLabel}</div>
  }

  return (
    <div
      role="listbox"
      aria-label="Items"
      onScroll={onScroll}
      // Cap to 340px but never exceed ~half the viewport, so on short screens the
      // results list (inside the bottom-anchored picker popover) still fits and
      // scrolls instead of overflowing past the top edge.
      className={cn('max-h-[min(340px,45vh)] overflow-y-auto', className)}
    >
      {items.map(item => {
        const selected = selectedKeys.has(itemKey(item))
        return (
          <ContextMenuRow
            key={itemKey(item)}
            role="option"
            selected={selected}
            disabled={!selected && atLimit}
            onClick={() => onToggle(item)}
            label={item.label}
            title={!selected && atLimit ? 'Selection limit reached' : undefined}
            trailing={selected ? <CheckFillIcon className="size-4 shrink-0 text-ods-accent md:size-6" /> : undefined}
          />
        )
      })}
      {loadingMore && <ContextItemsSkeleton count={3} />}
    </div>
  )
}

// ===========================================================================
// ERROR BOUNDARY — catches a failed host items fetch; resets when the
// (type, query) key changes so a new search retries.
// ===========================================================================

export interface ContextErrorBoundaryProps {
  /** Change this (e.g. `type:query`) to clear a previous error and retry. */
  resetKey: string
  /** Error UI. As a render-prop it receives a `retry` callback that clears the
   *  boundary so the children re-mount (pair it with react-query's `reset()` so
   *  the cached suspense error is dropped and the fetch actually re-runs). */
  fallback: React.ReactNode | ((retry: () => void) => React.ReactNode)
  children: React.ReactNode
}

export class ContextErrorBoundary extends React.Component<ContextErrorBoundaryProps, { errored: boolean }> {
  state = { errored: false }

  static getDerivedStateFromError() {
    return { errored: true }
  }

  componentDidUpdate(prev: ContextErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.errored) {
      this.setState({ errored: false })
    }
  }

  private retry = () => {
    if (this.state.errored) this.setState({ errored: false })
  }

  render() {
    if (!this.state.errored) return this.props.children
    return typeof this.props.fallback === 'function' ? this.props.fallback(this.retry) : this.props.fallback
  }
}
