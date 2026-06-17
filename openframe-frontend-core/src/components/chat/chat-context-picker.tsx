'use client'

/**
 * Entity-context picker for the chat composer (Figma nodes 31:28312 /
 * 31:28708 / 31:28709 / 1:5699). Three pieces, all driven by the host's
 * `ChatContextPickerConfig`:
 *
 *   1. `<ChatComposerPlusMenu>` — the `+` button → small menu
 *      (Upload File / Assign Item). "Assign Item" opens the picker.
 *   2. `<ChatContextPicker>` — the two-level popover, rendered ABOVE the
 *      input (same `absolute bottom-full` placement as the slash-command
 *      suggestions). Level 1 = entity-type list; level 2 = a searchable
 *      multi-select of that type's items, with a ✓ on the chosen ones.
 *   3. `<ChatContextChipStrip>` — the removable selected-item chips,
 *      rendered above the input (mirrors `ChatAttachmentChipStrip`).
 *
 * The library owns ONLY the UI + selection state plumbing. Every item comes
 * from the host's `config.search(type, query, signal)` resolver — the lib
 * never knows a device from a script. All colors are ODS tokens.
 */

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon'
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon'
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon'
import { SearchIcon } from '../icons-v2-generated/interface/search-icon'
import { Upload02Icon } from '../icons-v2-generated/interface/upload-02-icon'
import { PackagePlusIcon } from '../icons-v2-generated/coding/package-plus-icon'
import { cn } from '../../utils/cn'
import {
  CONTEXT_BACK_CLASS,
  CONTEXT_STATE_CLASS,
  ContextErrorBoundary,
  ContextItemsSkeleton,
  ContextMenuRow,
} from './context-items-list'
import type {
  ChatContextEntityType,
  ChatContextItem,
  ChatContextPickerConfig,
} from './types/context-item.types'

/** Default ceiling on selected context items (Figma spec). */
export const CHAT_CONTEXT_ITEMS_DEFAULT_MAX = 10

/** Skeleton row count for the items Suspense fallback. */
const ITEMS_SKELETON_ROWS = 10

/** Debounce (ms) before the typed query is handed to `renderItems`. */
const SEARCH_DEBOUNCE_MS = 300

const itemKey = (item: { type: string; id: string }) => `${item.type}:${item.id}`

// ===========================================================================
// `+` TRIGGER — opens the single context dropdown (Figma node 31:28275)
// ===========================================================================

export interface ChatComposerPlusMenuProps {
  /** Toggle the entity-context picker open/closed. */
  onToggle: () => void
  /** Whether the picker is currently open (drives the lit/yellow state). */
  open?: boolean
  /** Disable the trigger (e.g. while streaming). */
  disabled?: boolean
  /** The context dropdown — rendered anchored to THIS button (so the popover
   *  aligns to the `+`, not the whole input). Pass `<ChatContextPicker>`. */
  dropdown?: React.ReactNode
}

/**
 * The composer `+` button (Figma node 31:28275 — sits INSIDE the input as a
 * start adornment). Per the Figma annotation on 31:28312 ("don't show for
 * first version — show dropdown with item types"), there is NO intermediate
 * "Upload File / Assign Item" menu: the `+` opens the single `ChatContextPicker`
 * dropdown (type list → searchable items) directly.
 *
 * The 24×24 glyph is grey at rest, WHITE on hover of the glyph itself, and
 * accent-yellow while pressed or while the dropdown is open. `data-context-
 * trigger` lets the picker's outside-click handler ignore clicks on this button
 * so toggling works cleanly.
 */
export function ChatComposerPlusMenu({
  onToggle,
  open = false,
  disabled = false,
  dropdown,
}: ChatComposerPlusMenuProps) {
  return (
    // `relative` so the dropdown anchors to the button itself (bottom-full),
    // aligning the popover to the `+` rather than the input row.
    <span className="relative inline-flex">
      <button
        type="button"
        data-context-trigger=""
        disabled={disabled}
        aria-label="Add context"
        aria-expanded={open}
        title="Add context"
        onClick={onToggle}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors outline-none',
          open
            ? 'text-ods-accent'
            : 'text-ods-text-secondary hover:text-ods-text-primary active:text-ods-accent',
          'focus-visible:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <PlusIcon className="h-6 w-6" />
      </button>
      {dropdown}
    </span>
  )
}

// ===========================================================================
// PICKER — two-level popover (Figma nodes 31:28708 / 31:28709)
// ===========================================================================

