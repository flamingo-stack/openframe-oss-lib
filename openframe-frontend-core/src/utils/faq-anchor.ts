/**
 * FAQ category anchor — single source of truth.
 *
 * The standalone `/faqs` page renders each category section with an
 * `id="${faqSectionSlug(section)}"` attribute (see `components/faq/faq-section.tsx`).
 * The hub's RAG mapper (`lib/config/rag-mappers/faq.ts`) deep-links chat
 * citations to those anchors so a `[card://faq:<id>]` chip lands on the right
 * category instead of the top of the page.
 *
 * Format: `faq-<lowercased, non-alnum collapsed to dashes, trimmed>`.
 *   "Pricing"        → "faq-pricing"
 *   "AI for MSPs"    → "faq-ai-for-msps"
 *   "Cost & Savings" → "faq-cost-savings"
 *
 * The `faq-` prefix prevents in-page id collisions with other surfaces and
 * guarantees a valid id even for blank or numeric-only section names. The
 * helper assumes the caller has already verified the section is a non-blank
 * string (matches `faq-section.tsx`'s `groupFaqsBySection` precondition).
 */
export function faqSectionSlug(section: string): string {
  return (
    'faq-' +
    section
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}
