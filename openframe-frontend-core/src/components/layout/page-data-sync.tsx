'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { DataSync } from '../../types/data-sync';
import { DataSyncLine } from '../ui/data-attribution';

/**
 * THE place a page states where its records are mirrored from: the first row under the page title, right-aligned,
 * the row the Trust Center's status line takes. A page whose title block and list are separate components (the
 * roadmap, the delivery board) wraps its `PageLayout` children in `PageDataSyncProvider` and renders
 * `PageDataSyncRow` first; the list reports what its endpoint answered with `usePageDataSync`. A page that holds its
 * own data (a legal document, a doc) renders `DataSyncLine` as its first row directly.
 */

interface PageDataSyncState {
  sync: DataSync | null;
  loading: boolean;
}

interface PageDataSyncContextValue {
  state: PageDataSyncState;
  /** The page's records are mirrored, so its list states a sync (`PageDataSyncProvider`'s `stated`). */
  stated: boolean;
  report: (state: PageDataSyncState | ((prev: PageDataSyncState) => PageDataSyncState)) => void;
}

const PageDataSyncContext = createContext<PageDataSyncContextValue | null>(null);

const EMPTY: PageDataSyncState = { sync: null, loading: false };
/**
 * Before the list below has reported (its first paint, the server's HTML), the row is loading: a page that has the
 * row has a list that states its sync, so its line's skeleton holds the row instead of the row appearing later.
 */
const NOT_REPORTED: PageDataSyncState = { sync: null, loading: true };

export function PageDataSyncProvider({
  stated = true,
  children,
}: {
  /**
   * The page's records are mirrored from another system, so its list states a sync and the row holds its line's
   * skeleton while it loads. `false`: the host authors the records; nothing is drawn while loading, and a line a host
   * states anyway is an optional part (`data-loading-optional`). Default `true`.
   */
  stated?: boolean;
  children: ReactNode;
}) {
  const [state, report] = useState<PageDataSyncState>(stated ? NOT_REPORTED : EMPTY);
  // The children's effects run before this one: a list that states its sync has reported by now. When none has, the
  // page states no sync and the row's skeleton goes (a page whose list never reports must not hold it forever).
  useEffect(() => {
    // After the commit (a task, not inside the effect): every list mounted with the page has reported by then.
    const timer = setTimeout(() => report(prev => (prev === NOT_REPORTED ? EMPTY : prev)), 0);
    return () => clearTimeout(timer);
  }, []);
  const value = useMemo(() => ({ state, report, stated }), [state, stated]);
  return <PageDataSyncContext.Provider value={value}>{children}</PageDataSyncContext.Provider>;
}

/**
 * The page's sync row: what a list below reported, its skeleton while it loads, nothing when it states none. `inline`
 * when it sits in a heading's action slot (`SectionHeading`), which places it itself.
 */
export function PageDataSyncRow({ inline = false }: { inline?: boolean }) {
  const context = useContext(PageDataSyncContext);
  if (!context) return null;
  const line = (
    <DataSyncLine sync={context.state.sync} loading={context.state.loading} stated={context.stated} inline={inline} />
  );
  // A host that authors its records states no sync while loading; a line it states anyway is optional.
  return context.stated ? (
    line
  ) : (
    <div className="contents" data-loading-optional="">
      {line}
    </div>
  );
}

/**
 * Report a list's sync to the page's row. Returns false when the list is rendered outside a page that has one (an
 * embed of the list alone), so the list draws the line itself.
 */
export function usePageDataSync(sync: DataSync | null | undefined, loading: boolean): boolean {
  const context = useContext(PageDataSyncContext);
  const report = context?.report;
  const source = sync?.source ?? null;
  const syncedAt = sync?.syncedAt ?? null;
  useEffect(() => {
    if (!report) return;
    report({ sync: source ? { source, syncedAt } : null, loading });
  }, [report, source, syncedAt, loading]);
  useEffect(() => (report ? () => report(EMPTY) : undefined), [report]);
  return Boolean(context);
}
