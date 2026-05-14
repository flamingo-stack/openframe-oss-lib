"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "../../utils/cn"

interface CyclingPhraseProps {
  /** Words to cycle through. Cycle wraps around indefinitely. */
  words: readonly string[]
  /** Optional className applied to the outer span. */
  className?: string
  /** Milliseconds per character during the morph step. */
  charMs?: number
  /** Milliseconds to hold a fully-typed word before starting next morph. */
  holdMs?: number
}

// Idempotent keyframe — multiple component instances share the same
// CSS rule, no duplication issues.
const BLINK_KEYFRAMES = `
  @keyframes cyclingCursorBlink {
    50% { opacity: 0; }
  }
`

/**
 * Terminal-style cycling word: a fixed-size block cursor walks left-
 * to-right through the word, overwriting the previous word's char at
 * each position with the new word's char (or trimming trailing chars
 * if the new word is shorter). On hold the cursor is hidden — the
 * morph is the only time it appears. A static "..." suffix follows
 * the word at all times.
 *
 * Visual sequence (Thinking → Vibing):
 *   Thinking... (hold, no cursor)
 *   V█hinking...  → Vi█inking... → ... → Vibing█...
 *   Vibing... (hold, no cursor)
 *   ...
 *
 * Width is pinned to the longest word in the list (rendered invisibly
 * underneath) so cycling doesn't shift the dots or surrounding layout.
 */
export function CyclingPhrase({
  words,
  className,
  charMs = 60,
  holdMs = 4500,
}: CyclingPhraseProps) {
  const [wordIndex, setWordIndex] = useState(0)
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(0)
  const [holding, setHolding] = useState(false)

  // Width-reservation: longest word + "..." sets the outer min-width.
  const placeholder = useMemo(
    () => words.reduce((longest, w) => (w.length > longest.length ? w : longest), ''),
    [words],
  )

  useEffect(() => {
    if (words.length === 0) return
    const target = words[wordIndex]
    let timeoutId: ReturnType<typeof setTimeout>

    if (holding) {
      timeoutId = setTimeout(() => {
        setWordIndex((i) => (i + 1) % words.length)
        setCursor(0)
        setHolding(false)
      }, holdMs)
      return () => clearTimeout(timeoutId)
    }

    const maxLen = Math.max(text.length, target.length)
    if (cursor >= maxLen) {
      // Morph complete — pin to target and enter hold (cursor hides).
      if (text !== target) setText(target)
      setHolding(true)
      return
    }

    timeoutId = setTimeout(() => {
      setText((prev) => {
        if (cursor < target.length) {
          return target.slice(0, cursor + 1) + prev.slice(cursor + 1)
        }
        return prev.slice(0, cursor)
      })
      setCursor((c) => c + 1)
    }, charMs)
    return () => clearTimeout(timeoutId)
  }, [wordIndex, cursor, text, holding, words, charMs, holdMs])

  if (words.length === 0) return null

  const before = text.slice(0, cursor)
  const after = text.slice(cursor)

  // Block cursor — consistent size regardless of phase. Same style
  // every time it appears (no scaling/jitter). Blinks while visible.
  const cursorBlock = (
    <span
      aria-hidden
      className="inline-block bg-current align-baseline"
      style={{
        width: '0.6em',
        height: '1em',
        verticalAlign: '-0.1em',
        marginLeft: '1px',
        marginRight: '1px',
        animation: 'cyclingCursorBlink 1s steps(1) infinite',
      }}
    />
  )

  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      <style dangerouslySetInnerHTML={{ __html: BLINK_KEYFRAMES }} />
      {/* Invisible placeholder — pins width to longest word + "..." */}
      <span aria-hidden className="invisible">{placeholder}...</span>
      {/* Live layer */}
      <span className="absolute inset-0 inline-flex items-baseline" aria-live="polite">
        <span>{before}</span>
        {!holding && cursorBlock}
        <span>{after}</span>
        <span>...</span>
      </span>
    </span>
  )
}
