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

  const containerStyle: CSSProperties = {
    overflow: "hidden",
    maxHeight: expanded ? contentHeight : collapsedHeight,
    transition: disableTransition ? "none" : `max-height ${durationMs}ms ease-in-out`,
  }

  return {
    innerRef: setElement,
    isOverflowing: contentHeight > collapsedPx,
    containerStyle,
  }
}
