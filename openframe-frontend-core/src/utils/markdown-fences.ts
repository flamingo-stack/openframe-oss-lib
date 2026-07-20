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
