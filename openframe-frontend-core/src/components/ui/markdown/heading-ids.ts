/**
 * Heading-id derivation for the unified markdown engine.
 *
 * PURE BY CONSTRUCTION. The previous design was a stateful generator whose
 * per-pass counters were reset in the engine's render body, and it was
 * unsound in two independent ways:
 *   - memoized streaming blocks do NOT re-render on the pass that resets the
 *     counter, so mid-stream a document with two `## Setup` headings emitted
 *     `id="setup"` TWICE (block 0 kept its id; the re-rendered tail
 *     re-derived from an empty counter) — invalid HTML, and `#setup`
 *     resolved to the wrong node for the rest of the stream;
 *   - React StrictMode double-invokes render, and heading renderers are
 *     element types re-rendered independently of the parent that did the
 *     reset, so every id gained a `-2` suffix in dev and extractor↔renderer
 *     parity broke.
 *
 * Instead the ids are computed ONCE from the processed markdown source, in a
 * `useMemo`, into a `line → id` map. The heading renderer is a pure lookup
 * by `node.position.start.line`; nothing is derived from render order, so
 * memo bails and StrictMode double-invocation are both no-ops.
 *
 * The slug algorithm itself lives in the server-safe SSOT
 * `utils/markdown-heading-id` (shared with `utils/markdown-section-extractor`,
 * the producer of `sectionIds`); the title normalization mirrors the
 * extractor's `stripInlineMarkdown` so `## **Setup**` slugs identically on
 * both sides.
 */
import { createContext, useContext, useMemo } from 'react'
import { stripHeadingEmojis, slugifyHeadingText } from '../../../utils/markdown-heading-id'
import { stripInlineMarkdown } from '../../../utils/markdown-to-plain'

export interface HeadingSection {
  id: string
  title: string
  level: number
}

/** `line (1-based, document-wide) → heading id`. */
export type HeadingIdMap = ReadonlyMap<number, string>

/**
 * Heading levels the section extractor sees (`extractSections`'s default
 * `maxLevel`). The `section-N` fallback ordinal counts only these, so
 * renderer and extractor agree on the fallback slug for symbol-only
 * headings (see the fallback comment below).
 */
const EXTRACTOR_MAX_LEVEL = 2

/** CommonMark ATX heading (closing `#` run is not part of the title). */
const ATX_HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
/** Raw-HTML heading (`<h2 id="x">Title</h2>`) — rehype-raw renders these too. */
const RAW_HEADING_RE = /<h([1-6])\b[^>]*>([\s\S]*?)(?:<\/h\1>|$)/i
/** Fenced-code delimiter, same indent cap as ./streaming.ts. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

interface ScannedHeading {
  line: number
  level: number
  text: string
}

/**
 * Line offset added to unit-relative hast positions. Non-zero only on the
 * streaming path, where each atomic unit is parsed by its own
 * `ReactMarkdown` (see `StreamingBlock.startLine`).
 */
export const HeadingLineOffsetContext = createContext(0)

const EMPTY_HEADING_IDS: HeadingIdMap = new Map()

/**
 * The document's heading-id map, delivered by CONTEXT rather than baked into
 * the react-markdown `components` map on purpose: the map is rebuilt on every
 * streamed token (its input is the growing `processedContent`), so listing it
 * as a `components` memo dep would change that map's identity each token and
 * make every completed streaming block's `memo` bail — the exact regression
 * `NO_BROKEN_LINKS` was introduced to fix. Through context only the heading
 * renderers re-render.
 */
export const HeadingIdMapContext = createContext<HeadingIdMap>(EMPTY_HEADING_IDS)

