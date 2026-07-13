import { describe, it, expect } from 'vitest'
import { isCrossOriginUrl } from '../is-cross-origin-url'
import { decideNewTab } from '../decide-new-tab'

describe('isCrossOriginUrl', () => {
  it('treats falsy values as same-origin', () => {
    expect(isCrossOriginUrl(null)).toBe(false)
    expect(isCrossOriginUrl(undefined)).toBe(false)
    expect(isCrossOriginUrl('')).toBe(false)
  })

  it('treats same-document references as same-origin', () => {
    // Regression: bare-hash anchors ("More coming in Next Generations" on
    // /pricing) were classified cross-origin and opened in a new tab.
    expect(isCrossOriginUrl('#next-generations')).toBe(false)
    expect(isCrossOriginUrl('?tab=pricing')).toBe(false)
  })

  it('treats rooted relative paths as same-origin', () => {
    expect(isCrossOriginUrl('/support')).toBe(false)
    expect(isCrossOriginUrl('/roadmap#top')).toBe(false)
  })

  it('treats explicit-host URLs as cross-origin', () => {
    expect(isCrossOriginUrl('https://flamingo.run/support')).toBe(true)
    expect(isCrossOriginUrl('http://example.com')).toBe(true)
    expect(isCrossOriginUrl('//cdn.example.com/file.js')).toBe(true)
  })
})

describe('decideNewTab fallback (no targetPlatform)', () => {
  it('keeps same-page hash CTAs in the same tab', () => {
    expect(
      decideNewTab({ href: '#next-generations', currentSource: 'flamingo' }),
    ).toBe(false)
  })

  it('still opens explicit-host URLs in a new tab', () => {
    expect(
      decideNewTab({ href: 'https://example.com', currentSource: 'flamingo' }),
    ).toBe(true)
  })
})
