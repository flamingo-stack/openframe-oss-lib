"use client"

import { type CSSProperties, useLayoutEffect, useState } from "react"

interface UseCollapsibleOptions {
  expanded: boolean
  collapsedHeight?: number | "1lh"
  disableTransition?: boolean
  durationMs?: number
}

export function useCollapsible({
  expanded,
  collapsedHeight = 0,
  disableTransition = false,
  durationMs = 200,
}: UseCollapsibleOptions) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const [collapsedPx, setCollapsedPx] = useState(0)

  useLayoutEffect(() => {
    if (!element) return
    const measure = () => {
      setContentHeight(element.scrollHeight)
      setCollapsedPx(
        collapsedHeight === "1lh"
          ? parseFloat(getComputedStyle(element).lineHeight)
          : collapsedHeight
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, collapsedHeight])

  // When the caller asks for `"1lh"`, fall back to a measured pixel value
  // (inner element's line-height) as soon as it's available. Setting
  // `max-height: 1lh` via CSS resolves against the OUTER element's
  // line-height, which can differ from the inner content's line-height and
  // leak the top of the next block element past the clip line. The measured
  // pixel value matches the inner content exactly.
  const collapsedValue: number | string =
    collapsedHeight === "1lh" ? collapsedPx || collapsedHeight : collapsedHeight

  const containerStyle: CSSProperties = {
    overflow: "hidden",
    maxHeight: expanded ? contentHeight : collapsedValue,
    transition: disableTransition ? "none" : `max-height ${durationMs}ms ease-in-out`,
  }

  return {
    innerRef: setElement,
    isOverflowing: contentHeight > collapsedPx,
    containerStyle,
  }
}
