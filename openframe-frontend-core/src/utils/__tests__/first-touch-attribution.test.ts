import { beforeEach, describe, expect, it } from 'vitest'

import {
  FIRST_TOUCH_ATTRIBUTION_KEY,
  captureFirstTouchAttribution,
  clearFirstTouchAttribution,
  getFirstTouchAttribution,
  parseAttributionFromUrl,
  sanitizeLandingUrl,
  withFirstTouchAttribution,
} from '../first-touch-attribution'

const LANDING = 'https://www.openmsp.ai/waitlist?utm_source=reddit&utm_medium=cpc'

function setHref(href: string) {
  // jsdom's location is read-only; replace it for the duration of the test.
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  })
}

/**
 * `window.localStorage` is NOT reliably present here: Node 26 ships an experimental global
 * `localStorage` that requires `--localstorage-file` and shadows jsdom's implementation, so it
 * resolves to undefined. `sessionStorage` — the only backend this module uses — is fine.
 */
const localStorageOrNull = (() => {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
})()

beforeEach(() => {
  window.sessionStorage.clear()
  localStorageOrNull?.clear()
  setHref(LANDING)
})

describe('parseAttributionFromUrl', () => {
  it('picks up the tracked params and nothing else', () => {
    expect(parseAttributionFromUrl(`${LANDING}&unrelated=x`)).toEqual({
      utm_source: 'reddit',
      utm_medium: 'cpc',
    })
  })

  it('returns {} for a URL with no attribution, and for garbage', () => {
    expect(parseAttributionFromUrl('https://x.com/')).toEqual({})
    expect(parseAttributionFromUrl('not a url')).toEqual({})
  })
})

describe('sanitizeLandingUrl', () => {
  it('keeps origin + pathname only', () => {
    expect(sanitizeLandingUrl(LANDING)).toBe('https://www.openmsp.ai/waitlist')
  })

  it('drops the fragment, where implicit-flow tokens live', () => {
    expect(sanitizeLandingUrl('https://x.com/cb#access_token=SECRET&token_type=bearer')).toBe(
      'https://x.com/cb',
    )
  })

  it.each([
    'https://x.com/auth?code=SECRET&state=abc',
    'https://x.com/reset?token=SECRET',
    'https://x.com/invite?email=jane%40acme.com',
  ])('drops the query entirely: %s', (url) => {
    const out = sanitizeLandingUrl(url)!
    expect(out).not.toContain('SECRET')
    expect(out).not.toContain('jane')
    expect(out).not.toContain('?')
  })

  it('rejects non-http(s) schemes and garbage', () => {
    expect(sanitizeLandingUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeLandingUrl('not a url')).toBeUndefined()
  })
})

describe('captureFirstTouchAttribution', () => {
  it('stores a sanitized record and reads back identically', () => {
    const stored = captureFirstTouchAttribution()
    expect(stored.utm_source).toBe('reddit')
    expect(stored.landing_url).toBe('https://www.openmsp.ai/waitlist')
    expect(stored.captured_at).toBeTruthy()
    expect(getFirstTouchAttribution()).toEqual(stored)
  })

  it('never persists a secret from the landing URL', () => {
    setHref('https://x.com/cb?utm_source=ads&code=SUPERSECRET#access_token=ALSOSECRET')
    captureFirstTouchAttribution()
    const raw = window.sessionStorage.getItem(FIRST_TOUCH_ATTRIBUTION_KEY) ?? ''
    expect(raw).not.toContain('SUPERSECRET')
    expect(raw).not.toContain('ALSOSECRET')
    expect(raw).toContain('ads')
  })

  it('is FIRST touch: a later landing does not overwrite', () => {
    const first = captureFirstTouchAttribution()
    setHref('https://www.openmsp.ai/?utm_source=bookmark')
    expect(captureFirstTouchAttribution()).toEqual(first)
    expect(getFirstTouchAttribution().utm_source).toBe('reddit')
  })

  it('stores nothing when the landing URL carries no attribution', () => {
    setHref('https://www.openmsp.ai/waitlist')
    expect(captureFirstTouchAttribution()).toEqual({})
    expect(window.sessionStorage.getItem(FIRST_TOUCH_ATTRIBUTION_KEY)).toBeNull()
  })

  it('uses sessionStorage, never localStorage', () => {
    captureFirstTouchAttribution()
    expect(window.sessionStorage.getItem(FIRST_TOUCH_ATTRIBUTION_KEY)).toBeTruthy()
    // Skipped where the runtime does not expose localStorage (see the note above); the
    // sessionStorage assertion is the load-bearing half either way.
    if (localStorageOrNull) {
      expect(localStorageOrNull.getItem(FIRST_TOUCH_ATTRIBUTION_KEY)).toBeNull()
    }
  })

})

describe('stored-shape validation', () => {
  it.each([
    ['a planted unknown key', JSON.stringify({ utm_source: 'x', is_admin: 'true' })],
    ['a non-string value', JSON.stringify({ utm_source: { $ne: null } })],
    ['an array', JSON.stringify([{ utm_source: 'x' }])],
    ['a bare string', JSON.stringify('utm_source=x')],
    ['malformed JSON', '{oops'],
  ])('rejects %s rather than replaying it', (_label, raw) => {
    window.sessionStorage.setItem(FIRST_TOUCH_ATTRIBUTION_KEY, raw)
    expect(getFirstTouchAttribution()).toEqual({})
    // The important half: nothing unexpected reaches a submit body.
    expect(withFirstTouchAttribution({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' })
  })

  it('accepts a well-formed record', () => {
    window.sessionStorage.setItem(
      FIRST_TOUCH_ATTRIBUTION_KEY,
      JSON.stringify({ utm_source: 'reddit', captured_at: '2026-01-01T00:00:00.000Z' }),
    )
    expect(getFirstTouchAttribution().utm_source).toBe('reddit')
  })
})

describe('withFirstTouchAttribution', () => {
  it('merges stored attribution into the body', () => {
    captureFirstTouchAttribution()
    expect(withFirstTouchAttribution({ email: 'a@b.com' })).toMatchObject({
      email: 'a@b.com',
      utm_source: 'reddit',
      utm_medium: 'cpc',
    })
  })

  it('lets an explicit body value WIN over the stored one', () => {
    captureFirstTouchAttribution()
    expect(withFirstTouchAttribution({ utm_source: 'typed-by-form' }).utm_source).toBe(
      'typed-by-form',
    )
  })

  it('strips empty values so a blank never reaches the API', () => {
    expect(withFirstTouchAttribution({ email: 'a@b.com', phone: '', name: null as any })).toEqual({
      email: 'a@b.com',
    })
  })

  it('is a no-op passthrough when nothing was captured', () => {
    expect(withFirstTouchAttribution({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' })
  })
})

describe('clearFirstTouchAttribution', () => {
  it('removes the record', () => {
    captureFirstTouchAttribution()
    clearFirstTouchAttribution()
    expect(getFirstTouchAttribution()).toEqual({})
  })
})
