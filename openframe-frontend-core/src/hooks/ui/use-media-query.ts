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
 * Predefined breakpoints for common screen sizes
 */
export const breakpoints = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
}

export function useSmUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.sm)
  return matches === undefined ? undefined : matches
}

export function useMdUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.md)
  return matches === undefined ? undefined : matches
}

export function useLgUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.lg)
  return matches === undefined ? undefined : matches
}

export function useXlUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.xl)
  return matches === undefined ? undefined : matches
}

export function use2xlUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints["2xl"])
  return matches === undefined ? undefined : matches
}