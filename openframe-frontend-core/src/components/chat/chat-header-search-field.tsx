'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { useDebounce } from '../../hooks/ui/use-debounce'
import { SearchIcon } from '../icons-v2-generated'

export interface ChatHeaderSearchFieldProps {
  /** Seeds the field on mount (the current server-side search term). */
  initialValue?: string
  /** Emits the DEBOUNCED term. The host owns the query and refetches the
   *  dialog list server-side — the field never filters locally. */
  onSearchChange: (query: string) => void
  /** Collapse the field back to the title. Fired on Escape and on blur while
   *  the field is empty (an accidental open closes itself). */
  onCollapse?: () => void
  /** Focus the input on mount (default true — the field only mounts when the
   *  user opens search, so we drop them straight into typing). */
  autoFocus?: boolean
  /** Appended to the root element (e.g. to tweak the open animation). */
  className?: string
}

/**
 * Inline chat-header search field (Figma node 116:51217). When search is
 * toggled on, the panel header's title area is REPLACED in place by this
 * full-height field — a leading magnifier + a bare, borderless input — instead
 * of dropping a separate search bar into the list body. Holds its own text for
 * snappy typing and emits the debounced term via `onSearchChange`.
 */
export function ChatHeaderSearchField({
  initialValue,
  onSearchChange,
  onCollapse,
  autoFocus = true,
  className,
}: ChatHeaderSearchFieldProps) {
  const [value, setValue] = React.useState(initialValue ?? '')
  const debounced = useDebounce(value, 300)
  const lastEmitted = React.useRef(initialValue ?? '')

  React.useEffect(() => {
    if (debounced === lastEmitted.current) return
    lastEmitted.current = debounced
    onSearchChange(debounced)
  }, [debounced, onSearchChange])

  // Exit animation: collapsing plays `animate-out` (slide/fade back toward the
  // right) BEFORE the parent unmounts us. We stay mounted through the leave —
  // the parent only drops the field once we call `onCollapse`, which we defer
  // to the animation's end.
  const [exiting, setExiting] = React.useState(false)
  const collapsedRef = React.useRef(false)

  const finishCollapse = React.useCallback(() => {
    if (collapsedRef.current) return
    collapsedRef.current = true
    onCollapse?.()
  }, [onCollapse])

  const beginCollapse = React.useCallback(() => {
    setExiting(true)
  }, [])

  // Fallback for when `animationend` never fires (reduced motion, or the
  // animation utilities are disabled) — otherwise the field would hang open.
  React.useEffect(() => {
    if (!exiting) return
    const t = setTimeout(finishCollapse, 240)
    return () => clearTimeout(t)
  }, [exiting, finishCollapse])

  return (
    <div
      onAnimationEnd={(e) => {
        // Only the root's OWN leave animation collapses — ignore the child
        // icon's animations bubbling up, and the enter animation.
        if (e.target === e.currentTarget && exiting) finishCollapse()
      }}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-sf)]',
        exiting
          ? // Elegant leave: sweep back out to the right + fade, holding the end
            // frame (`fill-mode-forwards`) so it stays hidden until unmount.
            'animate-out fade-out-0 slide-out-to-right-4 duration-200 ease-in fill-mode-forwards pointer-events-none'
          : // Elegant open: sweep in from the right (where the magnifier toggle
            // sat) and fade up as it takes over the title area.
            'animate-in fade-in-0 slide-in-from-right-4 duration-200 ease-out',
        className,
      )}
    >
      {/* The magnifier eases in a touch later + scales up, so the icon reads as
          "growing" into the field rather than hard-cutting in. */}
      <SearchIcon
        size={24}
        className="shrink-0 text-ods-text-secondary animate-in fade-in-0 zoom-in-75 duration-300 ease-out"
      />
      {/* biome-ignore lint/a11y/noAutofocus: the field only mounts on an
          explicit search toggle, so focusing it is the intended behaviour. */}
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        disabled={exiting}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setValue('')
            // Emit the cleared term immediately AND record it as the last emit,
            // so the 300ms debounce effect doesn't fire a second, redundant
            // `onSearchChange('')` (extra server round-trip) before we unmount.
            lastEmitted.current = ''
            onSearchChange('')
            beginCollapse()
          }
        }}
        onBlur={() => {
          // An accidental open (no query typed) collapses itself; a field with
          // an active query stays open so the filtered state stays visible.
          if (!value.trim()) beginCollapse()
        }}
        placeholder="Search for Chats"
        aria-label="Search chats"
        className="min-w-0 flex-1 bg-transparent text-h4 text-ods-text-primary placeholder:text-ods-text-secondary focus:outline-none"
      />
    </div>
  )
}
