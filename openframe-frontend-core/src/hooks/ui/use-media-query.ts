'use client';

import { useState } from 'react';
import { LAYOUT_STEPS } from '../../styles/layout-steps';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

/**
 * Hook to check if a media query matches
 * @param query - Media query to check
 * @returns Whether the media query matches, or undefined during SSR/initial render
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query);

    const handleChange = () => {
      setMatches(matchMedia.matches);
    };

    // Set initial value
    handleChange();

    matchMedia.addEventListener('change', handleChange);

    return () => {
      matchMedia.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * Predefined breakpoints for common screen sizes
 */
export const breakpoints = {
  md: `(min-width: ${LAYOUT_STEPS.md.viewport}px)`, // Tablet
  lg: `(min-width: ${LAYOUT_STEPS.lg.viewport}px)`, // Desktop
};

/** @deprecated Use useMdUp instead */
export function useSmUp(): boolean | undefined {
  return useMdUp();
}

export function useMdUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.md);
  return matches === undefined ? undefined : matches;
}

export function useLgUp(): boolean | undefined {
  const matches = useMediaQuery(breakpoints.lg);
  return matches === undefined ? undefined : matches;
}
