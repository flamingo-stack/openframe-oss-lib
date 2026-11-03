'use client';

import { createContext, createElement, type ReactNode, useContext } from 'react';
import { LAYOUT_STEPS } from '../../styles/layout-steps';
import { useLgUp, useMdUp, useMediaQuery } from './use-media-query';

export type ContentBreakpoint = 'mobile' | 'tablet' | 'desktop';

/** Content-area steps, in px of the area's own width. */
export const CONTENT_BREAKPOINTS = {
  md: LAYOUT_STEPS.md.content,
  lg: LAYOUT_STEPS.lg.content,
  xl: LAYOUT_STEPS.xl.content,
} as const;

/**
 * How many content steps a width has passed, `xl` included: `AppLayout` publishes a new width only when this changes,
 * so every reader below sees each crossing it asks about (`useContentBreakpoint`, `useContentXlUp`).
 */
export function contentStepFor(width: number): number {
  return [CONTENT_BREAKPOINTS.md, CONTENT_BREAKPOINTS.lg, CONTENT_BREAKPOINTS.xl].filter(step => width >= step).length;
}

/**
 * Width of the enclosing content area (`AppLayout` with a side panel or a composer
 * dock provides it), or `null` outside one. `AppLayout` moves it only when the area
 * crosses a breakpoint, so it is a width in the area's current step, not a live
 * measurement: read it through the hooks below.
 */
export const ContentAreaWidthContext = createContext<number | null>(null);

/**
 * For window chrome opened from a content area (a modal, a drawer): its subtree
 * is back on the viewport's steps. Context crosses a portal, so without this
 * the hooks below would still answer with the content area's width.
 */
export function ViewportBreakpoints({ children }: { children: ReactNode }) {
  return createElement(ContentAreaWidthContext.Provider, { value: null }, children);
}

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

/** The `content-xl:` step in JS: the content area's width from `xl`, the viewport's outside one. */
export function useContentXlUp(): boolean | undefined {
  const width = useContext(ContentAreaWidthContext);
  const viewportXlUp = useMediaQuery(`(min-width: ${LAYOUT_STEPS.xl.viewport}px)`);
  return width === null ? viewportXlUp : width >= CONTENT_BREAKPOINTS.xl;
}
