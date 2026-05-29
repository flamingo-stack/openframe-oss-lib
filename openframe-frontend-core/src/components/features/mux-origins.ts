/**
 * Mux CDN origin constants — single source of truth, server-safe.
 *
 * Lives in its own NON-`'use client'` module so server-side hub
 * modules (webhook handlers, URL builders, hostname comparisons in
 * `lib/config/mux-config.ts`) can import these strings without
 * tripping Next.js's client-reference poisoning. Re-exported from
 * `use-video-warmup.ts` for backward-compat with client-side callers.
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
