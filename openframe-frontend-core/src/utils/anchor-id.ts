/**
 * GitHub-compatible anchor resolution for in-page `#hash` links.
 *
 * ## The mismatch this exists to bridge
 *
 * Doc authors write their table of contents against GitHub's slugger, which
 * keeps the separator left behind by a stripped emoji:
 *
 *   `## 📚 Table of Contents`  →  GitHub anchor `#-table-of-contents`
 *
 * Our heading ids come from the shared slug SSOT (`markdown-heading-id`),
 * whose `slugifyHeadingBase` trims leading and trailing hyphens — so the same
 * heading renders as `id="table-of-contents"`. The "On this page" rail
 * navigates by those ids and works; the in-body TOC link points at an id that
 * does not exist and the browser silently does nothing.
 *
 * Rather than change the id shape (it is already baked into shared URLs and
 * the rail), resolution is made tolerant: compare a *normalized* form of both
 * sides. This module owns ONLY that tolerance — the slug chain itself is
 * imported, never re-implemented, so a change to the id shape lands in one
 * place and both sides move together.
 *
 * Callers do not reach for this directly: `getHashTargetElement`
 * (`utils/same-page-hash-nav`) is the ONE resolver every hash consumer goes
 * through, and it applies this as its last pass.
 */
import { slugifyHeadingText } from './markdown-heading-id'

/**
 * Reduce an anchor id (ours or GitHub's) to a comparable form.
 *
 * Everything but the final hyphen-run collapse is the shared heading-slug
 * chain: emoji strip → lowercase → drop non-word chars → spaces to hyphens →
 * trim edge hyphens. The collapse is this module's own addition, covering
 * GitHub's *interior* divergence — `## 💬 Community & Support` slugs to
 * `#-community--support` (a double hyphen around the dropped `&`) against our
 * `community-support`.
 *
 *   `'-getting-started'`     → `'getting-started'`
 *   `'-community--support'`  → `'community-support'`
 *   `'Getting Started'`      → `'getting-started'`
 */
export function normalizeAnchorId(raw: string): string {
  return slugifyHeadingText(raw).replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

/** Heading elements carrying an id — the candidate set for the fuzzy pass. */
const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'

/**
 * Resolve a `#hash` id that no exact lookup matched, by comparing normalized
 * forms. Returns `null` when nothing in the document matches, so the caller
 * can leave the browser's default behavior alone rather than hijacking a
 * click that was never ours to handle.
 *
 * Two passes, cheapest first:
 *   1. a single `getElementById` on the normalized id — catches the whole
 *      emoji-hyphen family without walking the DOM;
 *   2. a heading scan — catches ids whose own raw form normalizes differently
 *      (e.g. `a---b`, from a title containing a literal ` - `).
 */
export function findAnchorElementByNormalizedId(
  rawId: string,
  doc: Document,
): HTMLElement | null {
  const normalized = normalizeAnchorId(rawId)
  if (!normalized) return null

  if (normalized !== rawId) {
    const direct = doc.getElementById(normalized)
    if (direct) return direct
  }

  for (const heading of Array.from(doc.querySelectorAll<HTMLElement>(HEADING_SELECTOR))) {
    if (normalizeAnchorId(heading.id) === normalized) return heading
  }
  return null
}
