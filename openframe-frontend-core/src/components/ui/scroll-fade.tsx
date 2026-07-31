'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

export type ScrollFadeAxis = 'vertical' | 'horizontal' | 'both'

/**
 * Tracks whether a scrollable element is scrolled away from its edges, so
 * edge fades ("scroll shadows") can be shown only where content continues.
 * Attach `scrollRef` to the scrollable element and `update` to its
 * `onScroll`; content/size changes are re-measured via ResizeObserver.
 *
 * `axis` picks which edges are tracked: 'vertical' (top/bottom — default,
 * matches the original hook), 'horizontal' (left/right), or 'both'.
 *
 * Canonical fade pattern shared by chat lists, FilterModal, and the
 * `ScrollShadow` wrapper below.
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>(axis: ScrollFadeAxis = 'vertical') {
  const scrollRef = React.useRef<T | null>(null)
  const [fade, setFade] = React.useState({ top: false, bottom: false, left: false, right: false })

  const update = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setFade((prev) => {
      const vertical = axis !== 'horizontal'
      const horizontal = axis !== 'vertical'
      const top = vertical && el.scrollTop > 0
      const bottom = vertical && el.scrollHeight - el.scrollTop - el.clientHeight > 1
      const left = horizontal && el.scrollLeft > 0
      const right = horizontal && el.scrollWidth - el.scrollLeft - el.clientWidth > 1
      return prev.top === top && prev.bottom === bottom && prev.left === left && prev.right === right
        ? prev
        : { top, bottom, left, right }
    })
  }, [axis])

  React.useLayoutEffect(() => {
    update()
    const el = scrollRef.current
    if (!el) return
    const cleanups: Array<() => void> = []
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(update)
      resizeObserver.observe(el)
      cleanups.push(() => resizeObserver.disconnect())
    }
    // ResizeObserver only sees the container box; content growth (appended
    // list items) changes scrollHeight without resizing it — watch mutations.
    if (typeof MutationObserver !== 'undefined') {
      const mutationObserver = new MutationObserver(update)
      mutationObserver.observe(el, { childList: true, subtree: true, characterData: true })
      cleanups.push(() => mutationObserver.disconnect())
    }
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [update])

  return {
    scrollRef,
    fadeTop: fade.top,
    fadeBottom: fade.bottom,
    fadeLeft: fade.left,
    fadeRight: fade.right,
    update,
  }
}

export type ScrollFadeEdge = 'top' | 'bottom' | 'left' | 'right'

export interface ScrollFadeOverlayProps {
  /** Which edge of the scroll container the fade sits on. */
  edge: ScrollFadeEdge
  /** Whether the fade is currently shown (content continues past this edge). */
  visible: boolean
  /**
   * CSS color the content fades into — should match the surface behind the
   * list. Defaults to the page background token, which is theme-aware (the
   * light theme redefines the token, so the fade flips with it).
   */
  color?: string
  className?: string
}

const EDGE_GRADIENT_ANGLE: Record<ScrollFadeEdge, string> = {
  top: '0deg',
  bottom: '180deg',
  left: '270deg',
  right: '90deg',
}

/**
 * Edge overlay that fades scrollable content into the surface behind it.
 * Render inside a `relative` wrapper around the scrollable element.
 * Vertical fades are 64px tall (legacy chat/FilterModal size); horizontal
 * fades are 40px wide per the ODS "scroll gradient" spec.
 */
export function ScrollFadeOverlay({
  edge,
  visible,
  color = 'var(--color-bg)',
  className,
}: ScrollFadeOverlayProps) {
  const isVertical = edge === 'top' || edge === 'bottom'
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute transition-opacity duration-150',
        isVertical ? 'inset-x-0 h-16' : 'inset-y-0 w-10',
        edge === 'top' && 'top-0',
        edge === 'bottom' && 'bottom-0',
        edge === 'left' && 'left-0',
        edge === 'right' && 'right-0',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{
        background: `linear-gradient(${EDGE_GRADIENT_ANGLE[edge]}, transparent 0%, ${color} 100%)`,
      }}
    />
  )
}

export interface ScrollShadowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which scroll direction(s) to track and fade. */
  axis?: ScrollFadeAxis
  /**
   * CSS color of the fade — the surface the content visually sits on.
   * Defaults to the page background token; pass e.g. `var(--color-bg-card)`
   * when the scrollable sits on a card. Tokens are theme-aware, so the same
   * component works in light and dark themes (dark by default).
   */
  color?: string
  /** Classes for the inner scrollable element (heights, paddings, etc.). */
  scrollClassName?: string
  /** Extra classes for every fade overlay (e.g. custom size). */
  overlayClassName?: string
  children: React.ReactNode
}

/**
 * Drop-in wrapper that makes its child scrollable and fades the edges where
 * more content exists — right/left for horizontal overflow (wide tables),
 * top/bottom for vertical (long lists). Fades appear and hide automatically
 * as the user scrolls or the content resizes.
 *
 * ```tsx
 * <ScrollShadow axis="horizontal">
 *   <WideTable />
 * </ScrollShadow>
 * ```
 */
export function ScrollShadow({
  axis = 'vertical',
  color = 'var(--color-bg)',
  className,
  scrollClassName,
  overlayClassName,
  children,
  ...rest
}: ScrollShadowProps) {
  const { scrollRef, fadeTop, fadeBottom, fadeLeft, fadeRight, update } = useScrollFade<HTMLDivElement>(axis)
  const vertical = axis !== 'horizontal'
  const horizontal = axis !== 'vertical'

  return (
    <div className={cn('relative', className)} {...rest}>
      <div
        ref={scrollRef}
        onScroll={update}
        className={cn(horizontal && 'overflow-x-auto', vertical && 'overflow-y-auto', scrollClassName)}
      >
        {children}
      </div>
      {vertical && <ScrollFadeOverlay edge="top" visible={fadeTop} color={color} className={overlayClassName} />}
      {vertical && (
        <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color={color} className={overlayClassName} />
      )}
      {horizontal && <ScrollFadeOverlay edge="left" visible={fadeLeft} color={color} className={overlayClassName} />}
      {horizontal && (
        <ScrollFadeOverlay edge="right" visible={fadeRight} color={color} className={overlayClassName} />
      )}
    </div>
  )
}
