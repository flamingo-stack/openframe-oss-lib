/**
 * Heading-id generation for the unified markdown engine.
 *
 * Slug algorithm lives in the server-safe SSOT `utils/markdown-heading-id`
 * (shared with `utils/markdown-section-extractor`, the producer of
 * `sectionIds`). This module adds the renderer-side concerns: backend
 * sectionId matching and per-render duplicate suffixing.
 */
import { useMemo, useRef } from 'react'
import { stripHeadingEmojis, slugifyHeadingText } from '../../../utils/markdown-heading-id'

export interface HeadingSection {
  id: string
  title: string
  level: number
}

/**
 * Heading-id generator with a per-render-pass duplicate counter.
 *
 * `reset()` MUST be called at the top of every render pass that will render
 * headings (the engine does this in its render body). The counter is
 * per-instance state; without the reset, re-rendering the SAME content
 * yields `setup-2`, `setup-3`, … on each pass, so every `#anchor` deep link
 * breaks — catastrophically during streaming, where the tail re-renders per
 * token.
 */
export interface HeadingIdGenerator {
  (text: string, level: number): string
  /** Clear the per-pass duplicate + ordinal counters. */
  reset(): void
}

/**
 * Heading levels the section extractor sees (`extractSections`'s default
 * `maxLevel`). The `section-N` fallback ordinal counts only these, so
 * renderer and extractor agree on the fallback slug for symbol-only
 * headings (see the fallback comment below).
 */
const EXTRACTOR_MAX_LEVEL = 2

export function useHeadingIdGenerator(sectionIds?: HeadingSection[]): HeadingIdGenerator {
  const idCountsRef = useRef<Record<string, number>>({})
  const sectionOrdinalRef = useRef(0)
  const headingOrdinalRef = useRef(0)

  const sectionIdMap = useMemo(() => {
    const map = new Map<string, string>()
    if (sectionIds) {
      sectionIds.forEach((section) => {
        const cleanTitle = stripHeadingEmojis(section.title).toLowerCase()
        map.set(section.title.toLowerCase(), section.id)
        map.set(cleanTitle, section.id)
        map.set(section.title, section.id)
      })
    }
    return map
  }, [sectionIds])

  return useMemo<HeadingIdGenerator>(() => {
    /** Apply the shared per-pass dedup suffix to a candidate id. */
    const dedupe = (cleanId: string): string => {
      if (idCountsRef.current[cleanId]) {
        idCountsRef.current[cleanId]++
        return `${cleanId}-${idCountsRef.current[cleanId]}`
      }
      idCountsRef.current[cleanId] = 1
      return cleanId
    }

    const generate = ((text: string, level: number): string => {
      headingOrdinalRef.current++
      if (level <= EXTRACTOR_MAX_LEVEL) sectionOrdinalRef.current++

      // Backend-provided ids win for H1/H2 (deep-link anchors).
      if (sectionIds && (level === 1 || level === 2)) {
        const variations = [
          text,
          text.toLowerCase(),
          stripHeadingEmojis(text),
          stripHeadingEmojis(text).toLowerCase(),
        ]
        for (const v of variations) {
          const id = sectionIdMap.get(v)
          // Run the backend id through the SAME dedup rather than trusting
          // the backend to own uniqueness: `sectionIdMap` is keyed by
          // heading TITLE, so two identical `## Setup` headings both look
          // up the same entry and would emit duplicate DOM ids (invalid
          // HTML, and `#setup` resolution becomes order-dependent). The
          // dedup makes the second one `setup-2`, exactly matching what
          // `extractSections` produces for the same document.
          if (id) return dedupe(id)
        }
      }

      const baseId = slugifyHeadingText(text)
      if (baseId) return dedupe(baseId)

      // Symbol-only heading (slug collapses to ''). `extractSections` falls
      // back to `section-${sections.length + 1}` — its ordinal among the
      // headings it SEES, i.e. levels ≤ maxLevel. Mirror that exactly for
      // H1/H2 so extractor↔renderer slugs stay in total agreement; deeper
      // headings, which the extractor never emits, get their own
      // `heading-N` namespace so they can never collide with a `section-N`.
      const fallback =
        level <= EXTRACTOR_MAX_LEVEL
          ? `section-${sectionOrdinalRef.current}`
          : `heading-${headingOrdinalRef.current}`
      return dedupe(fallback)
    }) as HeadingIdGenerator

    generate.reset = () => {
      idCountsRef.current = {}
      sectionOrdinalRef.current = 0
      headingOrdinalRef.current = 0
    }

    return generate
  }, [sectionIds, sectionIdMap])
}

/** Extract plain text from React children (headings receive mixed nodes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
