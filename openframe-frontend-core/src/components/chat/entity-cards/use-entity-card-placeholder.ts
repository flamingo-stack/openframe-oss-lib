'use client'

/**
 * Shared OG-placeholder resolver for every entity card.
 *
 * The lib OWNS all the logic: it hands the runtime's `endpoints` to
 * `buildOgPlaceholderUrl`, which resolves the base API URL AND builds the
 * `…/og-placeholder?title=…` URL internally. No per-embedder callback, no
 * consumer-side URL construction — a host that wires its API endpoints gets
 * the placeholder fallback automatically.
 *
 * Override: an explicit `placeholderUrl` prop (incl. `null`) wins — chat
 * dispatch + tests pre-resolve through it.
 */

import { useMemo } from 'react'

import { useChatRuntime } from '../../../contexts/chat-runtime-context'
import { buildOgPlaceholderUrl } from '../../../utils/og-placeholder'

export interface UseEntityCardPlaceholderArgs {
  /** Entity title — used as the placeholder label. */
  title: string | undefined | null
  /** Explicit override. When set (including `null`), the runtime default is
   *  skipped. */
  placeholderUrl?: string | null
  /** Site name shown under the title. Optional. */
  siteName?: string
  /** Output aspect ratio. `'wide'` (default) for catalog cards, `'square'`
   *  for compact chat-inline cards. */
  aspect?: 'wide' | 'square'
}

export function useEntityCardPlaceholder({
  title,
  placeholderUrl,
  siteName = '',
  aspect = 'wide',
}: UseEntityCardPlaceholderArgs): string | null {
  const runtime = useChatRuntime()
  // `buildOgPlaceholderUrl` reads only the `OgPlaceholderEndpoints` slice
  // (`ogPlaceholderUrl` / `imageProxyUrlPrefix`) — pass the whole endpoints
  // object so the field list lives in ONE place (the interface), not a
  // hand-picked literal. Excess properties are ignored (same as the
  // onboarding-detail consumer, which passes `runtime?.endpoints` whole).
  const endpoints = runtime?.endpoints

  return useMemo(() => {
    // Explicit prop (including explicit null) wins; `undefined` → default.
    if (placeholderUrl !== undefined) return placeholderUrl
    if (!title) return null
    return buildOgPlaceholderUrl(endpoints, title, {
      site: siteName || undefined,
      aspect,
    })
  }, [placeholderUrl, title, endpoints, siteName, aspect])
}