/** Look up the pre-computed id for a heading hast node. Pure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useHeadingId(node: any): string | undefined {
  const map = useContext(HeadingIdMapContext)
  const offset = useContext(HeadingLineOffsetContext)
  const line = node?.position?.start?.line
  return typeof line === 'number' ? map.get(line + offset) : undefined
}

/** Collect every heading the renderer will emit, in document order. */
function scanHeadings(content: string): ScannedHeading[] {
  const out: ScannedHeading[] = []
  const lines = content.split('\n')
  let fenceChar: string | null = null
  let fenceLength = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = FENCE_RE.exec(line)
    if (fence) {
      const run = fence[1]
      if (fenceChar === null) {
        fenceChar = run[0]
        fenceLength = run.length
      } else if (
        run[0] === fenceChar &&
        run.length >= fenceLength &&
        fence[2].trim() === ''
      ) {
        fenceChar = null
        fenceLength = 0
      }
      continue
    }
    if (fenceChar !== null) continue

    const atx = ATX_HEADING_RE.exec(line)
    if (atx) {
      out.push({
        line: i + 1,
        level: atx[1].length,
        // Match what `extractText(children)` yields from the RENDERED
        // inline nodes: emphasis/code/link syntax is markup, not text.
        text: stripInlineMarkdown(atx[2]).trim(),
      })
      continue
    }

    const raw = RAW_HEADING_RE.exec(line)
    if (raw) {
      out.push({
        line: i + 1,
        level: Number(raw[1]),
        text: raw[2].replace(/<[^>]*>/g, '').trim(),
      })
    }
  }
  return out
}

/**
 * Build the document's `line → id` map. Pure: same content + same
 * `sectionIds` always yields the same map.
 */
export function buildHeadingIdMap(
  content: string,
  sectionIds?: HeadingSection[],
): HeadingIdMap {
  const sectionIdMap = new Map<string, string>()
  if (sectionIds) {
    for (const section of sectionIds) {
      sectionIdMap.set(section.title, section.id)
      sectionIdMap.set(section.title.toLowerCase(), section.id)
      sectionIdMap.set(stripHeadingEmojis(section.title).toLowerCase(), section.id)
    }
  }

  const idCounts: Record<string, number> = {}
  const dedupe = (cleanId: string): string => {
    if (idCounts[cleanId]) {
      idCounts[cleanId]++
      return `${cleanId}-${idCounts[cleanId]}`
    }
    idCounts[cleanId] = 1
    return cleanId
  }

  const map = new Map<number, string>()
  let sectionOrdinal = 0
  let headingOrdinal = 0

  for (const { line, level, text } of scanHeadings(content)) {
    headingOrdinal++
    if (level <= EXTRACTOR_MAX_LEVEL) sectionOrdinal++

    // Backend-provided ids win for H1/H2 (deep-link anchors). They go
    // through the SAME dedup rather than trusting the backend to own
    // uniqueness: `sectionIdMap` is keyed by heading TITLE, so two identical
    // `## Setup` headings look up the same entry and would emit duplicate
    // DOM ids. The dedup makes the second one `setup-2`, exactly matching
    // what `extractSections` produces for the same document.
    let assigned: string | undefined
    if (sectionIds && level <= EXTRACTOR_MAX_LEVEL) {
      for (const variation of [
        text,
        text.toLowerCase(),
        stripHeadingEmojis(text),
        stripHeadingEmojis(text).toLowerCase(),
      ]) {
        const id = sectionIdMap.get(variation)
        if (id) {
          assigned = dedupe(id)
          break
        }
      }
    }

    if (assigned === undefined) {
      const baseId = slugifyHeadingText(text)
      // Symbol-only heading (slug collapses to ''). `extractSections` falls
      // back to `section-${sections.length + 1}` — its ordinal among the
      // headings it SEES, i.e. levels ≤ maxLevel. Mirror that exactly for
      // H1/H2 so extractor↔renderer slugs stay in total agreement; deeper
      // headings, which the extractor never emits, get their own
      // `heading-N` namespace so they can never collide with a `section-N`.
      assigned = dedupe(
        baseId ||
          (level <= EXTRACTOR_MAX_LEVEL
            ? `section-${sectionOrdinal}`
            : `heading-${headingOrdinal}`),
      )
    }

    map.set(line, assigned)
  }

  return map
}

/** Memoized `buildHeadingIdMap` for the engine. */
export function useHeadingIdMap(
  content: string,
  sectionIds?: HeadingSection[],
): HeadingIdMap {
  return useMemo(() => buildHeadingIdMap(content, sectionIds), [content, sectionIds])
}

/** Extract plain text from React children (headings receive mixed nodes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
