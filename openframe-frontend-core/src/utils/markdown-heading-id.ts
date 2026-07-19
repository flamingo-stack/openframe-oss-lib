/**
 * Markdown heading-id slug SSOT (server-safe: no React, no DOM).
 *
 * This algorithm previously existed in THREE byte-identical copies:
 *   - `components/ui/simple-markdown-renderer.tsx` (generateHeadingId)
 *   - `components/ui/rich-markdown-renderer.tsx` (generateHeadingId)
 *   - `utils/markdown-section-extractor.ts` (extractSections)
 *
 * The extractor is the PRODUCER of `sectionIds` and the renderers are the
 * CONSUMERS — if the two ever drift, deep-link anchors and scroll-spy
 * targets silently diverge. All three now call these helpers; the parity
 * test `components/ui/__tests__/markdown-parity.test.tsx` asserts
 * extractor-vs-renderer ID agreement over the fixture corpus.
 */

/** Emoji ranges stripped from heading text before slugification. */
export const HEADING_EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu

/** Remove emoji characters and trim. */
export function stripHeadingEmojis(text: string): string {
  return text.replace(HEADING_EMOJI_RE, '').trim()
}

/**
 * Core slug chain WITHOUT the emoji strip (the extractor exposes emoji
 * stripping as an option, so the two steps are kept separable):
 * lowercase → drop non-word/space/hyphen chars → spaces to hyphens →
 * trim leading/trailing hyphens. May return `''` for symbol-only input —
 * callers apply their own fallback (`section-N`).
 */
export function slugifyHeadingBase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The full default chain used by the renderers: emoji strip + slugify. */
export function slugifyHeadingText(text: string): string {
  return slugifyHeadingBase(stripHeadingEmojis(text))
}
