/**
 * Heading-id generation for the unified markdown engine.
 *
 * Slug algorithm lives in the server-safe SSOT `utils/markdown-heading-id`
 * (shared with `utils/markdown-section-extractor`, the producer of
 * `sectionIds`). This module adds the renderer-side concerns: backend
 * sectionId matching and per-render duplicate suffixing.
 */
import { useCallback, useMemo, useRef } from 'react'
import { stripHeadingEmojis, slugifyHeadingText } from '../../../utils/markdown-heading-id'

export interface HeadingSection {
  id: string
  title: string
  level: number
}

export function useHeadingIdGenerator(sectionIds?: HeadingSection[]) {
  const idCountsRef = useRef<Record<string, number>>({})

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

  const generateHeadingId = useCallback(
    (text: string, level: number): string => {
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
          if (id) return id
        }
      }
      const baseId = slugifyHeadingText(text)
      const cleanId = baseId || `section-${Object.keys(idCountsRef.current).length + 1}`
      if (idCountsRef.current[cleanId]) {
        idCountsRef.current[cleanId]++
        return `${cleanId}-${idCountsRef.current[cleanId]}`
      }
      idCountsRef.current[cleanId] = 1
      return cleanId
    },
    [sectionIds, sectionIdMap],
  )

  return generateHeadingId
}

/** Extract plain text from React children (headings receive mixed nodes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
