'use client'

import * as React from 'react'

export interface UseDeferredErrorResult {
  /** The message to render (undefined while the reveal is deferred or the field is valid). */
  error: string | undefined
  /** Attach to the field's onBlur — reveals validation immediately and keeps it live from then on. */
  onBlur: () => void
}

/**
 * Defers showing a field validation message while the user is still typing.
 *
 * The message is revealed when the field loses focus (touched) or when the
 * value hasn't changed for `delay` ms; every keystroke restarts the timer.
 * Once touched, validation stays live. A message that clears (the value became
 * valid) disappears immediately.
 */
export function useDeferredError(error: string | undefined, value: string, delay = 1500): UseDeferredErrorResult {
  const [touched, setTouched] = React.useState(false)
  const [paused, setPaused] = React.useState(false)

  // Typing hides the message and restarts the pause timer.
  React.useEffect(() => {
    if (touched) return
    setPaused(false)
    const timer = setTimeout(() => setPaused(true), delay)
    return () => clearTimeout(timer)
  }, [value, delay, touched])

  const onBlur = React.useCallback(() => setTouched(true), [])

  return {
    error: error && (touched || paused) ? error : undefined,
    onBlur,
  }
}
