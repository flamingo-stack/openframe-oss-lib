'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the combined height (px) of the sticky page header and announcement
 * bar (if present), updated live via ResizeObserver / MutationObserver.
 * Useful for offsetting fixed/absolute-positioned panels so they don't
 * overlap the header.
 */
export function useHeaderHeight(
  defaultHeight = 64,
  options: {
    /**
     * When false, no observers are attached and the default height is
     * returned — for consumers that stay mounted on every page but only need
     * the measurement while an overlay is open (avoids an always-on
     * document-wide MutationObserver + forced reflow).
     * @default true
     */
    enabled?: boolean
  } = {}
): number {
  const { enabled = true } = options
  const [height, setHeight] = useState(defaultHeight)

  useEffect(() => {
    if (!enabled) return

    const measure = () => {
      let total = 0
      const header = document.querySelector('header')
      if (header) total += header.offsetHeight
      const bar = document.querySelector('[data-announcement-bar]')
      if (bar instanceof HTMLElement) total += bar.offsetHeight
      setHeight(total > 0 ? total : defaultHeight)
    }

    measure()

    const resizeObserver = new ResizeObserver(measure)
    const header = document.querySelector('header')
    if (header) resizeObserver.observe(header)
    const bar = document.querySelector('[data-announcement-bar]')
    if (bar) resizeObserver.observe(bar)

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          measure()
          const newBar = document.querySelector('[data-announcement-bar]')
          if (newBar) resizeObserver.observe(newBar)
        }
      }
    })
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-announcement-bar'],
    })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [defaultHeight, enabled])

  return height
}
