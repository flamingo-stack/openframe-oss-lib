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
import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

const LoadingScopeContext = createContext(false);

/** Draws its children as their own loading state. Inert and hidden from assistive technology: the page's loading
 *  region announces it once. `bare` draws no element of its own (the scope only): for a component's own `loading`
 *  mode, whose markup must not change and whose container already says it is loading. `active` (default true) turns
 *  the scope on and off without changing the tree, so a component that finishes loading is not remounted; a false
 *  never cancels an outer scope. */
export function LoadingScope({
  children,
  className,
  bare = false,
  active,
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
  active?: boolean;
}) {
  const outer = useContext(LoadingScopeContext);
  const on = outer || (active ?? true);
  if (bare) return <LoadingScopeContext.Provider value={on}>{children}</LoadingScopeContext.Provider>;
  return (
    <LoadingScopeContext.Provider value={on}>
      <div
        aria-hidden={on || undefined}
        inert={on || undefined}
        className={cn(on && 'pointer-events-none select-none', className)}
      >
        {children}
      </div>
    </LoadingScopeContext.Provider>
  );
}

/** Whether the component draws as its own loading state (its `<Name>Skeleton`). */
export function useLoadingScope(): boolean {
  return useContext(LoadingScopeContext);
}
