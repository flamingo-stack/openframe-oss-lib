'use client'

/**
 * Entity-card OG-placeholder resolver.
 *
 * A thin wrapper over the one og-placeholder hook (`useOgPlaceholderUrl`) that
 * adds a single concern: an explicit `placeholderUrl` prop (incl. `null`) wins
 * over the runtime-derived URL — chat dispatch + tests pre-resolve through it.
 * All URL construction lives in `useOgPlaceholderUrl` / `buildOgPlaceholderUrl`,
 * so this surface shares one memo + one code path with every other consumer.
 */

import { useOgPlaceholderUrl } from '../../../hooks/use-og-placeholder-url'

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
  const derived = useOgPlaceholderUrl({ title, siteName, aspect })
  // Explicit prop (including explicit null) wins; `undefined` → derived default.
  return placeholderUrl !== undefined ? placeholderUrl : derived
}
