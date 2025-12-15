"use client"

import { useState, useEffect } from "react"

/**
 * Hook to check if a media query matches
 * @param query - Media query to check
 * @returns Whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (!isClient) return

    const media = window.matchMedia(query)
    const updateMatches = () => setMatches(media.matches)

    // Set initial value
    updateMatches()

    // Listen for changes
    media.addEventListener("change", updateMatches)

    // Cleanup
    return () => {
      media.removeEventListener("change", updateMatches)
    }
  }, [query, isClient])

  return isClient ? matches : false
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

  useEffect(() => {
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
 * @param breakpoint - Breakpoint to consider as mobile
 * @returns Whether the screen is mobile
 */
export function useMobile(breakpoint: string = breakpoints.md): boolean {
  return !useMediaQuery(breakpoint)
}
