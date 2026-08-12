'use client'

import { useSyncExternalStore } from 'react'

/**
 * Extra `collisionPadding.bottom` (px) a Radix popper needs to clear the
 * software keyboard. 0 on desktop and anywhere the keyboard is down.
 *
 * Radix positions every popper with floating-ui at `strategy: 'fixed'`, and
 * floating-ui takes its collision viewport from `window.visualViewport`.
 * Neither mobile shell shrinks the box a keyboard opens into: iOS runs
 * Capacitor's Keyboard plugin at `resize: 'none'`, which leaves the WKWebView
 * frame alone, and Android's window is edge-to-edge, where the IME is only a
 * WindowInsets type. So `flip`/`shift`/`size` all believe the screen still
 * reaches the bottom, and a dropdown whose own search field just raised the
 * keyboard is placed straight behind it — worst inside modals, which sit near
 * the bottom of the screen by design.
 *
 * The shell publishes the keyboard height as `--of-keyboard-inset` on <html>
 * (openframe-frontend's `keyboard-inset.ts`; unset everywhere else, hence the
 * 0 default). Handing the part floating-ui does not already know about back as
 * collision padding is what makes the top of the keyboard the bottom edge of
 * the screen.
 *
 * ```tsx
 * const keyboardPadding = useKeyboardCollisionPadding()
 * <PopoverPrimitive.Content collisionPadding={{ bottom: keyboardPadding }} />
 * ```
 *
 * Pair it with `max-h-[var(--radix-popper-available-height)]` on the content:
 * padding alone flips a dropdown above its trigger, but a list taller than what
 * is left above the keyboard would then spill back over it.
 */

const KEYBOARD_INSET_VAR = '--of-keyboard-inset'

function measure(): number {
  if (typeof document === 'undefined') return 0
  const inset = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(KEYBOARD_INSET_VAR),
  )
  // Also catches the NaN of an unset variable.
  if (!(inset > 0)) return 0
  // How far floating-ui's own viewport bottom sits below the top of the
  // keyboard. iOS reports the keyboard on the visual viewport and Android does
  // not; measuring the difference rather than branching on the platform keeps
  // both correct and can never reserve the same keyboard twice.
  const layoutHeight = document.documentElement.clientHeight
  const viewport = window.visualViewport
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : layoutHeight
  return Math.max(0, Math.round(viewportBottom - (layoutHeight - inset)))
}

// One document-wide subscription for every popper on the page: the keyboard is
// a single global, and each open dropdown re-reading it would mean another
// MutationObserver plus a forced style resolve per keystroke-driven re-render.
const listeners = new Set<() => void>()
let padding = 0
let teardown: (() => void) | null = null

function sync(): void {
  const next = measure()
  if (next === padding) return
  padding = next
  for (const notify of listeners) notify()
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  if (listeners.size === 1) {
    padding = measure()
    // Two independent signals. The inset lands on <html>'s inline style, so the
    // attribute is the only notification for it; the visual viewport moves on
    // its own schedule (iOS reports the keyboard there, and a pinch-zoom shifts
    // it with no keyboard involved at all) and changes what is left to reserve.
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', sync)
    viewport?.addEventListener('scroll', sync)
    teardown = () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', sync)
      viewport?.removeEventListener('scroll', sync)
    }
  }
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size > 0) return
    teardown?.()
    teardown = null
  }
}

export function useKeyboardCollisionPadding(): number {
  return useSyncExternalStore(
    subscribe,
    () => padding,
    () => 0,
  )
}
