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

// ---------------------------------------------------------------------------
// Heading SCANNER + DEDUPER (the other half of the producer/consumer contract)
// ---------------------------------------------------------------------------
/**
 * Sharing the slug chain alone was not enough. The PRODUCER
 * (`utils/markdown-section-extractor`) and the CONSUMER
 * (`components/ui/markdown/heading-ids`) each carried their own copy of
 * "which lines are headings" and "how do duplicates get suffixed", and the
 * copies drifted:
 *   - the extractor toggled its code-block state on a bare
 *     `line.startsWith('```')`, so a `~~~`-fenced (or wider-backtick, or
 *     indented) block containing `## Setup` produced a SECTION from the
 *     extractor and NO id from the renderer — `sectionIdMap` then missed
 *     silently and the deep-link anchor pointed nowhere;
 *   - the extractor anchored ATX at column 0 while the renderer allowed the
 *     CommonMark 0..3-space indent;
 *   - the dedupe counter was hand-copied in both files, each with a comment
 *     saying "the two must agree".
 * Both now call `scanHeadings` + `createHeadingIdDeduper`. Server-safe: no
 * React, no DOM.
 */

/** A heading the renderer will emit, located in the source. */
export interface ScannedHeading {
  /** 1-based line of the heading's FIRST line (setext: the title line). */
  line: number
  level: number
  /** Raw title text, before `stripInlineMarkdown` / slugification. */
  text: string
}

export interface ScanHeadingsOptions {
  /**
   * Skip a leading YAML frontmatter block (`---` on line 1 through the next
   * `---`). Only a DOCUMENT-LEADING block counts: a bare `---` mid-document
   * is a thematic break or a setext underline, and treating it as a
   * frontmatter toggle (what the extractor used to do) silently swallowed
   * every heading until the next one.
   */
  skipFrontmatter?: boolean
  /** Include raw-HTML headings (`<h2>Title</h2>`). Default true. */
  includeRawHtml?: boolean
  /**
   * Skip fenced-code blocks. Default true — a `##` inside a code fence is
   * code, not a heading, and the renderer emits no id for it.
   */
  skipFences?: boolean
}

/** CommonMark ATX heading (closing `#` run is not part of the title). */
const ATX_HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
/** ATX with no title at all (`###`, `## ###`) — still a heading, empty text. */
const ATX_EMPTY_RE = /^ {0,3}(#{1,6})[ \t]*#*[ \t]*$/
/**
 * Raw-HTML heading (`<h2 id="x">Title</h2>`) — rehype-raw renders these too.
 * GLOBAL: two `<h3>`s on one line are two headings, and a non-global scan
 * silently dropped the second (it then fell through to the renderer's
 * suffix-free fallback and emitted a DUPLICATE DOM id).
 */
const RAW_HEADING_RE = /<h([1-6])\b[^>]*>([\s\S]*?)(?:<\/h\1>|$)/gi
/** Fenced-code delimiter, same indent cap as markdown/streaming.ts. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/
/**
 * Blockquote markers and list-item markers preceding an ATX heading
 * (`> ## Setup`, `- ## Setup`, `1. ## Setup`). mdast emits a REAL `<h2>` for
 * these; scanning only column-0..3 missed them entirely, so two identical
 * `> ## Setup` headings both hit the suffix-free fallback and emitted the
 * duplicate DOM ids this whole module exists to prevent.
 */
const CONTAINER_PREFIX_RE = /^ {0,3}(?:(?:>[ \t]?)+|(?:[-+*]|\d{1,9}[.)])[ \t]+)+/
/** Setext underline (`===` → h1, `---` → h2). */
const SETEXT_UNDERLINE_RE = /^ {0,3}(=+|-+)[ \t]*$/

/**
 * Collect every heading the markdown renderer will emit, in document order.
 * THE single definition of "which lines are headings" for both the extractor
 * and the renderer's id map.
 */
export function scanHeadings(
  content: string,
  options: ScanHeadingsOptions = {},
): ScannedHeading[] {
  const { skipFrontmatter = true, includeRawHtml = true, skipFences = true } = options
  const out: ScannedHeading[] = []
  const lines = content.split('\n')
  let fenceChar: string | null = null
  let fenceLength = 0

  let start = 0
  if (skipFrontmatter && lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' || lines[i].trim() === '...') {
        start = i + 1
        break
      }
    }
  }

  // Text of the previous line when it could serve as a setext heading body
  // (plain paragraph content), else null.
  let setextCandidate: { line: number; text: string } | null = null

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    const fence = skipFences ? FENCE_RE.exec(line) : null
    if (fence) {
      const run = fence[1]
      if (fenceChar === null) {
        fenceChar = run[0]
        fenceLength = run.length
      } else if (run[0] === fenceChar && run.length >= fenceLength && fence[2].trim() === '') {
        fenceChar = null
        fenceLength = 0
      }
      setextCandidate = null
      continue
    }
    if (fenceChar !== null) continue

    // --- setext (`Title` / `===`): a REAL h1/h2 in mdast, positioned at the
    // TITLE line — which is the line the heading-id map is keyed by.
    const setext = SETEXT_UNDERLINE_RE.exec(line)
    if (setext && setextCandidate) {
      out.push({
        line: setextCandidate.line,
        level: setext[1][0] === '=' ? 1 : 2,
        text: setextCandidate.text,
      })
      setextCandidate = null
      continue
    }

    // --- ATX, including inside a blockquote / list item.
    const body = line.replace(CONTAINER_PREFIX_RE, '')
    const atx = ATX_HEADING_RE.exec(body) ?? ATX_EMPTY_RE.exec(body)
    if (atx) {
      out.push({ line: i + 1, level: atx[1].length, text: (atx[2] ?? '').trim() })
      setextCandidate = null
      continue
    }

    if (includeRawHtml && line.indexOf('<') !== -1) {
      RAW_HEADING_RE.lastIndex = 0
      let raw: RegExpExecArray | null
      let matched = false
      while ((raw = RAW_HEADING_RE.exec(line)) !== null) {
        matched = true
        out.push({
          line: i + 1,
          level: Number(raw[1]),
          text: raw[2].replace(/<[^>]*>/g, '').trim(),
        })
      }
      if (matched) {
        setextCandidate = null
        continue
      }
    }

    // Plain paragraph text can underline into a setext heading on the NEXT
    // line. Container-prefixed / blank / thematic-break lines cannot.
    setextCandidate =
      line.trim() !== '' && !CONTAINER_PREFIX_RE.test(line) && !/^ {0,3}(\*|_){3,}[ \t]*$/.test(line)
        ? { line: i + 1, text: line.trim() }
        : null
  }

  return out
}

/**
 * The duplicate-id suffix counter, as ONE closure both sides instantiate.
 * First occurrence keeps the bare slug; the Nth gets `-N`. Extractor and
 * renderer MUST use the same counter or `#anchor` deep links diverge.
 */
export function createHeadingIdDeduper(): (cleanId: string) => string {
  const counts: Record<string, number> = {}
  return (cleanId: string): string => {
    if (counts[cleanId]) {
      counts[cleanId]++
      return `${cleanId}-${counts[cleanId]}`
    }
    counts[cleanId] = 1
    return cleanId
  }
}
