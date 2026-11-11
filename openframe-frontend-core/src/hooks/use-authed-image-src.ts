'use client';

import { type AuthedAsset, clearAuthedAssetCache, useAuthedAsset } from './use-authed-asset-src';

/**
 * Image flavor of `useAuthedAsset` — see that hook for the full contract. The
 * one place a picture's `Accept` is stated: a store entry keeps the `Accept` of
 * whichever consumer acquired it first, so the boxed `Image` and every picture
 * component around it must ask the same.
 *
 * Distinct from the legacy `useAuthenticatedImage`, which ALWAYS blob-fetches
 * with `credentials: 'include'` and its own global config. This hook is
 * pass-through-first and keys off the single auth knob the lib already has:
 * the registered `EmbedAuthAdapter`.
 */
export function useAuthedImage(src?: string | null): AuthedAsset {
  return useAuthedAsset(src, 'image/*');
}

/**
 * `useAuthedImage`'s `src`. Kept as its own export because it is the lib's
 * most-used consumer (avatars, entity images, markdown `<img>`) and because
 * hosts already import this name.
 */
export function useAuthedImageSrc(src?: string | null): string | undefined {
  return useAuthedImage(src).src;
}

/**
 * Session-end cache drop. Now an alias of `clearAuthedAssetCache` — one cache
 * backs every authed asset (images AND caption tracks), so hosts keep calling
 * this single function on logout / forced re-login.
 */
export const clearAuthedImageCache = clearAuthedAssetCache;
