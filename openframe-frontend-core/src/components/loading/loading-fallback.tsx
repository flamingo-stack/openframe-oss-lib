'use client';

import type { ElementType, ReactNode } from 'react';
import { LoadingScope } from '../ui/loading-scope';
import { LoadingRegion } from './loading-region';

/**
 * A Suspense fallback drawn by the components themselves: the SAME component the boundary waits on, rendered in a
 * `LoadingScope`, where it draws its own skeleton and reads nothing. Announced once (the scope inside is hidden from
 * assistive technology). A page never picks a component's `<Name>Skeleton`:
 *
 *   <Suspense fallback={<LoadingFallback><Dashboard /></LoadingFallback>}><Dashboard /></Suspense>
 */
export function LoadingFallback({
  label = 'Loading the page',
  as,
  className,
  children,
}: {
  label?: string;
  /** The region's element (a `contents` box keeps a flex parent's layout, e.g. inside a modal). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <LoadingRegion label={label} as={as} className={className}>
      <LoadingScope className={className}>{children}</LoadingScope>
    </LoadingRegion>
  );
}
