'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the combined height (px) of the sticky page header and announcement
 * bar (if present), updated live via ResizeObserver / MutationObserver.
 * Useful for offsetting fixed/absolute-positioned panels so they don't
 * overlap the header.
 */
export function useHeaderHeight(defaultHeight = 64): number {
  const [height, setHeight] = useState(defaultHeight)

  useEffect(() => {
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
        if (mutation.type === 'childList') {
          measure()
          const newBar = document.querySelector('[data-announcement-bar]')
          if (newBar) resizeObserver.observe(newBar)
        }
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [defaultHeight])

  return height
}
