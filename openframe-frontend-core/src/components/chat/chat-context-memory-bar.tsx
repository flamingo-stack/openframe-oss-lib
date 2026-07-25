'use client'

/**
 * `<ChatContextMemoryBar>` — the composer's CONTEXT MEMORY strip
 * (Figma node 271:38656).
 *
 * A one-line summary row pinned to the top of the composer card ("5 recently
 * viewed items in context") with a `⋯` trigger that opens a dropdown listing
 * every remembered entity, each removable via its `×`.
 *
 * This is the AMBIENT half of the composer's context UI — the entities the host
 * accumulated from the user's navigation history and sends along with every
 * message — as opposed to `<ChatContextChipStrip>`, which shows the items the
 * user ASSIGNED to the message they're typing. Both sit above the input; memory
 * on top (passive, always the same items), assigned chips closest to the
 * textarea (active selection for this message).
 *
 * The lib owns only the chrome: items and removal are host-fed
 * (`EmbeddableChat`'s `contextMemory` prop), and lead glyphs come from the
 * picker's entity-type icon map via `resolveIcon`. Renders `null` when the host
 * has nothing remembered, so it has no permanent footprint.
 */

import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Ellipsis01Icon } from '../icons-v2-generated/interface/ellipsis-01-icon'
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon'
import { cn } from '../../utils/cn'
import { CONTEXT_ICON_CLASS, CONTEXT_LABEL_CLASS, CONTEXT_ROW_CLASS } from './context-items-list'
import type { ChatContextItem } from './types/context-item.types'

const itemKey = (item: { type: string; id: string }) => `${item.type}:${item.id}`

export interface ChatContextMemoryBarProps {
  /** Remembered entities, most-recent-first. Empty → the bar renders nothing. */
  items: ChatContextItem[]
  /** Drop one entity from the host's memory (dropdown row `×`). When omitted the
   *  list is read-only. */
  onRemove?: (item: ChatContextItem) => void
  /** Lead-glyph resolver — the composer passes its entity-type icon map, so the
   *  rows match the picker and the assigned chips. */
  resolveIcon?: (item: ChatContextItem) => React.ReactNode
  /** External disable (e.g. while a message is streaming). */
  disabled?: boolean
  className?: string
}

export function ChatContextMemoryBar({
  items,
  onRemove,
  resolveIcon,
  disabled = false,
  className,
}: ChatContextMemoryBarProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Removing the last remembered entity unmounts the bar; close first so a
  // stale popover can't outlive its trigger.
  useEffect(() => {
    if (items.length === 0) setOpen(false)
  }, [items.length])

  // Outside-press close. Registered only while open. The root wraps BOTH the
  // trigger and the popover, so a press on the `⋯` (inside root) is ignored here
  // and handled by the button's own toggle.
  //
  // CAPTURE phase (the `true` 3rd arg): the chat lives inside a resizable drawer
  // whose panel captures pointer events and whose composer sits on a
  // `contentEditable`; a bubble-phase `document` listener can be pre-empted by
  // an ancestor's `stopPropagation`, which is why a press outside the popover
  // wasn't closing it. Capture runs top-down before any of that, so the handler
  // always fires. `touchstart` covers tap-to-dismiss on touch devices.
  useEffect(() => {
    if (!open) return
    const onOutside = (e: Event) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('touchstart', onOutside, true)
    return () => {
      document.removeEventListener('mousedown', onOutside, true)
      document.removeEventListener('touchstart', onOutside, true)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    // `relative` anchors the popover to this strip; `bottom-full` floats it
    // above, matching the context picker's placement over the input.
    <div
      ref={rootRef}
      className={cn(
        'relative flex items-center gap-[var(--spacing-system-xs)] border-b border-ods-border bg-ods-bg p-[var(--spacing-system-xs)]',
        className,
      )}
      onKeyDown={e => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          setOpen(false)
        }
      }}
    >
      <p className="min-w-0 flex-1 truncate text-h6 text-ods-text-secondary">
        {items.length} recently viewed {items.length === 1 ? 'item' : 'items'} in context
      </p>

      <button
        type="button"
        aria-label="Show remembered context"
        aria-expanded={open}
        title="Show remembered context"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded outline-none transition-colors [&_svg]:size-4',
          open ? 'text-ods-text-primary' : 'text-ods-text-secondary hover:text-ods-text-primary',
          'focus-visible:text-ods-text-primary',
        )}
      >
        <Ellipsis01Icon size={16} />
      </button>

      {open && (
        <div
          role="list"
          aria-label="Remembered context"
          // Mirrors `ChatContextPicker`'s popover chrome (border / card bg /
          // shadow-md) and its scroll cap, so both dropdowns over the composer
          // read as one component family.
          className="absolute bottom-full right-0 z-50 mb-1 max-h-[min(340px,45vh)] w-[320px] max-w-[90vw] overflow-y-auto overscroll-contain rounded-md border border-ods-border bg-ods-card text-ods-text-primary shadow-md"
        >
          {items.map(item => (
            // Not a `<button>`: the row itself is inert (only the `×` acts), so
            // the remove control isn't nested inside another button.
            <div key={itemKey(item)} role="listitem" className={CONTEXT_ROW_CLASS}>
              {resolveIcon && <span className={CONTEXT_ICON_CLASS}>{resolveIcon(item)}</span>}
              <span className={CONTEXT_LABEL_CLASS} title={item.label}>
                {item.label}
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  disabled={disabled}
                  aria-label={`Remove ${item.label} from context`}
                  className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary outline-none transition-colors hover:text-ods-text-primary focus-visible:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-40 md:size-6"
                >
                  <XmarkCircleIcon className="size-4 shrink-0 md:size-6" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
