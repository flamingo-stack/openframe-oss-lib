'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from '../embed-shims/next-navigation';
import { pageTopicFor, type PageTopics } from '../utils/page-topics';

/**
 * The host's page topics (`utils/page-topics`): its route to topic map, given
 * ONCE at the root. Every surface that offers something for "this page" (the
 * FAQ block, its ask card, the chat's quick actions) reads the page's topic
 * from the address through it (`usePageTopic`); none takes a topic prop.
 */
const PageTopicsContext = createContext<PageTopics | null>(null);

export function PageTopicsProvider({ topics, children }: { topics: PageTopics; children: ReactNode }) {
  return <PageTopicsContext.Provider value={topics}>{children}</PageTopicsContext.Provider>;
}

/** The topic of the page on screen, from its address and the host's map. Undefined: no map, or no route covers the page. */
export function usePageTopic(): string | undefined {
  const topics = useContext(PageTopicsContext);
  const pathname = usePathname();
  return (topics && pageTopicFor(pathname ?? '/', topics)) || undefined;
}
