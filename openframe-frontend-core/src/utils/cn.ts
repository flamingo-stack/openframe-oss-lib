import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
// Platform→domain resolution moved to the SSOT module `src/platform-domains.ts`.
// `getPlatformProductionUrl` / `getAllPlatformBaseDomains` now live there (re-exported
// via the utils barrel for existing callers); `getBaseUrl` stays here because it owns the
// dev-localhost + Vercel-self-origin branches, and delegates its platform branch.
import { getPlatformProductionUrl } from "../platform-domains"

/**
 * EVERY custom `text-*` utility we add in `tailwind.config.ts` MUST be listed here.
 *
 * tailwind-merge has no knowledge of our utilities, and `text-<word>` is
 * indistinguishable from a text COLOUR to it. So an unlisted `text-badge` gets
 * filed in tailwind-merge's `text-color` group, where it and any real colour
 * class silently annihilate each other — last one wins, the other is dropped
 * from the output entirely:
 *
 *   cn('text-badge', 'text-ods-text-on-accent')  -> 'text-ods-text-on-accent'  (size lost)
 *   cn('text-[--some-colour]', 'text-badge')     -> 'text-badge'               (colour lost)
 *
 * Listing them in their own group makes them non-conflicting with colours, so
 * both survive. This is why `text-h1`…`text-h6` are here; `text-code` and
 * `text-badge` were added to the config later and missing them shipped exactly
 * the two failures above (huge badges, and badge text losing its colour).
 */
const twMerge = extendTailwindMerge<'ods-typography'>({
  extend: {
    classGroups: {
      'ods-typography': [
        'text-h1',
        'text-h2',
        'text-h3',
        'text-h4',
        'text-h5',
        'text-h6',
        'text-code',
        'text-badge',
      ],
    },
  },
})

/**
 * Combine class names with Tailwind's merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the application base URL for the current environment
 *
 * @param platform - Optional platform name (openmsp, flamingo, tmcg, openframe, etc.)
 * @returns The base URL with protocol (https:// or http://)
 *
 * Priority order:
 * 1. Development (http://localhost:3000)
 * 2. Platform-specific URL via the SSOT (if `platform` provided) — env override ?? default
 * 3. VERCEL_PROJECT_PRODUCTION_URL (Vercel production domain)
 * 4. Production fallback: the DEPLOYING platform's canonical URL (NEXT_PUBLIC_APP_TYPE),
 *    openmsp if unset — sourced from the SSOT, no hardcoded literal.
 *
 * The per-platform canonical URLs + their `NEXT_PUBLIC_*_URL` overrides are the single
 * source of truth in `src/platform-domains.ts` (`PLATFORM_DOMAINS`).
 *
 * @example
 * getBaseUrl() // Current deployment's URL
 * getBaseUrl('flamingo') // https://www.flamingo.run (prod) or http://localhost:3000 (dev)
 */
export function getBaseUrl(platform?: string): string {
  // In development, always use localhost (regardless of platform)
  if (process.env.NODE_ENV !== 'production') {
    return process.env.NEXT_PUBLIC_DEV_URL || 'http://localhost:3000'
  }

  // If platform is specified, return its production URL (env override ?? default)
  if (platform) {
    return getPlatformProductionUrl(platform)
  }

  // Production: Use Vercel domain if available
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Production fallback: the deploying platform's canonical www domain (avoids Google
  // "Page with redirect"). Derived from the SSOT for the current app type (openmsp when
  // unset → 'https://www.openmsp.ai', byte-identical to the old hardcoded fallback).
  return getPlatformProductionUrl(process.env.NEXT_PUBLIC_APP_TYPE || 'openmsp')
}
