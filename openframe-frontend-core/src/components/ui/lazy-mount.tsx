'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useNearViewport, NEAR_VIEWPORT_ROOT_MARGIN } from '../../hooks/use-near-viewport';

export interface LazyMountProps {
  /** Mounted the first time the box comes within `rootMargin` of the viewport; never unmounted after. */
  children: ReactNode;
  /** What fills the box until then. The box itself must already have its final size (aspect-ratio / min-height). */
  placeholder?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Lookahead — defaults to the shared `NEAR_VIEWPORT_ROOT_MARGIN`. */
  rootMargin?: string;
}

/**
 * Sized box whose CONTENT mounts only near the viewport (shared fire-once
 * IntersectionObserver via `useNearViewport`). The box owns the layout —
 * pass the aspect-ratio / min-height on it — so lazy mounting never shifts
 * anything: the content appears inside a space that was already reserved.
 * Grids of players or large images render their chrome immediately and pay
 * for each preview only when it is about to be seen.
 */
export function LazyMount({
  children,
  placeholder = null,
  className,
  style,
  rootMargin = NEAR_VIEWPORT_ROOT_MARGIN,
}: LazyMountProps) {
  const { ref, isNear } = useNearViewport<HTMLDivElement>(rootMargin);
  return (
    <div ref={ref} className={className} style={style}>
      {isNear ? children : placeholder}
    </div>
  );
}
