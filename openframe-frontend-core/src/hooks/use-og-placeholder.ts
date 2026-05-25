'use client'

import { useMemo } from 'react'

/**
 * Hook that generates a branded placeholder image URL using the
 * host's `/api/og-placeholder` server-side image generator (or any
 * builder the caller supplies).
 *
 * THIS HOOK IS A THIN CLIENT-SIDE WRAPPER. The hub-side wrapper
 * (`hooks/use-og-placeholder.ts` in multi-platform-hub) injects its
 * canonical `buildOgPlaceholderUrl` from `lib/utils/entity-image.ts`.
 * The lib version takes the builder as an argument so the lib has no
 * hub dependency.
 *
 * @param buildUrl - Function that builds the placeholder URL from a
 *                   title + options object (`{ site?, aspect? }`).
 *                   Hub passes `buildOgPlaceholderUrl` from
 *                   `lib/utils/entity-image.ts`. Embedded apps can
 *                   wire any equivalent that hits their own placeholder
 *                   route.
 * @param title    - Text to display on the placeholder
 * @param siteName - Site name shown below the title (optional —
 *                   defaults to empty)
 * @param enabled  - Whether to generate the URL (default: true)
 * @param aspect   - `'wide'` (1200×630 social-card; default) or `'square'`
 *                   (1024×1024 — used by compact chat-inline card slots
 *                   so `object-cover` doesn't crop the title off).
 * @returns Placeholder image URL or null if disabled / no title
 */
export function useOgPlaceholder(
  buildUrl: (title: string, options: { site?: string; aspect?: 'wide' | 'square' }) => string,
  title: string | undefined | null,
  siteName: string = '',
  enabled: boolean = true,
  aspect: 'wide' | 'square' = 'wide',
): string | null {
  return useMemo(() => {
    if (!enabled || !title) return null
    const options: { site?: string; aspect?: 'wide' | 'square' } = {}
    if (siteName) options.site = siteName
    if (aspect === 'square') options.aspect = 'square'
    return buildUrl(title, options)
  }, [buildUrl, title, siteName, enabled, aspect])
}
