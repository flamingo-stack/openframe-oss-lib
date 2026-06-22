'use client'

import { useMemo } from 'react'

import { useChatRuntime } from '../contexts/chat-runtime-context'
import { buildOgPlaceholderUrl } from '../utils/og-placeholder'

/**
 * Resolve a branded og-placeholder image URL for a title, driven entirely by
 * the runtime `endpoints` (no injected builder).
 *
 * THE one og-placeholder hook. It reads the host's `endpoints` from
 * `ChatRuntime` and hands them to `buildOgPlaceholderUrl`, which resolves the
 * route base (explicit `ogPlaceholderUrl` → derived from `imageProxyUrlPrefix`
 * → same-origin `/api/og-placeholder`) and appends `?title=…`. Per-platform
 * brand colors are resolved SERVER-SIDE by the route — nothing is baked here.
 *
 * Replaces the old builder-injection `useOgPlaceholder(buildUrl, …)`: callers
 * no longer pass a URL builder. `useEntityCardPlaceholder` delegates here too,
 * so every surface shares one memo + one code path.
 */
export interface UseOgPlaceholderUrlArgs {
  /** Text to display on the placeholder. */
  title: string | undefined | null
  /** Site name shown below the title (optional). */
  siteName?: string
  /** `'wide'` (1200×630 social-card; default) or `'square'` (1024×1024 — for
   *  compact chat-inline slots so `object-cover` doesn't crop the title off). */
  aspect?: 'wide' | 'square'
  /** When `false`, returns `null` instead of a URL. */
  enabled?: boolean
}

export function useOgPlaceholderUrl({
  title,
  siteName = '',
  aspect = 'wide',
  enabled = true,
}: UseOgPlaceholderUrlArgs): string | null {
  const endpoints = useChatRuntime()?.endpoints

  return useMemo(() => {
    if (!enabled || !title) return null
    return buildOgPlaceholderUrl(endpoints, title, { site: siteName || undefined, aspect })
  }, [endpoints, title, siteName, aspect, enabled])
}
