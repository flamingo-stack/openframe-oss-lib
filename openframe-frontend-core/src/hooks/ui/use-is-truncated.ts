'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UseIsTruncatedOptions {
  /** Measure vertical clipping (`line-clamp-N`) instead of the single-line ellipsis. */
  multiline?: boolean
}

/**
 * Tracks whether an element's text is ACTUALLY clipped — the condition for
 * offering a "full value" tooltip. Text that fits needs no tooltip, and showing
 * one anyway just repeats what the user is already reading.
 *
 * Three things can change the answer, and all three are watched: the box
 * resizing (`ResizeObserver`), the text itself changing, and the measured
 * ELEMENT changing. None of them implies the others — new text inside a
 * width-constrained box leaves the box exactly as it was, so the observer never
 * fires; and a caller that swaps between render branches (adornment vs plain)
 * mounts a different node under the same text, which a `useRef` would leave
 * measured against the old, detached node. Pass the rendered value as `value`.
 *
 * `ref` is a CALLBACK ref, not a `RefObject` — that is what makes the element
 * itself a dependency. Attach it exactly like a normal ref; there is no
 * `.current` to read.
 *
 * ```tsx
 * const { ref, isTruncated } = useIsTruncated<HTMLHeadingElement>(title)
 * <FloatingTooltip content={title} disabled={!isTruncated}>
 *   <h1 ref={ref} className="truncate">{title}</h1>
 * </FloatingTooltip>
 * ```
 */
export function useIsTruncated<T extends HTMLElement>(value: unknown, options?: UseIsTruncatedOptions) {
  const multiline = options?.multiline ?? false
  const [element, setElement] = useState<T | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  // Wrapped so the identity stays stable across renders: passing the raw
  // `useState` setter as a ref would be stable too, but this keeps the public
  // shape a plain `RefCallback<T>` instead of a state dispatcher.
  const ref = useCallback((node: T | null) => setElement(node), [])

  useEffect(() => {
    if (!element) {
      setIsTruncated(false)
      return
    }
    // The 1px tolerance absorbs sub-pixel layout rounding, which otherwise
    // reports a permanent fractional "overflow" at some zoom levels / DPRs and
    // leaves a tooltip armed on text that is fully visible.
    const check = () => {
      setIsTruncated(
        multiline
          ? element.scrollHeight > element.clientHeight + 1
          : element.scrollWidth > element.clientWidth + 1,
      )
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, value, multiline])

  return { ref, isTruncated }
}
