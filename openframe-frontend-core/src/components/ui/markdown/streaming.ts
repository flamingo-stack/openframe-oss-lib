/**
 * Streaming helpers for the unified markdown engine (pure, no React).
 *
 * Design contract (unification plan §D1 "Streaming rendering performance"):
 * - Markdown is NOT context-free across blocks. The splitter only cuts at
 *   boundaries it can PROVE are atomic; when atomicity is unprovable the
 *   content is left in one unit (unmemoized) — correctness beats cache hits.
 * - Blocks containing `card://` / `mention://` markers are never memoized:
 *   their text is identical before/after the entity ref resolves, so a
 *   text-keyed cache would serve the stale unresolved card mid-stream.
 * - On stream completion the engine discards all of this and does ONE
 *   authoritative whole-document parse — streaming can never permanently
 *   diverge (late reference defs, footnotes, list renumbering self-heal).
 * - Tail completion auto-closes ONLY unterminated fenced code blocks
 *   (fence-count based — unambiguous). Inline emphasis/links are NOT
 *   auto-closed: a stray `*` in "2 * 3" or a non-link `[` would be
 *   mis-wrapped, which is worse than the brief flicker it prevents.
 */

import { createFenceTracker, type FenceTracker } from '../../../utils/markdown-fences'

export interface StreamingBlock {
  /** Raw markdown source of this unit (including trailing blank lines). */
  text: string
  /** Position index — cache key component so identical blocks never alias. */
  index: number
  /**
   * 1-based line of this unit's first line WITHIN the whole document.
   * Each unit is parsed by its own `ReactMarkdown`, so hast positions are
   * unit-relative; the engine adds `startLine - 1` back to look ids up in
   * the document-wide heading-id map (see ./heading-ids.ts).
   */
  startLine: number
  /**
   * True when this unit may be render-cached: it is complete (not the
   * trailing unit), atomic, and free of cross-block / late-resolving
   * constructs (card/mention markers, reference definitions/uses,
   * footnotes).
   */
  memoizable: boolean
}

