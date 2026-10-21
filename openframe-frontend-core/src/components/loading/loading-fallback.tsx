'use client';

import { type ElementType, type ReactNode, Suspense } from 'react';
import { LoadingScope, useLoadingScope } from '../ui/loading-scope';
import { LoadingStatus } from './loading-region';

/**
 * A Suspense fallback drawn by the components themselves: the SAME component the boundary waits on, rendered in a
 * `LoadingScope`, where it draws its own skeleton and reads nothing. A page never picks a component's
 * `<Name>Skeleton`:
 *
 *   <Suspense fallback={<LoadingFallback><Dashboard /></LoadingFallback>}><Dashboard /></Suspense>
 *
 * ONE element: the scope's own (`LoadingScope` with `as`, `className`): busy, inert and hidden from assistive
 * technology, adding no wrapper a flex parent would lay out. The status that announces it once sits beside it
 * (visually hidden, outside the hidden region, so it is still read), and is left out inside an outer scope, which has
 * already said it. `status={false}` leaves the status out: an inline part (a chip, a mention in a sentence) whose
 * loading the surrounding region already announces, or that is too small to announce.
 */
export function LoadingFallback({
  label = 'Loading the page',
  status = true,
  as,
  className,
  children,
}: {
  label?: string;
  /** Announce the loading state (default). `false`: an inline part, announced by its region or not at all. */
  status?: boolean;
  /** The region's element (a `contents` box keeps a flex parent's layout, e.g. inside a modal). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const inScope = useLoadingScope();
  return (
    <>
      {status && !inScope && <LoadingStatus label={label} />}
      <LoadingScope as={as} className={className}>
        {children}
      </LoadingScope>
    </>
  );
}

/**
 * The one Suspense boundary whose fallback is its own children in a loading scope: what every screen wrote out as
 * `<Suspense fallback={<LoadingFallback label={…}>{x}</LoadingFallback>}>{x}</Suspense>`, with the child twice.
 *
 *   <LoadingSuspense label="Loading the tenants"><TenantList /></LoadingSuspense>
 *   <LoadingSuspense label="Loading the script" fallback={<ScriptView script={null} />}><ScriptReader /></LoadingSuspense>
 *   <LoadingSuspense status={false} as="span"><MentionChip id={id} /></LoadingSuspense>
 */
export function LoadingSuspense({
  label,
  status,
  as,
  className,
  fallback,
  children,
}: {
  label?: string;
  /** `false`: no announcement (an inline part); see `LoadingFallback`. */
  status?: boolean;
  as?: ElementType;
  className?: string;
  /**
   * What the boundary draws while its children suspend, when that is not the children themselves (a reader whose view
   * is a separate component: `fallback={<ThingView thing={null} />}`). Drawn in the same loading scope. Default: the
   * children.
   */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <LoadingFallback label={label} status={status} as={as} className={className}>
          {fallback ?? children}
        </LoadingFallback>
      }
    >
      {children}
    </Suspense>
  );
}
