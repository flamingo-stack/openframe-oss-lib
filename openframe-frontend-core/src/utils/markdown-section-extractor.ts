/**
 * Shared markdown section extractor
 * Extracts heading sections from markdown content for navigation.
 */

import { stripInlineMarkdown } from './markdown-to-plain'
import {
  createHeadingIdDeduper,
  scanHeadings,
  slugifyHeadingBase,
  stripHeadingEmojis,
} from './markdown-heading-id'

export interface MarkdownSection {
  id: string
  title: string
  level: number
}

export interface ExtractSectionsOptions {
  /** Maximum heading level to include (default: 2 = H1-H2) */
  maxLevel?: number
  /** Remove emoji characters from IDs (default: true) */
  removeEmojis?: boolean
  /** Handle duplicate IDs by appending a counter suffix (default: true) */
  handleDuplicateIds?: boolean
  /** Strip bold, italic, and inline code markers from titles (default: true) */
  stripFormattingMarkers?: boolean
  /** Skip code blocks and YAML frontmatter (default: true) */
  skipCodeAndYamlBlocks?: boolean
}

const DEFAULT_OPTIONS: Required<ExtractSectionsOptions> = {
  maxLevel: 2,
  removeEmojis: true,
  handleDuplicateIds: true,
  stripFormattingMarkers: true,
  skipCodeAndYamlBlocks: true,
}

export function extractSections(
  markdown: string,
  options: ExtractSectionsOptions = {},
): MarkdownSection[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const sections: MarkdownSection[] = []
  const dedupe = createHeadingIdDeduper()

  // ONE scanner, shared with the renderer's heading-id map
  // (utils/markdown-heading-id.ts). This file used to carry its own
  // line loop — `line.startsWith('```')` for fences (blind to `~~~`, to
  // longer backtick runs and to the CommonMark 0..3-space indent) and a
  // bare `line === '---'` YAML toggle (which a mid-document thematic break
  // or setext underline tripped, swallowing every heading after it). Both
  // produced sections the renderer emitted no id for.
  const scanned = scanHeadings(markdown, {
    skipFrontmatter: opts.skipCodeAndYamlBlocks,
    skipFences: opts.skipCodeAndYamlBlocks,
  })

  for (const heading of scanned) {
    if (heading.level > opts.maxLevel) continue

    let title = heading.text
    if (opts.stripFormattingMarkers) {
      title = stripInlineMarkdown(title).trim()
    }

    // Slug chain SSOT — shared with the renderers' heading-id generator
    // (see utils/markdown-heading-id.ts). Extractor and renderers MUST
    // agree or deep-link anchors silently diverge.
    const baseId = slugifyHeadingBase(
      opts.removeEmojis ? stripHeadingEmojis(title) : title,
    )

    // Symbol-only heading fallback: the 1-based ordinal among the headings
    // this extractor EMITS (levels ≤ maxLevel). The renderer's heading-id
    // generator mirrors this exact counter for levels ≤ 2
    // (components/ui/markdown/heading-ids.ts) — the two must agree or
    // deep-link anchors diverge for symbol-only headings.
    const cleanId = baseId || `section-${sections.length + 1}`

    sections.push({
      id: opts.handleDuplicateIds ? dedupe(cleanId) : cleanId,
      title,
      level: heading.level,
    })
  }

  return sections
}
