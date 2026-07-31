/**
 * Mux CDN origins + playback-URL helpers — single source of truth, server-safe.
 *
 * Lives in its own NON-`'use client'` module so server-side hub
 * modules (webhook handlers, URL builders, hostname comparisons in
 * `lib/config/mux-config.ts`) can import these without
 * tripping Next.js's client-reference poisoning. Re-exported from
 * `use-video-warmup.ts` for backward-compat with client-side callers.
 *
 * The Mux-HLS detection in `toMuxPreviewUrl` intentionally overlaps the
 * hub's `lib/config/mux-config.ts` `isMuxHlsUrl` — same documented
 * cross-repo duplication umbrella as the origin constants (the hub's
 * server code cannot depend on this package's client-marked siblings).
 *
 * Bug history (2026-05-29): when these constants lived in
 * `use-video-warmup.ts` (which is `'use client'`), the hub's
 * server-side `new URL(MUX_STREAM_ORIGIN).hostname` evaluation crashed
 * at Vercel build with `TypeError: Invalid URL` — Next.js had
 * replaced the constant with a client-function stub that throws
 * "Attempted to call ... from the server" when stringified. Splitting
 * the constants into this module restores the server-safe path.
 *
 * These hostnames are part of Mux's public API contract and are
 * stable. A future change to the Mux CDN architecture (extremely
 * unlikely) would be a single-line edit here.
 */

/** HLS playback (`/{playback_id}.m3u8` + segments + per-asset MP4 renditions). */
export const MUX_STREAM_ORIGIN = 'https://stream.mux.com'

/** Server-generated thumbnails (`/{playback_id}/thumbnail.jpg`). */
export const MUX_IMAGE_ORIGIN = 'https://image.mux.com'

/** Valid values for Mux's `max_resolution` playback modifier (720p is the floor). */
export type MuxMaxResolution = '720p' | '1080p' | '1440p' | '2160p'

/**
 * Cap the renditions offered by a public Mux HLS manifest for small
 * preview players (e.g. the ~234px video-bite hover cards) by appending
 * Mux's `max_resolution` playback modifier.
 *
 * Why a URL param and not a player prop: MuxPlayer's `maxResolution`
 * prop only applies when playing via `playbackId` — our SSOT passes
 * `src` URLs. And on Safari (native HLS, no hls.js) manifest-level
 * filtering is the ONLY rendition cap; hls.js's `capLevelToPlayerSize`
 * doesn't exist there.
 *
 * Pass-through (returns `url` unchanged) for: non-Mux hosts (Supabase
 * MP4s, YouTube), non-`.m3u8` paths (MP4 renditions), signed URLs
 * (`?token=` — Mux forbids loose modifiers alongside a token; they must
 * live in the JWT), and unparseable strings.
 */
export function toMuxPreviewUrl(url: string, maxResolution: MuxMaxResolution = '720p'): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (parsed.origin !== MUX_STREAM_ORIGIN) return url
  if (!parsed.pathname.endsWith('.m3u8')) return url
  if (parsed.searchParams.has('token')) return url
  parsed.searchParams.set('max_resolution', maxResolution)
  return parsed.toString()
}
