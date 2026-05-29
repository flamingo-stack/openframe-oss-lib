'use client'

/**
 * Shared OG-placeholder resolver for every entity card.
 *
 * Pure-presentation cards historically required callers to
 * pre-compute `placeholderUrl` via a hub-side `useOgPlaceholder`
 * wrapper that injected the hub's `buildOgPlaceholderUrl` (resolves
 * CSS-var ODS colors to hex via the static map).
 *
 * This hook moves that resolution INTO the card via the
 * `ChatRuntime.resolvePlaceholderUrl` callback. Embedders that don't
 * wire the callback get no placeholder (the card's empty-state path
 * activates) — same fallback semantics as before.
 *
 * Backwards compat: explicit `placeholderUrl` prop ALWAYS wins over
 * runtime-derived value. Callers that pre-resolve (chat dispatch,
 * tests) are unaffected.
 */

import { useChatRuntime } from '../../../contexts/chat-runtime-context'
import { useOgPlaceholder } from '../../../hooks/use-og-placeholder'

export interface UseEntityCardPlaceholderArgs {
  /** Entity title — used as the placeholder label. */
  title: string | undefined | null
  /** Explicit override. When set, runtime resolver is skipped. */
  placeholderUrl?: string | null
  /** Site name shown under the title. Optional. */
  siteName?: string
  /** Output aspect ratio. `'wide'` (default) for catalog cards,
   *  `'square'` for compact chat-inline cards. */
  aspect?: 'wide' | 'square'
}

const NO_OP_BUILDER = () => ''

export function useEntityCardPlaceholder({
  title,
  placeholderUrl,
  siteName = '',
  aspect = 'wide',
}: UseEntityCardPlaceholderArgs): string | null {
  const runtime = useChatRuntime()
  const builder = runtime?.resolvePlaceholderUrl ?? NO_OP_BUILDER
  const enabled = placeholderUrl === undefined && !!runtime?.resolvePlaceholderUrl
  const derived = useOgPlaceholder(builder, title, siteName, enabled, aspect)
  // Explicit prop (including explicit null) wins; `undefined` falls back to derived.
  return placeholderUrl !== undefined ? placeholderUrl : derived
}
