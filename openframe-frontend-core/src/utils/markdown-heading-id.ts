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

// ---------------------------------------------------------------------------
// Fenced-code tracker — THE definition of "am I inside a code fence"
// ---------------------------------------------------------------------------
/**
 * CommonMark fenced-code opener/closer. Fence indent is capped at 3 spaces
 * (4+ is an indented code block, whose backticks are literal content), and the
 * run length is captured so a closer can be required to be at least as long as
 * its opener. Matched on the RAW line — `trimStart()` would let a fence inside
 * 4-space-indented code toggle the state.
 *
 * THE ONLY COPY. This constant plus its open/close state machine used to be
 * duplicated verbatim in `components/ui/markdown/streaming.ts`, kept in sync
 * by a code comment — which is exactly how the `~~~`-blind extractor drifted
 * in the first place. Both consumers now instantiate `createFenceTracker()`.
 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

/**
 * What one source line is, relative to fenced code:
 *  - `open`  — this line opened a fence
 *  - `close` — this line closed the open fence
 *  - `inside`— this line is fence content (including a would-be delimiter that
 *              does NOT close the open fence: wrong marker char, too short, or
 *              carrying an info string)
 *  - `text`  — this line is ordinary markdown outside any fence
 */
export type FenceLineRole = 'open' | 'close' | 'inside' | 'text'

export interface FenceTracker {
  /** Advance across one raw source line (mutates) and classify it. */
  push(line: string): FenceLineRole
  /** Marker CHARACTER of the currently open fence (`` ` `` / `~`), or null. */
  openChar(): string | null
  /** Run length of the currently open fence (a closer must be ≥ this). */
  openLength(): number
}

/** A fresh fenced-code state machine. Server-safe: no React, no DOM. */
export function createFenceTracker(): FenceTracker {
  let fenceChar: string | null = null
  let fenceLength = 0
  return {
    push(line: string): FenceLineRole {
      const fence = FENCE_RE.exec(line)
      if (fence) {
        const run = fence[1]
        if (fenceChar === null) {
          fenceChar = run[0]
          fenceLength = run.length
          return 'open'
        }
        // A closer must use the SAME marker char, be at least as long as the
        // opener, and (per CommonMark) carry no info string.
        if (run[0] === fenceChar && run.length >= fenceLength && fence[2].trim() === '') {
          fenceChar = null
          fenceLength = 0
          return 'close'
        }
        return 'inside'
      }
      return fenceChar === null ? 'text' : 'inside'
    },
    openChar: () => fenceChar,
    openLength: () => fenceLength,
  }
}

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
/**
 * Blockquote markers and list-item markers preceding an ATX heading
 * (`> ## Setup`, `- ## Setup`, `1. ## Setup`). mdast emits a REAL `<h2>` for
 * these; scanning only column-0..3 missed them entirely, so two identical
 * `> ## Setup` headings both hit the suffix-free fallback and emitted the
 * duplicate DOM ids this whole module exists to prevent.
 */
const CONTAINER_PREFIX_RE = /^ {0,3}(?:(?:>[ \t]?)+|(?:[-+*]|\d{1,9}[.)])[ \t]+)+/
/** Setext underline (`===` → h1, `---` → h2), AFTER container-prefix strip. */
const SETEXT_UNDERLINE_RE = /^ {0,3}(=+|-+)[ \t]*$/
/** Thematic break — ends a paragraph run, never underlines it. */
const THEMATIC_BREAK_RE = /^ {0,3}(\*|_){3,}[ \t]*$/
/**
 * A line that OPENS a raw HTML block. mdast hands the whole block to the HTML
 * parser, so a `---` inside it is not a setext underline and the lines above
 * it are not a paragraph: `<div>\nText\n---\n</div>` emits NO heading. The
 * scanner used to publish a phantom `Text` h2 there.
 */
const HTML_BLOCK_OPENER_RE = /^ {0,3}</

