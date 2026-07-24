/**
 * Fenced-code tracker — THE definition of "am I inside a code fence".
 * Server-safe: no React, no DOM.
 *
 * Lives in its own module because it is a GENERAL CommonMark fence machine
 * with two unrelated consumers: the heading scanner
 * (`utils/markdown-heading-id`) and the streaming block splitter
 * (`components/ui/markdown/streaming`). It used to live inside
 * `markdown-heading-id`, which meant a streaming renderer imported its fence
 * state machine from a module named after heading slugs. `markdown-heading-id`
 * re-exports these names so the public `utils` surface is unchanged.
 */

/**
 * CommonMark fenced-code opener/closer. Fence indent is capped at 3 spaces
 * (4+ is an indented code block, whose backticks are literal content), and the
 * run length is captured so a closer can be required to be at least as long as
 * its opener. Matched on the RAW line — `trimStart()` would let a fence inside
 * 4-space-indented code toggle the state.
 *
 * `\r`-TOLERANT BY CONSTRUCTION. The previous spelling ended `(.*)$`, and `.`
 * excludes `\r` while `$` (no `m` flag) anchors at end of input — so on a CRLF
 * document, split on `\n`, NO line ever matched and the tracker was completely
 * fence-blind: `['```js\r','const a = 1\r','```\r','after\r']` classified as
 * four `text` lines where the LF spelling gives `open/inside/close/text`. The
 * sanitizer's closer haystack then never blanked the fenced region, so a
 * `</textarea>` written as a CRLF code sample satisfied `hasLaterCloser` and a
 * prose `<textarea>` above it stayed LIVE (reproduced in the DOM; the LF twin
 * of the same fixture escapes correctly). The `\r` is absorbed by `\r?$` rather
 * than normalized out of the text, because the sanitizer's mask is
 * LENGTH-PRESERVING and every offset in it is an index into the original
 * string — stripping `\r` would shift them all.
 *
 * THE ONLY COPY. This constant plus its open/close state machine used to be
 * duplicated verbatim in `components/ui/markdown/streaming.ts`, kept in sync
 * by a code comment — which is exactly how the `~~~`-blind extractor drifted
 * in the first place. Both consumers now instantiate `createFenceTracker()`.
 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})([^\n]*?)\r?$/

/**
 * CommonMark's BLANK LINE — spaces and tabs only. The single definition, shared
 * by every consumer of this module (the sanitizer's mask passes, the heading
 * scanner, the HTML-block range walk).
 *
 * NOT `String.prototype.trim()`. JS `trim()` strips the full Unicode
 * White_Space set — U+00A0 NBSP, U+000B VT, U+000C FF, U+2028/9, U+FEFF BOM —
 * none of which CommonMark (or remark) treats as blank. Every place that meant
 * "is this a CommonMark blank line?" and asked `trim() === ''` therefore
 * TERMINATED a construct one line early while remark kept it open. Verified
 * end-to-end: `<div>\n \n\`<textarea>\`\n\nrest\n` left a LIVE `<textarea>`
 * in the DOM (`escapeUnknownHtmlTags` returned the input byte-identical),
 * because the tracked HTML-block range ended at the NBSP filler line and the
 * inline-code shelter below it stopped being inside a tracked block. Same for
 * VT / FF / BOM, for `<pre>` / `<details>` wrappers, and for a live third-party
 * `<iframe>`.
 *
 * `\r` IS accepted: a CRLF document split on `\n` spells its blank lines
 * `"\r"`, and the mask is length-preserving so stripping `\r` from the source
 * is not an option (see `FENCE_RE`'s `\r?$`).
 */
const BLANK_LINE_RE = /^[ \t\r]*$/

/** True when `line` is a CommonMark blank line (spaces/tabs only, `\r`-tolerant). */
export function isBlankLine(line: string): boolean {
  return BLANK_LINE_RE.test(line)
}

/**
 * What one source line is, relative to fenced code:
 *  - `open`  — this line opened a fence
 *  - `close` — this line closed the open fence
 *  - `inside`— this line is fence content (including a would-be delimiter that
 *              does NOT close the open fence: wrong marker char, too short, or
 *              carrying an info string)
 *  - `text`  — this line is ordinary markdown outside any fence
 *
 * NOTE: no consumer discriminates the three non-`text` roles today — both the
 * heading scanner and the streaming splitter only test `!== 'text'`, and the
 * closer-haystack mask below only tests `=== 'open'` / `=== 'close'`. The
 * four-value union is kept because the state machine already computes the
 * distinction for free and a future consumer (e.g. fence-aware syntax
 * post-processing) would otherwise have to re-derive it.
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
        // opener, and (per CommonMark) carry no info string. "No info string"
        // means spaces/tabs only — `trim()` would accept an NBSP tail and close
        // a fence CommonMark keeps open, i.e. blank LESS of the haystack
        // (fail-OPEN). Hence `isBlankLine`, not `trim()`.
        if (run[0] === fenceChar && run.length >= fenceLength && isBlankLine(fence[2])) {
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
