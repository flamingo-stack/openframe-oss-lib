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

// The CommonMark fence machine used to live in THIS file, which meant a
// streaming renderer imported its fence state from a module named after
// heading slugs. It now lives in `./markdown-fences`; re-exported here so the
// public `utils` surface (and every existing import) is unchanged.
export {
  createFenceTracker,
  isBlankLine,
  type FenceTracker,
  type FenceLineRole,
} from './markdown-fences'
import { createFenceTracker, isBlankLine } from './markdown-fences'

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

/**
 * EVERY line-anchored regex in this module ends `\r?$`, not `$`.
 *
 * Lines here come from `content.split('\n')`, so on a CRLF document each one
 * carries a trailing `\r`. `$` (no `m` flag) anchors at end of string and `\r`
 * is not in `[ \t]`, so a `$`-anchored pattern matches NOTHING on such a
 * document. That was a live REGRESSION: `main`'s looser `^(#{1,6})\s+(.+)`
 * had no end anchor at all and tolerated the `\r` (the title was `.trim()`ed
 * afterwards), so `'# Real\r\n\r\nbody\r\n\r\n## Second\r\n'` yielded
 * `["Real","Second"]` on `main` and `[]` here — every CRLF-stored doc / blog /
 * release body silently lost its TOC, its in-page anchors and its doc-SEO
 * heading links.
 *
 * The `\r` is ABSORBED, not normalized away: `scanHeadings` reports 1-based
 * LINE numbers that the renderer's id map is keyed by, and the sanitizer's mask
 * (which shares `markdown-fences`) is length-preserving — neither may be fed a
 * rewritten source.
 */
/** CommonMark ATX heading (closing `#` run is not part of the title). */
const ATX_HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*\r?$/
/** ATX with no title at all (`###`, `## ###`) — still a heading, empty text. */
const ATX_EMPTY_RE = /^ {0,3}(#{1,6})[ \t]*#*[ \t]*\r?$/
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
const SETEXT_UNDERLINE_RE = /^ {0,3}(=+|-+)[ \t]*\r?$/
/** Thematic break — ends a paragraph run, never underlines it. */
const THEMATIC_BREAK_RE = /^ {0,3}(\*|_){3,}[ \t]*\r?$/
/**
 * CommonMark HTML-block type 6 tag names — these open a raw HTML block no
 * matter what follows them on the line.
 */
const HTML_BLOCK_TAGS =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'

/**
 * A line that OPENS a raw HTML block. mdast hands the whole block to the HTML
 * parser, so a `---` inside it is not a setext underline and the lines above
 * it are not a paragraph: `<div>\nText\n---\n</div>` emits NO heading. The
 * scanner used to publish a phantom `Text` h2 there.
 *
 * The naive `^ {0,3}<` this replaced disqualified any run whose first line
 * merely STARTED with a tag, so `<span>x</span> more text` + `---` (a plain
 * paragraph in mdast, yielding an h2) was missed. The alternatives are spelled
 * out per CommonMark:
 *   - types 1-5: `<script|pre|style|textarea`, `<!--`, `<?`, `<!X`, `<![CDATA[`
 *   - type 6:    a `HTML_BLOCK_TAGS` name, whatever follows it
 *   - type 7:    ANY complete open/closing tag ALONE on the line (trailing
 *                whitespace only) — this is the clause the old regex got wrong
 * Attribute soup inside a type-7 tag is approximated with `[^>]*` rather than
 * a full attribute grammar; the error bias is unchanged (a missed run costs a
 * TOC entry, never a wrong id — the same direction as the documented
 * list-item-indent gap in `SetextRun.prefix`).
 */
const HTML_BLOCK_OPENER_RE = new RegExp(
  '^ {0,3}(?:' +
    // types 1-5
    '<(?:script|pre|style|textarea)(?:[\\s>]|$)|<!--|<\\?|<![a-zA-Z]|<!\\[CDATA\\[' +
    // type 6
    `|</?(?:${HTML_BLOCK_TAGS})(?:[\\s/>]|$)` +
    // type 7 — a complete tag standing alone on the line
    '|<[a-zA-Z][a-zA-Z0-9-]*(?:\\s[^>]*)?/?>[ \\t]*\\r?$' +
    '|</[a-zA-Z][a-zA-Z0-9-]*[ \\t]*>[ \\t]*\\r?$' +
    ')',
  'i',
)

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
  // ONE fenced-code state machine (utils/markdown-fences), shared with
  // markdown/streaming.ts.
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
    // CommonMark's blank line (spaces/tabs), NOT `trim()` — an NBSP-only line
    // is paragraph CONTENT to remark, so ending the run there would move a
    // setext heading's reported line off the run's first line.
    if (isBlankLine(body) || THEMATIC_BREAK_RE.test(body)) {
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
