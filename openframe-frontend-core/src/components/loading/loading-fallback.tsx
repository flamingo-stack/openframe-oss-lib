'use client';

import { type ElementType, type ReactNode, Suspense } from 'react';
import { AnnouncedLoadingScope, LoadingStatus, LoadingWhen, useLoadingScope } from '../ui/loading-scope';

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
  return (
    <AnnouncedLoadingScope label={label} status={status} as={as} className={className}>
      {children}
    </AnnouncedLoadingScope>
  );
}

/**
 * THE boundary (the loading standard's one Suspense: `src/loading-standard/engine.mjs`, rules RAW_SUSPENSE and
 * PAGE_BOUNDARY). It wraps only the component that waits on a read; its fallback is that component (or `fallback`, its
 * view with no data) drawn in a loading scope, where every part draws its own loading form, so nothing jumps when the
 * content arrives. Sections that share one read, or would look broken arriving one by one, share one boundary. A page's
 * static frame (heading, copy, back link, cached content) renders at once, outside every boundary; a component that reads
 * in the browser keeps its own loading state (`LoadingWhen`, `useLoadingScope`) and needs none.
 *
 *   <LoadingSuspense label="Loading the tenants"><TenantList /></LoadingSuspense>
 *   <LoadingSuspense label="Loading the script" fallback={<ScriptView script={null} />}><ScriptReader /></LoadingSuspense>
 *   <LoadingSuspense status={false} as="span"><MentionChip id={id} /></LoadingSuspense>
 *   <LoadingSuspense live label="Loading the run" fallback={<RunView run={null} />}><RunReader /></LoadingSuspense>
 *   <LoadingSuspense gated={!flagReady} label="Loading usage" fallback={<UsageScreen data={null} />}><UsageReader /></LoadingSuspense>
 */
export function LoadingSuspense({
  label,
  status,
  as,
  className,
  fallback,
  live = false,
  gated = false,
  bare = false,
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
  /**
   * The wait leaves the view usable: it is drawn in a BARE loading scope (no inert region) with the same status, so
   * every part still draws its own loading form and every control that reads the scope still locks itself, while one
   * that does not (Back, a plain `Button`, a search field) stays live. A body whose controls act on the record keeps
   * the default (inert).
   */
  live?: boolean;
  /**
   * A gate the read depends on (a feature flag, a role, a test mode) has not answered: draw the waiting view and send
   * nothing (the children are not rendered). The same view stands in for both waits, so no page spells the two branches.
   */
  gated?: boolean;
  /**
   * The gate's window draws the scope only (no region element of its own), and the scope stays mounted across the gate,
   * so the view is not remounted: for a view inside a surface that already announces its load, or whose layout an extra
   * element would break.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  const view = fallback ?? children;
  const waiting = live ? (
    <LiveWait label={label} status={status}>
      {view}
    </LiveWait>
  ) : (
    <LoadingFallback label={label} status={status} as={as} className={className}>
      {view}
    </LoadingFallback>
  );
  const boundary = <Suspense fallback={waiting}>{children}</Suspense>;
  if (bare) return <LoadingWhen loading={gated}>{gated ? view : boundary}</LoadingWhen>;
  return gated ? waiting : boundary;
}

/** A `live` wait: the view in a bare loading scope, announced once (silent inside an outer scope, which has said it). */
function LiveWait({ label, status = true, children }: { label?: string; status?: boolean; children: ReactNode }) {
  const outer = useLoadingScope();
  return (
    <>
      <LoadingWhen loading>{children}</LoadingWhen>
      {status && !outer && <LoadingStatus label={label ?? 'Loading the page'} />}
    </>
  );
}
