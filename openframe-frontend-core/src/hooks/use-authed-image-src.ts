'use client'

import { clearAuthedAssetCache, useAuthedAssetSrc } from './use-authed-asset-src'

/**
 * Image flavor of `useAuthedAssetSrc` — see that hook for the full contract.
 * Kept as its own export because it is the lib's most-used consumer (avatars,
 * entity images, markdown `<img>`) and because hosts already import this name.
 *
 * Distinct from the legacy `useAuthenticatedImage`, which ALWAYS blob-fetches
 * with `credentials: 'include'` and its own global config. This hook is
 * pass-through-first and keys off the single auth knob the lib already has:
 * the registered `EmbedAuthAdapter`.
 */
export function useAuthedImageSrc(src?: string | null): string | undefined {
  return useAuthedAssetSrc(src, 'image/*')
}

/**
 * Session-end cache drop. Now an alias of `clearAuthedAssetCache` — one cache
 * backs every authed asset (images AND caption tracks), so hosts keep calling
 * this single function on logout / forced re-login.
 */
export const clearAuthedImageCache = clearAuthedAssetCache
