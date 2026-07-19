/**
 * Shared markdown section extractor
 * Extracts heading sections from markdown content for navigation.
 */

import { stripInlineMarkdown } from './markdown-to-plain'
import { slugifyHeadingBase, stripHeadingEmojis } from './markdown-heading-id'

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
  const lines = markdown.split('\n')
  const idCounts: Record<string, number> = {}

  let inCodeBlock = false
  let inYamlBlock = false

  for (const line of lines) {
    if (opts.skipCodeAndYamlBlocks) {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        continue
      }
      if (line === '---') {
        inYamlBlock = !inYamlBlock
        continue
      }
      if (inCodeBlock || inYamlBlock) continue
    }

    const pattern = new RegExp(`^(#{1,${opts.maxLevel}})\\s+(.+)`)
    const match = line.match(pattern)
    if (!match) continue

    const level = match[1].length
    if (level > opts.maxLevel) continue

    let title = match[2].trim()

    if (opts.stripFormattingMarkers) {
      title = stripInlineMarkdown(title).trim()
    }

    // Slug chain SSOT — shared with the renderers' heading-id generator
    // (see utils/markdown-heading-id.ts). Extractor and renderers MUST
    // agree or deep-link anchors silently diverge.
    const baseId = slugifyHeadingBase(
      opts.removeEmojis ? stripHeadingEmojis(title) : title,
    )

    const cleanId = baseId || `section-${sections.length + 1}`

    let id = cleanId
    if (opts.handleDuplicateIds) {
      if (idCounts[cleanId]) {
        idCounts[cleanId]++
        id = `${cleanId}-${idCounts[cleanId]}`
      } else {
        idCounts[cleanId] = 1
      }
    }

    sections.push({ id, title, level })
  }

  return sections
}
