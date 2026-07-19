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

const FENCE_RE = /^(```|~~~)/
/** Constructs that resolve across blocks or after the text settles. */
const NON_MEMOIZABLE_RE = /card:\/\/|mention:\/\/|^\s*\[[^\]]*\]:\s|\]\[|\[\^/m

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
  let current: string[] = []
  let inFence = false

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
    if (FENCE_RE.test(line.trimStart())) inFence = !inFence
    current.push(line)

    const isBlank = line.trim() === ''
    if (!isBlank || inFence) continue

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
    current = []
  }
  if (current.length) units.push(current)

  return units.map((unitLines, idx) => {
    const text = unitLines.join('\n')
    const isTail = idx === units.length - 1
    return {
      text,
      index: idx,
      memoizable: !isTail && !NON_MEMOIZABLE_RE.test(text),
    }
  })
}

/**
 * Auto-close an unterminated fenced code block at the streaming tail so the
 * half-open fence doesn't flip the rest of the message into code while
 * tokens arrive. Fence-count based — the only unambiguous case.
 */
export function completeStreamingTail(content: string): string {
  let fences = 0
  for (const line of content.split('\n')) {
    if (FENCE_RE.test(line.trimStart())) fences++
  }
  if (fences % 2 === 1) {
    return content.endsWith('\n') ? `${content}\`\`\`` : `${content}\n\`\`\``
  }
  return content
}
