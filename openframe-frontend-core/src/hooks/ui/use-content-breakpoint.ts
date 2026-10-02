'use client';

import { createContext, useContext } from 'react';
import { useLgUp, useMdUp } from './use-media-query';

export type ContentBreakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Content-area steps, in px of the area's own width. They match the
 * `content-md:` / `content-lg:` Tailwind variants and `ods-content-area.css`.
 */
export const CONTENT_BREAKPOINTS = { md: 720, lg: 1024 } as const;

/**
 * Width of the enclosing content area (`AppLayout` with a side panel provides
 * it), or `null` outside one.
 */
export const ContentAreaWidthContext = createContext<number | null>(null);

export function contentBreakpointFor(width: number): ContentBreakpoint {
  if (width >= CONTENT_BREAKPOINTS.lg) return 'desktop';
  if (width >= CONTENT_BREAKPOINTS.md) return 'tablet';
  return 'mobile';
}

/**
 * The breakpoint a component should lay out for: the content area's when it
 * renders inside one, the viewport's otherwise. `undefined` until the viewport
 * is known (first client render), like `useMdUp`.
 */
export function useContentBreakpoint(): ContentBreakpoint | undefined {
  const width = useContext(ContentAreaWidthContext);
  const mdUp = useMdUp();
  const lgUp = useLgUp();
  if (width !== null) return contentBreakpointFor(width);
  if (mdUp === undefined) return undefined;
  if (lgUp) return 'desktop';
  return mdUp ? 'tablet' : 'mobile';
}

/** Content-area counterpart of `useMdUp`. */
export function useContentMdUp(): boolean | undefined {
  const breakpoint = useContentBreakpoint();
  return breakpoint === undefined ? undefined : breakpoint !== 'mobile';
}

/** Content-area counterpart of `useLgUp`. */
export function useContentLgUp(): boolean | undefined {
  const breakpoint = useContentBreakpoint();
  return breakpoint === undefined ? undefined : breakpoint === 'desktop';
}
