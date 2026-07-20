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

export interface StreamingBlock {
  /** Raw markdown source of this unit (including trailing blank lines). */
  text: string
  /** Position index — cache key component so identical blocks never alias. */
  index: number
  /**
   * True when this unit may be render-cached: it is complete (not the
   * trailing unit), atomic, and free of cross-block / late-resolving
   * constructs (card/mention markers, reference definitions/uses,
   * footnotes).
   */
  memoizable: boolean
}

/**
 * CommonMark fenced-code opener/closer. Fence indent is capped at 3 spaces
 * (4+ is an indented code block, whose backticks are literal content), and
 * the run length is captured so a closer can be required to be at least as
 * long as its opener. Matched on the RAW line — `trimStart()` would let a
 * fence inside 4-space-indented code toggle the state.
 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/

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
 * Line-scanner state shared by `splitStreamingBlocks` and
 * `completeStreamingTail` — ONE implementation of "where are we in the
 * document", so the splitter and the tail-completer can never disagree
 * about which fence is open.
 */
interface ScanState {
  /** Marker CHARACTER of the currently open fence (`` ` `` or `~`), or null. */
  fenceChar: string | null
  /** Run length of the currently open fence (a closer must be ≥ this). */
  fenceLength: number
  /** Depth of currently open raw HTML block containers. */
  htmlDepth: number
}

function createScanState(): ScanState {
  return { fenceChar: null, fenceLength: 0, htmlDepth: 0 }
}

/** Advance `state` across one raw source line (mutates). */
function scanLine(state: ScanState, line: string): void {
  const fence = FENCE_RE.exec(line)
  if (fence) {
    const run = fence[1]
    const info = fence[2]
    if (state.fenceChar === null) {
      state.fenceChar = run[0]
      state.fenceLength = run.length
      return
    }
    // A closer must use the SAME marker char, be at least as long as the
    // opener, and (per CommonMark) carry no info string.
    if (run[0] === state.fenceChar && run.length >= state.fenceLength && info.trim() === '') {
      state.fenceChar = null
      state.fenceLength = 0
    }
    return
  }
  if (state.fenceChar !== null) return

  // Raw HTML depth — only for lines that BEGIN a raw HTML block (CommonMark
  // requires the `<` at column 0..3), so `a < b` prose can't shift depth.
  if (!/^ {0,3}<\/?[a-zA-Z]/.test(line)) return
  HTML_TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HTML_TAG_RE.exec(line)) !== null) {
    const tag = m[2].toLowerCase()
    if (!RAW_BLOCK_TAGS.has(tag)) continue
    if (m[1] === '/') {
      if (state.htmlDepth > 0) state.htmlDepth--
    } else if (!m[3].trimEnd().endsWith('/')) {
      state.htmlDepth++
    }
  }
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
    scanLine(state, line)
    if (state.htmlDepth !== depthBefore || state.htmlDepth > 0) currentTouchedHtml = true
    current.push(line)

    const isBlank = line.trim() === ''
    // Never cut inside an open fence, nor inside an unbalanced raw HTML
    // block container.
    if (!isBlank || state.fenceChar !== null || state.htmlDepth > 0) continue

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

    units.push(current)
    unitTouchedHtml.push(currentTouchedHtml)
    current = []
    currentTouchedHtml = false
  }
  if (current.length) {
    units.push(current)
    unitTouchedHtml.push(currentTouchedHtml)
  }

  return units.map((unitLines, idx) => {
    const text = unitLines.join('\n')
    const isTail = idx === units.length - 1
    return {
      text,
      index: idx,
      // Raw-HTML units are never cached: rehype-raw's reparse of a
      // container is exactly the case where a stale cached render is
      // structurally wrong rather than merely late.
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
  if (state.fenceChar === null) return content
  const closer = state.fenceChar.repeat(state.fenceLength)
  return content.endsWith('\n') ? `${content}${closer}` : `${content}\n${closer}`
}