/** Constructs that resolve across blocks or after the text settles. */
const NON_MEMOIZABLE_RE = /card:\/\/|mention:\/\/|^\s*\[[^\]]*\]:\s|\]\[|\[\^/m

/**
 * Raw HTML block-level containers. A blank line inside an OPEN one of these
 * is not a block boundary: cutting there hands react-markdown an unbalanced
 * fragment, so the container's body renders outside the container and the
 * stray close tag is dropped (`<details>` disclosure bodies escaping the
 * widget mid-stream — and the wrong render getting cached).
 */
const RAW_BLOCK_TAGS = new Set([
  'details', 'div', 'table', 'section', 'article', 'aside', 'blockquote',
  'figure', 'form', 'fieldset', 'header', 'footer', 'main', 'nav', 'dl',
  'ol', 'ul', 'pre', 'video', 'audio', 'picture', 'iframe', 'template',
  'svg',
])

/** `<tag …>` / `</tag>` occurrences, used for raw-HTML depth tracking. */
const HTML_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g

/**
 * A start tag whose `>` has NOT arrived yet on this line
 * (`<div\n  class="x">`). Only the trailing occurrence matters, and only
 * for RAW_BLOCK_TAGS — restricting it there keeps prose like `a <b` from
 * latching the scanner into "inside a tag" forever.
 */
const DANGLING_OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?$/

/**
 * A line that may START a raw HTML block. CommonMark puts the `<` at column
 * 0..3, but a raw HTML block nested in a list item is indented to the item's
 * CONTENT column (`1.  step` → 4, and up to 7 for a wide ordered marker).
 * The old column-0..3 gate missed exactly those, so an unbalanced raw-HTML
 * container nested in a list item never shifted the scanner's depth and its
 * unit was marked memoizable — contradicting the "unbalanced raw-HTML units
 * are never cached" policy this module documents.
 */
const HTML_BLOCK_START_RE = /^\s{0,7}<\/?[a-zA-Z]/

/**
 * Cap on how long the raw-HTML latch may suppress cutting. An unclosed
 * `<div>` (or a start tag whose `>` never arrives) would otherwise pin
 * `htmlDepth > 0` for the ENTIRE remaining message, collapsing it into one
 * ever-growing non-memoizable unit and disabling the atomic-block
 * optimization outright.
 *
 * THE TRADEOFF, STATED HONESTLY: past the cap the splitter resumes cutting
 * even though a container is still open, so a genuinely >200-line authored
 * `<div>` / `<table>` wrapper IS cut mid-container and visibly breaks apart
 * while streaming (its body renders outside the wrapper, the stray close tag
 * is dropped). Those units are still marked non-memoizable, so nothing WRONG
 * is ever cached and the stream-completion whole-document reparse restores
 * the correct structure — but during the stream the render is wrong, not
 * merely uncached. (An earlier comment here claimed "never a wrong render";
 * that was only true below the cap.)
 *
 * The cap is kept because the alternative — never cutting while latched —
 * makes ONE unbounded unit out of every message containing an unclosed tag,
 * which is the common case (an LLM mid-emission always has one) and costs a
 * full reparse of the entire message on every token.
 */
const HTML_LATCH_LINE_LIMIT = 200

/**
 * Two properties of the fence tracker, stated so they stop being accidents.
 * A reviewer confirmed both hold today, but neither was written down, so a
 * future change could quietly break them.
 *
 * 1. EOF ON THE OPENER LINE EMITS AN EMPTY PAIR. When the stream stops exactly
 *    on a fence opener, `completeStreamingTail` closes it at EOF and the render
 *    contains a bare ```/``` — a momentarily empty `<pre>`. It is cosmetic and
 *    self-heals on the next delta. Do NOT "fix" it by suppressing the close:
 *    that leaks an unterminated fence into the parse instead, which is worse.
 *
 * 2. THIS SCANNER AND THE SANITIZER'S MASK CAN DISAGREE ABOUT WHICH FENCE IS
 *    OPEN, AND BOTH MUST FAIL CLOSED. `scanLine`'s `pendingOpenTag` early
 *    return skips `fences.push`, so a fence opened on a line consumed by an
 *    unclosed HTML tag is never recorded here — while `sanitize.ts`'s
 *    `blankFencedRegions` runs its own tracker over the same text and may see
 *    it. The divergence is safe ONLY because each consumer degrades toward
 *    doing less: `completeStreamingTail` closes nothing it did not see open,
 *    and `blankFencedRegions` blanks nothing it cannot locate, so the output
 *    degrades to "render as-is" rather than to a corrupted document. Any
 *    change to the early return, to `fences` bookkeeping, or to either
 *    consumer must preserve fail-closed behaviour in BOTH directions
 *    (scanner-ahead and scanner-behind).
 */

/**
 * Line-scanner state shared by `splitStreamingBlocks` and
 * `completeStreamingTail` — ONE implementation of "where are we in the
 * document", so the splitter and the tail-completer can never disagree
 * about which fence is open.
 */
interface ScanState {
  /**
   * Fenced-code state machine. NOT a local copy: `createFenceTracker` lives
   * in the server-safe `utils/markdown-fences` and is the SAME instance
   * shape the heading scanner uses, so "is this line inside a fence" has
   * exactly one definition. The previous duplicate here (a verbatim
   * `FENCE_RE` plus its own open/close state machine, cross-referenced by a
   * comment) is precisely the drift that produced the `~~~` bug.
   */
  fences: FenceTracker
  /** Depth of currently open raw HTML block containers. */
  htmlDepth: number
  /** Raw-block tag name of a start tag still waiting for its `>`, or null. */
  pendingOpenTag: string | null
  /** Consecutive lines spent with the raw-HTML latch engaged. */
  htmlLatchLines: number
}

function createScanState(): ScanState {
  return {
    fences: createFenceTracker(),
    htmlDepth: 0,
    pendingOpenTag: null,
    htmlLatchLines: 0,
  }
}

/** Raw-HTML state is unbalanced (a container or a start tag is still open). */
function htmlLatched(state: ScanState): boolean {
  return state.htmlDepth > 0 || state.pendingOpenTag !== null
}

/** True while raw-HTML state forbids cutting (latch cap not yet reached). */
function htmlBlocksCut(state: ScanState): boolean {
  return htmlLatched(state) && state.htmlLatchLines <= HTML_LATCH_LINE_LIMIT
}

/** Scan `line` from `from` for complete tags, then record any dangling opener. */
function scanTags(state: ScanState, line: string, from: number): void {
  HTML_TAG_RE.lastIndex = from
  let m: RegExpExecArray | null
  let end = from
  while ((m = HTML_TAG_RE.exec(line)) !== null) {
    end = HTML_TAG_RE.lastIndex
    const tag = m[2].toLowerCase()
    if (!RAW_BLOCK_TAGS.has(tag)) continue
    if (m[1] === '/') {
      if (state.htmlDepth > 0) state.htmlDepth--
    } else if (!m[3].trimEnd().endsWith('/')) {
      state.htmlDepth++
    }
  }
  const dangling = DANGLING_OPEN_TAG_RE.exec(line.slice(end))
  if (dangling && RAW_BLOCK_TAGS.has(dangling[1].toLowerCase())) {
    state.pendingOpenTag = dangling[1].toLowerCase()
  }
}

/** Advance `state` across one raw source line (mutates). */
function scanLine(state: ScanState, line: string): void {
  // A start tag spanning lines wins over everything: its continuation lines
  // are attribute soup, not markdown.
  if (state.pendingOpenTag !== null) {
    const gt = line.indexOf('>')
    if (gt === -1) {
      state.htmlLatchLines++
      return
    }
    const selfClosing = line.slice(0, gt).trimEnd().endsWith('/')
    const tag = state.pendingOpenTag
    state.pendingOpenTag = null
    if (!selfClosing && RAW_BLOCK_TAGS.has(tag)) state.htmlDepth++
    scanTags(state, line, gt + 1)
    state.htmlLatchLines = htmlLatched(state) ? state.htmlLatchLines + 1 : 0
    return
  }

  // Fence delimiters and fence content are both opaque to the HTML scanner —
  // only `text` lines carry markup that can shift raw-HTML depth.
  if (state.fences.push(line) !== 'text') return

  // Depth > 0 means we are INSIDE a container, where the closing tag may sit
  // anywhere on a line (`some text </details>`). Scanning only column-0..3
  // lines there meant such a close never decremented, so the latch stuck.
  // At depth 0 only a line that can BEGIN a raw HTML block is considered, so
  // `a < b` prose can't shift depth.
  if (state.htmlDepth === 0 && !HTML_BLOCK_START_RE.test(line)) return
  scanTags(state, line, 0)
  state.htmlLatchLines = htmlLatched(state) ? state.htmlLatchLines + 1 : 0
}

/**
 * Split streaming markdown into atomic units at blank lines that are
 * provably block boundaries. A blank line does NOT split when:
 *  - inside a fenced code block,
 *  - the next non-blank line is indented (loose-list / blockquote
 *    continuation cannot be ruled out),
 *  - the next non-blank line starts a list item or blockquote AND the
 *    previous unit ended in a list item or blockquote (loose list /
 *    multi-paragraph quote continuation).
 * The FINAL unit is always the live tail (never memoizable).
 */
export function splitStreamingBlocks(content: string): StreamingBlock[] {
  const lines = content.split('\n')
  const units: string[][] = []
  const unitTouchedHtml: boolean[] = []
  let current: string[] = []
  let currentTouchedHtml = false
  const state = createScanState()

  const isListOrQuote = (line: string) =>
    /^\s{0,3}(?:[-+*]\s|\d{1,9}[.)]\s|>)/.test(line)

  const lastNonBlank = (arr: string[]): string | undefined => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].trim() !== '') return arr[i]
    }
    return undefined
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const depthBefore = state.htmlDepth
    const pendingBefore = state.pendingOpenTag
    scanLine(state, line)
    if (
      state.htmlDepth !== depthBefore ||
      state.pendingOpenTag !== pendingBefore ||
      htmlLatched(state)
    )
      currentTouchedHtml = true
    current.push(line)

    const isBlank = line.trim() === ''
    // Never cut inside an open fence, nor inside an unbalanced raw HTML
    // block container / a start tag still waiting for its `>`.
    if (!isBlank || state.fences.openChar() !== null || htmlBlocksCut(state)) continue

    // Candidate boundary at a blank line outside fences. Look ahead to the
    // next non-blank line to decide whether cutting here is provably safe.
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    if (j >= lines.length) continue // trailing blanks stay with the tail

    const next = lines[j]
    if (/^\s/.test(next)) continue // indented continuation — unprovable
    const prev = lastNonBlank(current)
    if (isListOrQuote(next) && prev !== undefined && isListOrQuote(prev)) {
      // Loose list / multi-paragraph blockquote continuation — do not cut.
      continue
    }

    // A unit whose entire content is whitespace is not a block — with 2+
    // blank lines between blocks the loop reaches a cut point with nothing
    // but blanks accumulated, and emitting it costs a `ReactMarkdown`
    // instance (and a React key) that renders nothing. Leave `current`
    // accumulating so the blanks fold into the NEXT unit; line numbering
    // (and therefore `startLine`) is unaffected either way.
    if (current.every((l) => l.trim() === '')) continue

    units.push(current)
    unitTouchedHtml.push(currentTouchedHtml)
    current = []
    currentTouchedHtml = false
  }
  if (current.length) {
    units.push(current)
    unitTouchedHtml.push(currentTouchedHtml)
  }

  let cursorLine = 1
  return units.map((unitLines, idx) => {
    const text = unitLines.join('\n')
    const isTail = idx === units.length - 1
    const startLine = cursorLine
    cursorLine += unitLines.length
    return {
      text,
      index: idx,
      startLine,
      // Units carrying UNBALANCED raw HTML are never cached: an open
      // container (or a start tag still awaiting its `>`) is exactly the
      // case where rehype-raw's reparse makes a stale cached render
      // structurally wrong rather than merely late. A raw container that
      // opens AND closes within the unit (`<div>x</div>`) leaves the
      // scanner's depth unchanged, so it stays memoizable — correctly: its
      // parse cannot be invalidated by later tokens.
      memoizable: !isTail && !unitTouchedHtml[idx] && !NON_MEMOIZABLE_RE.test(text),
    }
  })
}

/**
 * Auto-close an unterminated fenced code block at the streaming tail so the
 * half-open fence doesn't flip the rest of the message into code while
 * tokens arrive.
 *
 * Uses the SAME scanner as `splitStreamingBlocks` (never a parallel
 * fence-count heuristic — a naive count treats ``` and ~~~ as
 * interchangeable and appends a spurious closer to `` ```\n~~~\n``` ``),
 * and appends the RECORDED opener so a `~~~` block is closed with `~~~`.
 */
export function completeStreamingTail(content: string): string {
  const state = createScanState()
  for (const line of content.split('\n')) scanLine(state, line)
  const openChar = state.fences.openChar()
  if (openChar === null) return content
  const closer = openChar.repeat(state.fences.openLength())
  return content.endsWith('\n') ? `${content}${closer}` : `${content}\n${closer}`
}
