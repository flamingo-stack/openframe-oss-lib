/**
 * The "write silently failed" path, isolated.
 *
 * Mocked at the ADAPTER seam rather than by patching Web Storage: this repo runs vitest on a
 * Node that ships its own experimental `localStorage`/`sessionStorage`, so neither an instance
 * spy on `window.sessionStorage` nor a `Storage.prototype` patch reliably intercepts what the
 * adapter actually calls. The contract under test belongs to the adapter boundary anyway —
 * `save()` returns `void` and swallows its errors, so the only way to know a write stuck is
 * to read it back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store: { value: unknown } = { value: null }
/** When true, `save()` accepts the call and drops the value — a blocked/full quota. */
let swallowWrites = false

vi.mock('../local-storage-adapter', () => ({
  createLocalStorageAdapter: () => ({
    load: () => store.value,
    save: (value: unknown) => {
      if (swallowWrites) return
      store.value = value
    },
    clear: () => {
      store.value = null
    },
  }),
}))

const { captureFirstTouchAttribution, getFirstTouchAttribution } = await import(
  '../first-touch-attribution'
)

beforeEach(() => {
  store.value = null
  swallowWrites = false
  Object.defineProperty(window, 'location', {
    value: new URL('https://www.openmsp.ai/waitlist?utm_source=reddit'),
    writable: true,
    configurable: true,
  })
})

describe('captureFirstTouchAttribution persistence', () => {
  it('returns the record when the write sticks', () => {
    expect(captureFirstTouchAttribution().utm_source).toBe('reddit')
    expect(getFirstTouchAttribution().utm_source).toBe('reddit')
  })

  it('returns {} — NOT the record — when the write is swallowed', () => {
    swallowWrites = true
    // Returning the record here would hand the caller attribution that no later read can
    // recover: it would be replayed on this page view and absent on the next, which is worse
    // than never replaying it, because it looks like it worked.
    expect(captureFirstTouchAttribution()).toEqual({})
    expect(getFirstTouchAttribution()).toEqual({})
  })
})
