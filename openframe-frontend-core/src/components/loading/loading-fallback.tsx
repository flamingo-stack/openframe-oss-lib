'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { LoadingScope, useLoadingScope } from '../ui/loading-scope';
import { LoadingStatus } from './loading-region';

/**
 * A Suspense fallback drawn by the components themselves: the SAME component the boundary waits on, rendered in a
 * `LoadingScope`, where it draws its own skeleton and reads nothing. A page never picks a component's
 * `<Name>Skeleton`:
 *
 *   <Suspense fallback={<LoadingFallback><Dashboard /></LoadingFallback>}><Dashboard /></Suspense>
 *
 * ONE element: the region (`as`, `className`) holds the children in a BARE scope, so nothing doubles the region's
 * padding or adds a wrapper a flex parent would lay out. The region is what a non-bare scope's own element is: busy,
 * inert and hidden from assistive technology. The status that announces it once sits beside it (visually hidden,
 * outside the hidden region, so it is still read), and is left out inside an outer scope, which has already said it.
 */
export function LoadingFallback({
  label = 'Loading the page',
  as: Tag = 'div',
  className,
  children,
}: {
  label?: string;
  /** The region's element (a `contents` box keeps a flex parent's layout, e.g. inside a modal). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const inScope = useLoadingScope();
  return (
    <>
      {!inScope && <LoadingStatus label={label} />}
      <Tag
        aria-busy={inScope ? undefined : 'true'}
        aria-hidden
        inert
        className={cn('pointer-events-none select-none', className)}
      >
        <LoadingScope bare>{children}</LoadingScope>
      </Tag>
    </>
  );
}