/**
 * The paragraph RUN that a setext underline would convert into a heading.
 *
 * mdast positions a setext heading at the FIRST line of the paragraph and its
 * text is the WHOLE run (`Foo\nbar\n===` → `{line:1, text:"Foo\nbar"}`). The
 * scanner used to remember only the LAST line, so the renderer's line-keyed
 * lookup missed the heading entirely (falling back to a slug of the rendered
 * children, `foo-bar`) while the extractor published `bar` — a dead deep
 * link, plus a phantom TOC entry at the wrong line.
 */
interface SetextRun {
  /** 1-based line of the run's FIRST line — where mdast puts the heading. */
  line: number
  /**
   * Container prefix (`> `, `- `, …) every line of the run shares. The
   * underline must carry the IDENTICAL prefix, which is why `> Quote` +
   * `> ---` scans as an h2 while `> Quote` + a bare `---` does not.
   *
   * KNOWN, DELIBERATE GAP: a setext underline indented to a LIST ITEM's
   * content column (`- item` / `  ---`) is a heading in mdast but has no
   * container prefix at all, so this equality test misses it. Closing that
   * would mean re-deriving list-item content columns here — the scanner
   * simply emits nothing (the pre-existing behavior), which costs a TOC entry
   * and never produces a WRONG id.
   */
  prefix: string
  /** Run lines with the container prefix stripped, in order. */
  lines: string[]
  /** Run opened with a raw-HTML block line — mdast emits no heading for it. */
  disqualified: boolean
}

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
  // ONE fenced-code state machine, shared with markdown/streaming.ts.
  const fences = skipFences ? createFenceTracker() : null

  let start = 0
  if (skipFrontmatter && lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' || lines[i].trim() === '...') {
        start = i + 1
        break
      }
    }
  }

  // The paragraph run a setext underline would convert (see SetextRun).
  let setextRun: SetextRun | null = null

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (fences) {
      const role = fences.push(line)
      if (role !== 'text') {
        setextRun = null
        continue
      }
    }

    // Container prefix (`> `, `- `, `1. `) is stripped from EVERY construct
    // below, so a blockquote/list-nested heading is scanned in both its ATX
    // (`> ## Setup`) and setext (`> Quote title` / `> ---`) spellings.
    const prefix = CONTAINER_PREFIX_RE.exec(line)?.[0] ?? ''
    const body = prefix ? line.slice(prefix.length) : line

    // --- setext (`Title` / `===`): a REAL h1/h2 in mdast, positioned at the
    // run's FIRST line — which is the line the heading-id map is keyed by.
    // The underline must carry the SAME container prefix as the run it
    // closes; `> Quote` followed by a bare `---` is a quote and a thematic
    // break, not a heading.
    const setext = SETEXT_UNDERLINE_RE.exec(body)
    if (setext) {
      if (setextRun && !setextRun.disqualified && setextRun.prefix === prefix) {
        out.push({
          line: setextRun.line,
          level: setext[1][0] === '=' ? 1 : 2,
          text: setextRun.lines.join('\n'),
        })
      }
      setextRun = null
      continue
    }

    // --- ATX, including inside a blockquote / list item.
    const atx = ATX_HEADING_RE.exec(body) ?? ATX_EMPTY_RE.exec(body)
    if (atx) {
      out.push({ line: i + 1, level: atx[1].length, text: (atx[2] ?? '').trim() })
      setextRun = null
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
        setextRun = null
        continue
      }
    }

    // Paragraph accumulation. A blank line or a thematic break ends the run;
    // a change of container prefix starts a new block (a list or blockquote
    // interrupts a paragraph in CommonMark).
    if (body.trim() === '' || THEMATIC_BREAK_RE.test(body)) {
      setextRun = null
      continue
    }
    if (setextRun && setextRun.prefix === prefix) {
      setextRun.lines.push(body.trim())
    } else {
      setextRun = {
        line: i + 1,
        prefix,
        lines: [body.trim()],
        disqualified: HTML_BLOCK_OPENER_RE.test(body),
      }
    }
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
