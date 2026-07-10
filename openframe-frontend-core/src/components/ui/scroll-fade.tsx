'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

/**
 * Tracks whether a scrollable element is scrolled away from its top/bottom
 * edge, so edge fades ("scroll shadows") can be shown only where content
 * continues. Attach `scrollRef` to the scrollable element and `update` to its
 * `onScroll`; content/size changes are re-measured via ResizeObserver.
 *
 * Canonical fade pattern shared by chat lists and FilterModal.
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>() {
  const scrollRef = React.useRef<T | null>(null)
  const [fade, setFade] = React.useState({ top: false, bottom: false })

  const update = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setFade((prev) => {
      const top = el.scrollTop > 0
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 1
      return prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    })
  }, [])

  React.useLayoutEffect(() => {
    update()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [update])

  return { scrollRef, fadeTop: fade.top, fadeBottom: fade.bottom, update }
}

export interface ScrollFadeOverlayProps {
  /** Which edge of the scroll container the fade sits on. */
  edge: 'top' | 'bottom'
  /** Whether the fade is currently shown (content continues past this edge). */
  visible: boolean
  /**
   * CSS color the content fades into — should match the surface behind the
   * list. Defaults to the page background token.
   */
  color?: string
  className?: string
}

/**
 * Edge overlay that fades scrollable content into the surface behind it.
 * Render inside a `relative` wrapper around the scrollable element.
 */
export function ScrollFadeOverlay({
  edge,
  visible,
  color = 'var(--color-bg)',
  className,
}: ScrollFadeOverlayProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 h-16 transition-opacity duration-150',
        edge === 'top' ? 'top-0' : 'bottom-0',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{
        background: `linear-gradient(${edge === 'top' ? '0deg' : '180deg'}, transparent 0%, ${color} 100%)`,
      }}
    />
  )
}
