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
import { createContext, useContext, useMemo, useRef } from 'react'
import {
  createHeadingIdDeduper,
  scanHeadings,
  stripHeadingEmojis,
  slugifyHeadingText,
} from '../../../utils/markdown-heading-id'
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

  // Deduper AND scanner are the shared SSOT primitives the extractor also
  // instantiates — see utils/markdown-heading-id.ts.
  const dedupe = createHeadingIdDeduper()

  const map = new Map<number, string>()
  let sectionOrdinal = 0
  let headingOrdinal = 0

  for (const { line, level, text: rawText } of scanHeadings(content)) {
    // Match what `extractText(children)` yields from the RENDERED inline
    // nodes: emphasis/code/link syntax is markup, not text. (The extractor
    // applies the identical strip via `stripFormattingMarkers`.)
    const text = stripInlineMarkdown(rawText).trim()
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

/** True when two id maps have identical entries (order-insensitive). */
function sameHeadingIdMap(a: HeadingIdMap, b: HeadingIdMap): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const [line, id] of a) {
    if (b.get(line) !== id) return false
  }
  return true
}

/**
 * Memoized `buildHeadingIdMap` for the engine, with the map's IDENTITY held
 * stable across content changes that don't touch any heading.
 *
 * `content` changes on every streamed token, so the `useMemo` alone rebuilt
 * a fresh `Map` per token; that map is the context value, so EVERY heading
 * consumer in every already-completed block re-rendered on every token —
 * the same identity-churn class `NO_BROKEN_LINKS` exists to prevent, just
 * one layer down. Rebuilding is cheap; re-rendering the consumers is not, so
 * the newly built map is compared to the previous one and the previous
 * object is returned when the entries match.
 */
export function useHeadingIdMap(
  content: string,
  sectionIds?: HeadingSection[],
): HeadingIdMap {
  const previous = useRef<HeadingIdMap | null>(null)
  return useMemo(() => {
    const next = buildHeadingIdMap(content, sectionIds)
    if (previous.current && sameHeadingIdMap(previous.current, next)) return previous.current
    previous.current = next
    return next
  }, [content, sectionIds])
}

/**
 * Fallback id for a heading the source scan could NOT see — in practice only
 * a heading synthesized by a caller remark/rehype plugin, which carries no
 * source position. (Setext, blockquote/list-nested ATX and multiple raw
 * `<hN>`s on one line are all scanned now, so they no longer land here.)
 *
 * Routed through the SAME dedupe shape as the map so a fallback id can never
 * collide with an assigned one. It stays PURE — `taken` is derived from the
 * map, not from render order — which is why two position-less headings with
 * IDENTICAL text still collide with each other: disambiguating those would
 * require the shared mutable counter this module deleted.
 */
export function resolveFallbackHeadingId(base: string, taken: ReadonlySet<string>): string {
  if (!base || !taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Cached `Set` of a map's assigned ids (one per map identity). */
const TAKEN_IDS_CACHE = new WeakMap<object, ReadonlySet<string>>()

/**
 * The ids already assigned by the document's heading-id map. Cached per map
 * IDENTITY, which `useHeadingIdMap` now keeps stable across heading-free
 * token growth — so this is O(headings) once, not per heading per token.
 */
export function useAssignedHeadingIds(): ReadonlySet<string> {
  const map = useContext(HeadingIdMapContext)
  const cached = TAKEN_IDS_CACHE.get(map as object)
  if (cached) return cached
  const set = new Set(map.values())
  TAKEN_IDS_CACHE.set(map as object, set)
  return set
}

/** Extract plain text from React children (headings receive mixed nodes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
