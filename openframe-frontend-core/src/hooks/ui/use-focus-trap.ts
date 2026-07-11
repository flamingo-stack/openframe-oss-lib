'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface UseFocusTrapOptions {
  /** Called when Escape is pressed while focus is inside the container.
   *  When omitted, Escape passes through untouched so document-level
   *  listeners still fire. */
  onEscape?: () => void
  /**
   * When false, Tab/Shift+Tab are NOT cycled within the container — for
   * non-modal dialogs (e.g. SlidingSidebar, whose z-50 header stays clickable
   * above the open drawer). Escape / initial focus / guarded restore still apply.
   * @default true
   */
  contain?: boolean
}

/**
 * Focus management for overlay surfaces (mobile nav panel, sliding sidebar,
 * burger menu, modals): initial focus on activate, container-scoped Tab
 * cycling + Escape, and guarded focus restore on deactivate.
 *
 * CONTRACT: the container element MUST have `tabIndex={-1}`. After a
 * click/tap on a non-focusable area inside the surface, browsers move focus
 * to the nearest focusable ancestor — with the container script-focusable
 * that ancestor is the container itself, so this keydown listener keeps
 * hearing Escape/Tab. Without it, focus falls to `body` and the trap goes
 * deaf.
 *
 * The listener being container-scoped makes it stacking-safe: it only fires
 * while focus is inside the surface, so a modal open above never leaks its
 * Escape into the surface below.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  { onEscape, contain = true }: UseFocusTrapOptions = {}
): void {
  // Latest-ref so unstable inline callbacks never tear the trap down and
  // re-yank focus — same stable-callback discipline as `useCloseOnNavigation`.
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => el.getClientRects().length > 0)

    const first = focusables()[0]
    ;(first ?? container).focus({ preventScroll: true })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // No preventDefault/stopPropagation — pass-through by design.
        onEscapeRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !contain) return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        container.focus({ preventScroll: true })
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const current = document.activeElement
      if (e.shiftKey && (current === firstEl || current === container)) {
        e.preventDefault()
        lastEl.focus({ preventScroll: true })
      } else if (!e.shiftKey && current === lastEl) {
        e.preventDefault()
        firstEl.focus({ preventScroll: true })
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      // Guarded restore: only when focus is still inside the surface (or fell
      // to body because the surface unmounted) — never steal focus from a
      // dialog that opened meanwhile (e.g. the nav-footer → SSO modal flow).
      const current = document.activeElement
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        (current === null || current === document.body || container.contains(current))
      ) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [containerRef, active, contain])
}
