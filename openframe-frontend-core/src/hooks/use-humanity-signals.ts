'use client'

import { useCallback, useRef } from 'react'
import {
  HONEYPOT_FIELD,
  ELAPSED_MS_FIELD,
  type HumanitySignals,
} from '../utils/humanity-signals'

/**
 * useHumanitySignals — client primitive backing the invisible bot-protection
 * layer. Owns the honeypot <input> ref + a mount timestamp, and exposes the
 * props to render the field plus a getter that produces the wire object to
 * merge into a form's POST body. Reused by every public form (contact,
 * waitlist, ticket, review) so the signal shape lives in exactly one place.
 *
 * Usage:
 *   const { honeypotInputProps, getSignals, resetSignals } = useHumanitySignals()
 *   // render: <HoneypotField {...honeypotInputProps} />
 *   // submit: fetch(url, { body: JSON.stringify({ ...formData, ...getSignals() }) })
 *   // after a successful submit: resetSignals()
 *
 * The two signals are origin-independent (they ride in the body), so they keep
 * working when the form is embedded behind a reverse-proxy / prefixed URL.
 */
export function useHumanitySignals() {
  const ref = useRef<HTMLInputElement>(null)
  // performance.now() is monotonic (immune to wall-clock skew). SSR-guarded
  // even though the hook only executes on the client.
  const mountedAt = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0)

  const getSignals = useCallback(
    (): HumanitySignals => ({
      [HONEYPOT_FIELD]: ref.current?.value ?? '',
      [ELAPSED_MS_FIELD]:
        typeof performance !== 'undefined' ? Math.round(performance.now() - mountedAt.current) : 0,
    }),
    [],
  )

  const resetSignals = useCallback(() => {
    if (ref.current) ref.current.value = ''
    if (typeof performance !== 'undefined') mountedAt.current = performance.now()
  }, [])

  return { honeypotInputProps: { ref, name: HONEYPOT_FIELD }, getSignals, resetSignals } as const
}
