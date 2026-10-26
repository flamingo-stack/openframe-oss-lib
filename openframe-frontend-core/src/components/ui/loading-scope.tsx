'use client';

/**
 * A page's loading state, drawn by its own components. THE RULE: every component that shows read data has its own
 * `<Name>Skeleton` (the same layout, sharing the component's class constants, its static copy drawn for real and
 * every read part a skeleton shape), and decides in ONE place when it is loading:
 *
 *   if (useLoadingScope() || <its own data is not here yet>) return <NameSkeleton … />;
 *
 * Inside `LoadingScope` (which a page wraps around its loading state) every component is therefore its skeleton,
 * and the same skeleton shows while it fetches on the client. Nothing in a scope fetches, writes, or draws invented
 * words.
 */
import { createContext, type ElementType, Fragment, useContext, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

const LoadingScopeContext = createContext(false);

/** Draws its children as their own loading state. Inert and hidden from assistive technology: the page's loading
 *  region announces it once. `bare` draws no element of its own (the scope only): for a component's own `loading`
 *  mode, whose markup must not change and whose container already says it is loading. `active` (default true) turns
 *  the scope on and off without changing the tree, so a component that finishes loading is not remounted; a false
 *  never cancels an outer scope. `as` is the element (default `div`; a `contents` box keeps a flex parent's
 *  layout). The scope that starts a loading state (no outer one) is also busy (`aria-busy`). */
export function LoadingScope({
  children,
  className,
  bare = false,
  active,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
  active?: boolean;
  as?: ElementType;
}) {
  const outer = useContext(LoadingScopeContext);
  const on = outer || (active ?? true);
  if (bare) return <LoadingScopeContext.Provider value={on}>{children}</LoadingScopeContext.Provider>;
  return (
    <LoadingScopeContext.Provider value={on}>
      <Tag
        aria-busy={on && !outer ? 'true' : undefined}
        aria-hidden={on || undefined}
        inert={on || undefined}
        className={cn(on && 'pointer-events-none select-none', className)}
      >
        {children}
      </Tag>
    </LoadingScopeContext.Provider>
  );
}

/** Whether the component draws as its own loading state (its `<Name>Skeleton`). */
export function useLoadingScope(): boolean {
  return useContext(LoadingScopeContext);
}

/**
 * A component whose data a client read has not answered yet, drawn by the component itself: its children in a bare
 * loading scope (no element of its own, so the markup does not change), where each draws its own skeleton, else as
 * they are. The scope is always rendered and only switched (`active`), so the children are never remounted when the
 * read answers, and an outer loading scope still holds. The parent renders the component either way and never picks
 * its `<Name>Skeleton` (one switch per component):
 *
 *   <LoadingWhen loading={!health}><StatusBadge text={label} variant="button" /></LoadingWhen>
 */
export function LoadingWhen({
  loading,
  label,
  as,
  className,
  children,
}: {
  loading: boolean;
  /**
   * The read is announced: with a label the component draws ONE region element (`as`, `className`), always mounted,
   * and a polite status reads the label while `loading` (silent inside an outer scope, which has said it), the same
   * region `LoadingFallback` draws. Without one it stays bare: no element of its own.
   */
  label?: string;
  /** The region's element when `label` is given (a `contents` box keeps a flex parent's layout). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  if (label === undefined) {
    return (
      <LoadingScope bare active={loading}>
        {children}
      </LoadingScope>
    );
  }
  return (
    <AnnouncedLoadingScope label={label} active={loading} as={as} className={className}>
      {children}
    </AnnouncedLoadingScope>
  );
}

/**
 * THE announced loading region: a `LoadingScope` element (busy, inert, hidden from assistive technology while on)
 * with the one polite status beside it, outside the hidden region so it is still read, left out inside an outer scope
 * and while the scope is off. `LoadingFallback` (always on) and a labelled `LoadingWhen` (switched by its read) draw
 * it. `status={false}`: no announcement (an inline part).
 */
export function AnnouncedLoadingScope({
  label,
  status = true,
  active = true,
  as,
  className,
  children,
}: {
  label: string;
  status?: boolean;
  active?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const outer = useLoadingScope();
  // The status follows the content, so in a `space-y-*` stack it never pushes the content down (see LoadingRegion).
  return (
    <>
      <LoadingScope active={active} as={as} className={className}>
        {children}
      </LoadingScope>
      {status && active && !outer && <LoadingStatus label={label} />}
    </>
  );
}

/**
 * A static control (a button, a menu trigger, a toggle: copy the component owns, never read data) drawn for real while
 * its subject is read: wrapped inert and hidden from assistive technology, so it cannot act on data that is not there
 * yet. THE one wrapper for it. The wrapper is always rendered and only switched (`loading`), so the control is never
 * remounted when the read answers. `className` is the wrapper's box (default `inline-flex shrink-0`, the size of the
 * control; `contents` keeps a flex parent's layout).
 *
 *   <InertWhileLoading loading={loading}><Button onClick={onOpen}>Open</Button></InertWhileLoading>
 */
export function InertWhileLoading({
  loading = true,
  className = 'inline-flex shrink-0',
  children,
}: {
  loading?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span inert={loading || undefined} aria-hidden={loading || undefined} className={className}>
      {children}
    </span>
  );
}

/** The handler a control drawn inert while its subject is read is given: it is never called (the control is inert).
 *  THE one such handler, so a loading form never declares its own no-op. */
export const LOADING_NOOP = (): void => undefined;

/** The one polite status a loading state is read as (visually hidden): the region's, and a fallback's beside its hidden content. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}

/**
 * The `data-*` attributes among a component's props, for its skeleton: a list item's skeleton carries the same
 * markers the loaded item carries (`data-loading-item` first), so the page's height gate counts both forms alike.
 * THE one way a component hands its markers to its own skeleton (`<RowSkeleton {...loadingItemProps(props)} />`).
 */
export function loadingItemProps(props: object): { [key: `data-${string}`]: unknown } {
  return Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('data-')));
}

/**
 * A list's items while the list is read: `count` of them, each drawn by `children(index)` (keyed here, so the caller
 * writes no key). THE one way a skeleton draws N items: the count is the list's own page size, limit or declared
 * typical constant, never a literal typed here, and each item carries the list's markers (`data-loading-item`, through
 * `loadingItemProps`), like the loaded item.
 *
 *   <LoadingItems count={pageSize}>{() => <RowSkeleton data-loading-item />}</LoadingItems>
 */
export function LoadingItems({ count, children }: { count: number; children: (index: number) => ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Fragment key={index}>{children(index)}</Fragment>
      ))}
    </>
  );
}
