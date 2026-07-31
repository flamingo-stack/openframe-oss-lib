'use client'

/**
 * THE common cover-image fallback chain for entity cards:
 *   real cover → branded placeholder → nothing (hide the media element).
 *
 * One hook so no card hand-rolls its own `imageError` state / `displayImage`
 * ternary (they drift: the pre-hook BlogCard chain couldn't recover from a
 * FAILING placeholder, EntityPortraitCard duplicated the same logic with
 * different state). Cards wire `src` + `onError` and render their own
 * empty-state when `src` is null.
 *
 * Implementation note: state is the SET of candidate URLs that failed, and
 * `src` is derived — so a prop change (new cover URL) re-resolves instantly
 * with no reset effect, and a URL that failed once isn't retried in a loop.
 */

import { useCallback, useState, type SyntheticEvent } from 'react'

export interface CoverImageFallback {
  /** Resolved source: first non-failed of [imageUrl, placeholderUrl], else null. */
  src: string | null
  /** Wire to the media element's `onError`. */
  onError: () => void
}

export function useCoverImageFallback(
  imageUrl?: string | null,
  placeholderUrl?: string | null,
): CoverImageFallback {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())

  const src =
    imageUrl && !failed.has(imageUrl) ? imageUrl
    : placeholderUrl && !failed.has(placeholderUrl) ? placeholderUrl
    : null

  const onError = useCallback(() => {
    if (!src) return
    setFailed(prev => new Set(prev).add(src))
  }, [src])

  return { src, onError }
}

/** Fallback for cards with NO placeholder chain (compact/sm image slots):
 *  a broken cover simply disappears, leaving the slot's background. */
export const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => {
  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
}
