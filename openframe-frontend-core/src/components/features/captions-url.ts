/**
 * Build the captions API URL for a video entity.
 *
 * Returns the HTTPS URL to the `/api/captions/[entityType]/[entityId]` endpoint
 * which serves VTT content for iOS native fullscreen subtitles.
 * Returns undefined if entity has no srt_content.
 *
 * Cache-busting hash derived from the srt_content length so iOS Safari
 * fetches fresh VTT when subtitles are regenerated (Safari aggressively caches
 * <track> src URLs even with short Cache-Control max-age).
 *
 * Lifted from hub `lib/utils/captions-url.ts`. The hub's hard-coded
 * `VideoEnabledEntityType` enum is widened to `string` here — embedders
 * pass whatever entity-type discriminator their reverse-proxied
 * `/api/captions/...` route expects.
 */
export function getCaptionsUrl(
  entityType: string,
  entityId: string | number,
  srtContent?: string | null,
): string | undefined {
  if (!srtContent) return undefined
  const hash = `${srtContent.length}-${srtContent.slice(0, 8).replace(/\s/g, '')}`
  return `/api/captions/${entityType}/${entityId}?v=${hash}`
}
