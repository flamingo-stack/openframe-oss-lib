/**
 * FAQ anchor SSOTs — TWO complementary deep-link kinds on the `/faqs` page,
 * both rendered straight onto the DOM and recognised by ONE parser. Keeping
 * the format helpers + parser in one file means the page, the chat RAG
 * mapper, and any future consumer can't drift on what a hash means.
 *
 *   `/faqs#faq-pricing`     → category section header (jump-nav pills,
 *                             scroll-spy)
 *   `/faqs#faq-item-42`     → individual question (chat citation chips —
 *                             auto-expands the row + scrolls to it)
 *
 * Reserved namespaces — `faq-item-<digits>` is the item shape; everything
 * else starting with `faq-` is a section slug. `faqSectionSlug` lowercases
 * + dash-collapses + dash-trims, so a section name would only collide with
 * the item shape if it slugified to `faq-item-<digits-only>` (e.g. a
 * category called "Item 42") — none of the 21 production sections do, and
 * `parseFaqHash`'s regex is digits-only so future word-suffixed names like
 * "Item Whatever" (slugifies to `faq-item-whatever`) are also safe.
 */

/** Stable, URL-safe anchor id for a category. Prefixed with `faq-` so it
 *  can't collide with other in-page ids, and so a bare numeric/blank
 *  section still yields a valid id. The helper assumes the caller has
 *  already verified the section is a non-blank string (matches
 *  `faq-section.tsx`'s `groupFaqsBySection` precondition). */
export function faqSectionSlug(section: string): string {
  return (
    'faq-' +
    section
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/** Stable anchor for an individual FAQ row. Rendered as the row container's
 *  `id` attribute by `FaqAccordion`; consumed by `FaqSection` (auto-open +
 *  auto-scroll on mount) AND by the hub's RAG mapper so chat citations
 *  deep-link to the specific question, not just its category. The id is
 *  stringified verbatim — the FAQ schema uses integer PKs so `parseFaqHash`'s
 *  digits-only regex always matches a real row. */
export function faqItemAnchor(id: number | string): string {
  return `faq-item-${id}`
}

/** Discriminated parse of a `/faqs#…` hash. Returns null for an empty,
 *  missing, or unrecognised hash so callers can early-out without
 *  scattering string parsing across the file.
 *
 *   parseFaqHash('#faq-item-42')   → { kind: 'item',    rawId: '42' }
 *   parseFaqHash('#faq-pricing')   → { kind: 'section', slug: 'faq-pricing' }
 *   parseFaqHash('#anything-else') → null
 *
 * `rawId` is the matched digit run as a string — the caller compares it
 * to `String(item.id)` so coercion stays at the comparison site. */
export type FaqHashTarget =
  | { kind: 'item';    rawId: string }
  | { kind: 'section'; slug:  string }

const FAQ_ITEM_HASH_RE = /^faq-item-(\d+)$/

export function parseFaqHash(hash: string | null | undefined): FaqHashTarget | null {
  if (!hash) return null
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  const itemMatch = FAQ_ITEM_HASH_RE.exec(trimmed)
  if (itemMatch) return { kind: 'item', rawId: itemMatch[1] }
  if (trimmed.startsWith('faq-')) return { kind: 'section', slug: trimmed }
  return null
}
