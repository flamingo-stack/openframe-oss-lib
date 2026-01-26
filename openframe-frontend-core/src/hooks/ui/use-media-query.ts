"use client"

import { useLayoutEffect, useState } from "react"

/**
 * Hook to check if a media query matches
 * @param query - Media query to check
 * @returns Whether the media query matches, or undefined during SSR/initial render
 */
export function useMediaQuery(
  query: string,
): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined)

  useLayoutEffect(() => {
    const matchMedia = window.matchMedia(query)

    const handleChange = () => {
      setMatches(matchMedia.matches)
    }

    // Set initial value
    handleChange()

    matchMedia.addEventListener('change', handleChange)

    return () => {
      matchMedia.removeEventListener('change', handleChange)
    }
  }, [query])

  return matches
}

/**
 * Hook to get window dimensions
 * @returns Window width and height
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  })
  const [isClient, setIsClient] = useState(false)

  useLayoutEffect(() => {
    setIsClient(true)
    if (!isClient) return

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Set initial size
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [isClient])

  return windowSize
}

/**
 * Predefined breakpoints for common screen sizes
 */
export const breakpoints = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
}

/**
 * Hook to check if screen is mobile
 * @returns Whether the screen is mobile, or undefined during SSR/initial render
 */
export function useMobile(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.md)
  return matches === undefined ? undefined : !matches
}

/**
 * Hook to check if screen is desktop (lg+)
 * @returns Whether the screen is desktop, or undefined during SSR/initial render
 */
export function useDesktop(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.lg)
  return matches === undefined ? undefined : matches
}

/**
 * Hook to check if screen is tablet or smaller (below lg)
 * @returns Whether the screen is tablet, or undefined during SSR/initial render
 */
export function useTablet(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.lg)
  return matches === undefined ? undefined : !matches
}