export interface ChatContextPickerProps {
  /** When false the popover renders nothing. */
  open: boolean
  config: ChatContextPickerConfig
  /** Currently-selected items (drives the ✓ state in the list). */
  selectedItems: ChatContextItem[]
  /** Toggle an item in/out of the selection. */
  onToggleItem: (item: ChatContextItem) => void
  /** Close the popover (Escape, outside-click, header X). */
  onClose: () => void
  /**
   * Query seeded from the `@`-mention trigger. Filters the entity-type list
   * while the picker sits on level 1; consumed when a type is opened.
   */
  mentionQuery?: string | null
  className?: string
}

// Single dropdown, three nested levels (Figma 31:28312 → 31:28708 → 31:29102):
//   root  = Upload File / Assign Item
//   types = Back + entity-type list
//   items = Back + search + selectable items
type PickerView = 'root' | 'types' | 'items'

export function ChatContextPicker({
  open,
  config,
  selectedItems,
  onToggleItem,
  onClose,
  mentionQuery,
  className,
}: ChatContextPickerProps) {
  const [view, setView] = useState<PickerView>('root')
  const [activeType, setActiveType] = useState<ChatContextEntityType | null>(null)
  const [query, setQuery] = useState('') // immediate search-field value
  const [debouncedQuery, setDebouncedQuery] = useState('') // handed to renderItems

  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const maxItems = config.maxItems ?? CHAT_CONTEXT_ITEMS_DEFAULT_MAX
  const atLimit = selectedItems.length >= maxItems

  const selectedKeys = useMemo(() => new Set(selectedItems.map(itemKey)), [selectedItems])

  // Reset on open AND close (close pre-resets so the next open's first paint is
  // the initial view, not the stale level — avoids a flash).
  useEffect(() => {
    setView(open && mentionQuery != null ? 'types' : 'root')
    setActiveType(null)
    setQuery('')
    setDebouncedQuery('')
  }, [open])

  // If `@` starts filtering while still on the root menu, drill into the types.
  useEffect(() => {
    if (open && mentionQuery != null && view === 'root') setView('types')
  }, [open, mentionQuery, view])

  // Outside-click + Escape close. Registered only while open.
  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      // Ignore clicks on the `+` trigger — it owns the open/close toggle.
      if (rootRef.current?.contains(target) || target?.closest?.('[data-context-trigger]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open, onClose])

  // Focus the search field when entering the items view.
  useEffect(() => {
    if (open && view === 'items') {
      const id = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open, view])

  // Debounce the typed query before handing it to the host's `renderItems`
  // (which keys its hooks on it) — keeps the data layer off every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const openType = useCallback((type: ChatContextEntityType) => {
    setActiveType(type)
    setQuery('')
    setDebouncedQuery('')
    setView('items')
  }, [])

  const backToTypes = useCallback(() => {
    setActiveType(null)
    setQuery('')
    setDebouncedQuery('')
    setView('types')
  }, [])

  // Filter the type list by the `@`-mention query (level 1 only).
  const typeFilter = (mentionQuery ?? '').trim().toLowerCase()
  const visibleTypes = useMemo(
    () =>
      typeFilter
        ? config.entityTypes.filter((t) => t.label.toLowerCase().includes(typeFilter))
        : config.entityTypes,
    [config.entityTypes, typeFilter],
  )

  if (!open) return null

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Add context"
      className={cn(
        // Anchored to the `+` button (its `relative` parent): left edge aligns
        // to the button, `bottom-full` floats it just above with a 4px gap.
        // No height cap here — the root menu and the full entity-type list show
        // in full; only the search RESULTS list is capped + scrolled (below).
        'absolute bottom-full left-0 z-50 mb-1 flex w-[320px] max-w-[90vw] flex-col overflow-hidden',
        // Mirror `DropdownMenuContent` chrome (border / card bg / shadow-md).
        'rounded-md border border-ods-border bg-ods-card text-ods-text-primary shadow-md',
        className,
      )}
      // Keep textarea focus from being stolen on internal pointer interactions
      // that aren't real selections (e.g. scrollbar drags).
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {view === 'root' ? (
        /* Level 0 — Upload File / Assign Item (Figma 31:28312). */
        <div role="menu" aria-label="Add context">
          {config.onUploadFile && (
            <ContextMenuRow
              icon={<Upload02Icon size={24} />}
              label="Upload File"
              onClick={() => config.onUploadFile?.()}
            />
          )}
          <ContextMenuRow icon={<PackagePlusIcon size={24} />} label="Assign Item" onClick={() => setView('types')} />
        </div>
      ) : view === 'types' ? (
        /* Level 1 — Back + entity-type list (Figma 31:28708). Shown in full. */
        <div role="menu" aria-label="Context types" className="flex flex-col">
          <button type="button" onClick={() => setView('root')} className={CONTEXT_BACK_CLASS}>
            <Chevron02LeftIcon size={24} className="shrink-0" />
            <span className="truncate">Back</span>
          </button>
          {visibleTypes.length === 0 ? (
            <div className={CONTEXT_STATE_CLASS}>No matching types</div>
          ) : (
            visibleTypes.map((type) => (
              <ContextMenuRow key={type.type} icon={type.icon} label={type.label} onClick={() => openType(type)} />
            ))
          )}
        </div>
      ) : activeType ? (
        /* Level 2 — Back + search + HOST-rendered items (Figma 31:29102). */
        <>
          <button type="button" onClick={backToTypes} className={CONTEXT_BACK_CLASS}>
            <Chevron02LeftIcon size={24} className="shrink-0" />
            <span className="truncate">Back</span>
          </button>

          <div className="flex shrink-0 items-center gap-2 border-b border-ods-border bg-ods-card p-3">
            <SearchIcon className="size-4 shrink-0 text-ods-text-secondary md:size-6" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search for ${activeType.label}`}
              className="min-w-0 flex-1 bg-transparent text-h4 font-medium leading-6 text-ods-text-primary outline-none placeholder:text-ods-text-secondary"
            />
          </div>

          {/* Items are HOST-rendered (data via the host's own hooks → a
              `<ContextItemsList>`). Initial load → Suspense skeleton; a failed
              fetch → the error row with a Retry. The boundary resets when
              type/query changes; Retry also resets react-query's cached suspense
              error (`reset()`) so re-opening the SAME type+query refetches. */}
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ContextErrorBoundary
                resetKey={`${activeType.type}:${debouncedQuery}`}
                fallback={retry => (
                  <div className="flex items-center justify-between gap-2 bg-ods-bg px-4 py-3 text-h4 text-ods-attention-red-error">
                    <span>Failed to load</span>
                    <button
                      type="button"
                      onClick={() => {
                        reset()
                        retry()
                      }}
                      className="shrink-0 underline outline-none hover:text-ods-text-primary focus-visible:text-ods-text-primary"
                    >
                      Retry
                    </button>
                  </div>
                )}
              >
                <Suspense
                  fallback={
                    <div className="max-h-[340px] overflow-hidden">
                      <ContextItemsSkeleton count={ITEMS_SKELETON_ROWS} />
                    </div>
                  }
                >
                  {config.renderItems({
                    type: activeType.type,
                    query: debouncedQuery,
                    selectedKeys,
                    onToggle: onToggleItem,
                    atLimit,
                  })}
                </Suspense>
              </ContextErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </>
      ) : null}
    </div>
  )
}

// ===========================================================================
// CHIP STRIP — selected items above the input (Figma node 1:5699)
// ===========================================================================

export interface ChatContextChipStripProps {
  items: ChatContextItem[]
  /** Remove handler. When omitted the chips are read-only (message bubble). */
  onRemove?: (item: ChatContextItem) => void
  /** Lead icon resolver, e.g. the entity-type icon. Optional. */
  resolveIcon?: (item: ChatContextItem) => React.ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Horizontal strip of selected-context chips. Returns `null` when empty — no
 * permanent footprint. Used both in the composer (removable) and on the sent
 * user bubble (read-only, no `onRemove`).
 */
export function ChatContextChipStrip({
  items,
  onRemove,
  resolveIcon,
  disabled = false,
  className,
}: ChatContextChipStripProps) {
  if (items.length === 0) return null
  return (
    // `tag` pills (Figma 1:6073): 32px tall, card surface, bordered, mono-
    // uppercase label, 16px lead icon + xmark-circle remove. Wraps to new rows.
    <div className={cn('flex flex-wrap content-center items-center gap-2', className)}>
      {items.map((item) => (
        <div
          key={itemKey(item)}
          className="flex h-8 shrink-0 items-center gap-2 rounded-md border border-ods-border bg-ods-card px-2"
          role="group"
          aria-label={`Context ${item.label}`}
        >
          {resolveIcon && (
            <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary [&_svg]:size-4">
              {resolveIcon(item)}
            </span>
          )}
          <span
            className="max-w-[220px] truncate font-mono text-h5 font-medium uppercase tracking-[-0.28px] text-ods-text-primary"
            title={item.label}
          >
            {item.label}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={disabled}
              aria-label={`Remove ${item.label}`}
              className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary outline-none transition-colors hover:text-ods-text-primary focus-visible:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4"
            >
              <XmarkCircleIcon size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
