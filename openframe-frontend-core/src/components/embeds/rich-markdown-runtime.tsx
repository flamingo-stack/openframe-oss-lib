'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

/**
 * Runtime knobs threaded from `<RichMarkdownRenderer>` down to its
 * satellite embed clients (reddit / twitter / og link preview / markdown
 * image). Lives in its own micro-context — distinct from the
 * `ChatRuntimeContext` used by the lib's chat module — because the
 * markdown renderer is mounted from documentation pages (blog, legal,
 * data room, knowledge base) that do NOT have a chat runtime in scope,
 * and the satellites need just three knobs:
 *
 *   - WHERE to fetch the reddit / twitter / OG-scrape proxy
 *   - HOW to transform a markdown image URL (the hub injects its
 *     Supabase image transformer; embedders pass null / identity)
 *
 * Defaults match the hub's existing endpoints so passing
 * `<RichMarkdownRenderer>` no props at all still works end-to-end on
 * the hub. Embedders override per-prop as needed.
 */
export interface RichMarkdownRuntime {
  redditProxyUrl: string
  twitterProxyUrl: string
  ogScraperUrl: string
  /** Hub-only Supabase image transformer. Returning null means "don't
   *  rewrite — use the src as-is". Defaults to identity (no rewrite). */
  transformImageSrc: (
    src: string,
    opts?: { width?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' }
  ) => string | null
}

const DEFAULT_RUNTIME: RichMarkdownRuntime = {
  redditProxyUrl: '/api/blog/reddit-proxy',
  twitterProxyUrl: '/api/blog/twitter-proxy',
  ogScraperUrl: '/api/blog/og-scraper',
  transformImageSrc: () => null,
}

const RichMarkdownRuntimeContext = createContext<RichMarkdownRuntime>(DEFAULT_RUNTIME)

/**
 * Provider that fills in defaults for any prop the caller didn't pass.
 * Memoizes the resolved runtime so satellites don't re-render when an
 * unrelated parent state ticks.
 */
export function RichMarkdownRuntimeProvider({
  redditProxyUrl,
  twitterProxyUrl,
  ogScraperUrl,
  transformImageSrc,
  children,
}: Partial<RichMarkdownRuntime> & { children: ReactNode }) {
  const value = useMemo<RichMarkdownRuntime>(
    () => ({
      redditProxyUrl: redditProxyUrl ?? DEFAULT_RUNTIME.redditProxyUrl,
      twitterProxyUrl: twitterProxyUrl ?? DEFAULT_RUNTIME.twitterProxyUrl,
      ogScraperUrl: ogScraperUrl ?? DEFAULT_RUNTIME.ogScraperUrl,
      transformImageSrc: transformImageSrc ?? DEFAULT_RUNTIME.transformImageSrc,
    }),
    [redditProxyUrl, twitterProxyUrl, ogScraperUrl, transformImageSrc],
  )
  return (
    <RichMarkdownRuntimeContext.Provider value={value}>
      {children}
    </RichMarkdownRuntimeContext.Provider>
  )
}

/**
 * Read the ambient runtime. Returns the defaults when called outside any
 * `RichMarkdownRuntimeProvider` — so embedders that drop a satellite into
 * a non-renderer context (e.g. a release page calling
 * `<RedditEmbedClient>` directly) get the hub-matching defaults for free.
 */
export function useRichMarkdownRuntime(): RichMarkdownRuntime {
  return useContext(RichMarkdownRuntimeContext)
}
