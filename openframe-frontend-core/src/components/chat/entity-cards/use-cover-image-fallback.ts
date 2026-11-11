'use client';

/**
 * THE common cover-image fallback chain for entity cards:
 *   real cover → branded placeholder → nothing (hide the media element).
 *
 * One hook so no card hand-rolls its own `imageError` state / `displayImage`
 * ternary (they drift: the pre-hook BlogCard chain couldn't recover from a
 * FAILING placeholder, EntityPortraitCard duplicated the same logic with
 * different state). Cards wire `src` + `onError` and render their own
 * empty-state when `src` is null. The chain itself is `useImageFallback`.
 */

import type { SyntheticEvent } from 'react';
import { type ImageFallback, useImageFallback } from '../../../hooks/use-image-fallback';

export type CoverImageFallback = ImageFallback;

export function useCoverImageFallback(imageUrl?: string | null, placeholderUrl?: string | null): CoverImageFallback {
  return useImageFallback(imageUrl, placeholderUrl);
}

/** Fallback for cards with NO placeholder chain (compact/sm image slots):
 *  a broken cover simply disappears, leaving the slot's background.
 *  Legacy: a DOM write in `onError`, which the next src does not undo. New
 *  code renders nothing when `useImageFallback(url).src` is null instead. */
export const hideOnError = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  img.style.display = 'none';
};
