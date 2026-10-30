'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePathname } from '../embed-shims/next-navigation';
import { pageTopicFor, type PageTopics } from '../utils/page-topics';

/**
 * The host's page topics (`utils/page-topics`): its route to topic map, given
 * ONCE at the root. Every surface that offers something for "this page" (the
 * FAQ block, its ask card, the chat's quick actions) reads the page's topic
 * from the address through it (`usePageTopic`); none takes a topic prop.
 */
interface PageTopicsValue {
  topics: PageTopics;
  /** The address to read, where the router's answer is not the page's. */
  pathname?: string;
}

const PageTopicsContext = createContext<PageTopicsValue | null>(null);

export interface PageTopicsProviderProps {
  topics: PageTopics;
  /**
   * The page's address, for a subtree the router answers another path for (a
   * layout slot prerendered for one page and shown on another until it
   * hydrates). Absent: the router's (`usePathname`). Still the address: never
   * a topic.
   */
  pathname?: string;
  children: ReactNode;
}

export function PageTopicsProvider({ topics, pathname, children }: PageTopicsProviderProps) {
  const value = useMemo(() => ({ topics, pathname }), [topics, pathname]);
  return <PageTopicsContext.Provider value={value}>{children}</PageTopicsContext.Provider>;
}

/** The topic of the page on screen, from its address and the host's map. Undefined: no map, or no route covers the page. */
export function usePageTopic(): string | undefined {
  const value = useContext(PageTopicsContext);
  const routerPathname = usePathname();
  if (!value) return undefined;
  return pageTopicFor(value.pathname ?? routerPathname ?? '/', value.topics) || undefined;
}
