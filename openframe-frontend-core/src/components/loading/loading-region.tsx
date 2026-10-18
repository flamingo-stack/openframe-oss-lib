'use client';

import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { useLoadingScope } from '../ui/loading-scope';

/**
 * THE container of a loading state: the one thing a screen reader hears while it loads.
 *
 * Skeleton bars (`UnifiedSkeleton`, `TextHold`) are decoration and are hidden from assistive technology;
 * a page with forty bars must not announce "loading" forty times. The region around them says it ONCE:
 * `aria-busy` on the container, and one polite status with the label. Few screen readers honour
 * `aria-busy` alone, so the status is what is actually read. When the content replaces the region, the
 * status goes with it.
 *
 * Put it on the top of a loading state (a page's skeleton, a card grid's, a Suspense fallback), never on
 * every card inside it: nested regions would announce again.
 */
export interface LoadingRegionProps extends HTMLAttributes<HTMLElement> {
  /** What is loading, read once by a screen reader. */
  label?: string;
  /** The container element, so the region keeps the layout element it replaces (a `section`, a `li`, a `span` in text). */
  as?: ElementType;
  /**
   * `false`: only the container is drawn (no `aria-busy`, no status), for a loading state rendered inside
   * another region, which announces for both. Components expose it as their `region` / `loadingRegion` prop.
   * Default `true`.
   */
  announce?: boolean;
  /**
   * `false`: `aria-busy` without a status of its own, for a container whose loading is already announced by a
   * status elsewhere (a table footer's "Loading more results"). Default `true`.
   */
  status?: boolean;
  children?: ReactNode;
}

export function LoadingRegion({
  label = 'Loading',
  as: Tag = 'div',
  announce: announceGiven = true,
  status = true,
  className,
  children,
  ...props
}: LoadingRegionProps) {
  // Inside a loading scope the page's region has already said it: nothing in it announces again.
  const inScope = useLoadingScope();
  const announce = announceGiven && !inScope;
  // One tree for both states: `children` keeps its slot whether or not the status is drawn, so an
  // `announce` that flips at runtime does not remount the content (and drop its state and focus).
  return (
    <Tag aria-busy={announce ? 'true' : undefined} className={className} {...props}>
      {announce && status && (
        <span role="status" aria-live="polite" className="sr-only">
          {label}
        </span>
      )}
      {children}
    </Tag>
  );
}
