'use client';

import { useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';

/**
 * The room an empty grid table leaves under its bordered block (CU-17tkuw6af0q): the page's reserved height
 * (`minRows` × the row height) less the empty state's box, never below 0. Kept current while the box changes height
 * (its message wraps at a new width). Only the room is state, never the box's raw height, so the body re-renders only
 * when the room changes. 0 with no box and before it is measured (a server render).
 */
export function useGridEmptyReserve(box: HTMLElement | null, reservedHeight: number): number {
  const [reserve, setReserve] = useState(0);
  useIsomorphicLayoutEffect(() => {
    if (!box || reservedHeight <= 0) {
      setReserve(0);
      return undefined;
    }
    const measure = () => setReserve(Math.max(0, reservedHeight - box.offsetHeight));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, reservedHeight]);
  return reserve;
}
