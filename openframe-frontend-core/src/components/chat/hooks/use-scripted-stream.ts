'use client'

/**
 * Playback clock for {@link buildStreamFrames}: advance through pre-built
 * scripted frames like a live chat stream — each frame holds for its own
 * `delayMs`, then the next reveals, parking on the last. Surface-agnostic: the
 * caller maps `frame.messages` to its own chat shape and reads `frame.phase` /
 * `frame.typing`.
 *
 * `resetKey` restarts playback from the top when a NEW conversation is selected
 * (identity change) — NOT when the SAME conversation grows (e.g. an Approve
 * appends its continuation), which must resume from where it paused. Because the
 * frame list's shared prefix is deterministic, keeping the index across a grow
 * resumes seamlessly into the appended frames.
 *
 * `prefers-reduced-motion` (or `enabled === false`) jumps straight to the final
 * frame (everything revealed, idle).
 */

import { useEffect, useState } from 'react'
import type { StreamFrame } from '../utils/scripted-stream'

const EMPTY_FRAME: StreamFrame = { messages: [], phase: 'idle', typing: false, delayMs: 0 }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function useScriptedStream(frames: StreamFrame[], resetKey: unknown, enabled = true): StreamFrame {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Restart from the top on a new conversation, synchronously during render
  // (React's "adjust state on prop change" pattern) so the previous stream's
  // last frame never flashes before the reset effect runs.
  const [prevKey, setPrevKey] = useState(resetKey)
  if (resetKey !== prevKey) {
    setPrevKey(resetKey)
    setIndex(0)
  }

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const playing = enabled && !reducedMotion && frames.length > 0
  const lastIndex = Math.max(0, frames.length - 1)

  // Advance one frame after the current frame's hold. When `frames` grows (an
  // Approve appends more), this effect re-runs and, if we were parked on the old
  // last frame, schedules the next — resuming the stream. `frames[index]` is
  // clamped because a shrink (a shorter new conversation before the reset lands)
  // could momentarily leave `index` past the end.
  useEffect(() => {
    if (!playing || index >= lastIndex) return
    const current = frames[Math.min(index, lastIndex)] ?? EMPTY_FRAME
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), current.delayMs)
    return () => clearTimeout(t)
  }, [index, frames, playing, lastIndex])

  if (frames.length === 0) return EMPTY_FRAME
  if (!playing) return frames[lastIndex]
  return frames[Math.min(index, lastIndex)] ?? EMPTY_FRAME
}
