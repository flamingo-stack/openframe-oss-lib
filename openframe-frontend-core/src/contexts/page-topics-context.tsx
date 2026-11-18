'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePathname } from '../embed-shims/next-navigation';
import { pageTopicFor } from '../utils/page-topics';

/**
 * Page topics for a host (`utils/page-topics`): a page's topic is its own path,
 * so a host gives no map, only whether to print the topic stamp, ONCE at the
 * root. Every surface that offers something for "this page" (the FAQ block, its
 * ask card, the chat's quick actions) reads the page's topic from the address
 * through it (`usePageTopic`); none takes a topic prop.
 */
interface PageTopicsValue {
  /** The address to read, where the router's answer is not the page's. */
  pathname?: string;
  /** Whether surfaces print the page's topic stamp (`PageTopicLabel`) by default. */
  showTopic: boolean;
}

const PageTopicsContext = createContext<PageTopicsValue | null>(null);

export interface PageTopicsProviderProps {
  /**
   * The page's address, for a subtree the router answers another path for (a
   * layout slot prerendered for one page and shown on another until it
   * hydrates). Absent: the router's (`usePathname`).
   */
  pathname?: string;
  /**
   * Print the page's topic stamp (`PageTopicLabel`) on every surface that can
   * show it (the FAQ block, the chat's quick actions), for whoever edits FAQs
   * and quick actions. ONE host decision, made at the root; a surface's own
   * `showTopic` prop still overrides it. Absent: the enclosing provider's
   * choice, else off.
   */
  showTopic?: boolean;
  children: ReactNode;
}

export function PageTopicsProvider({ pathname, showTopic, children }: PageTopicsProviderProps) {
  const inherited = useContext(PageTopicsContext);
  const stamp = showTopic ?? inherited?.showTopic ?? false;
  const value = useMemo(() => ({ pathname, showTopic: stamp }), [pathname, stamp]);
  return <PageTopicsContext.Provider value={value}>{children}</PageTopicsContext.Provider>;
}

/** The topic of the page on screen: its path (`pageTopicFor`). Undefined where the host gave no provider. */
export function usePageTopic(): string | undefined {
  const value = useContext(PageTopicsContext);
  const routerPathname = usePathname();
  if (!value) return undefined;
  return pageTopicFor(value.pathname ?? routerPathname ?? '/');
}

/** Whether the host asked surfaces to print the page's topic stamp (`PageTopicsProvider showTopic`). */
export function usePageTopicStamp(): boolean {
  return useContext(PageTopicsContext)?.showTopic ?? false;
}
