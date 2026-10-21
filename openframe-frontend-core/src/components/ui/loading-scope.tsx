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
import { createContext, type ElementType, useContext, type ReactNode } from 'react';
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
export function LoadingWhen({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <LoadingScope bare active={loading}>
      {children}
    </LoadingScope>
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
