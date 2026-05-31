import { describe, expect, it } from 'vitest'
import { makeComposeContentUrl, DEFAULT_CONTENT_SUFFIXES } from '../content-href'

const HUB = 'https://openframe.app'

describe('makeComposeContentUrl', () => {
  const compose = makeComposeContentUrl({
    hostedTypes: new Set(['onboarding_guide', 'product_release']),
    contentOrigin: HUB,
  })

  it('hosted type → relative in-app href (default suffix)', () => {
    expect(compose('onboarding_guide', 'getting-started')).toEqual({
      href: '/onboarding-guides/getting-started',
      targetPlatform: null,
    })
    expect(compose('product_release', 'v1-2-0')).toEqual({
      href: '/releases/v1-2-0',
      targetPlatform: null,
    })
  })

  it('non-hosted type → hub origin href', () => {
    expect(compose('blog_post', 'hello')).toEqual({
      href: `${HUB}/blog/hello`,
      targetPlatform: null,
    })
    expect(compose('case_study', 'acme')).toEqual({
      href: `${HUB}/case-studies/acme`,
      targetPlatform: null,
    })
  })

  it('always returns a tuple (never null) — even for an unknown type', () => {
    // No suffix entry → falls back to the raw type as the segment, hub origin.
    expect(compose('totally_unknown', 'x')).toEqual({
      href: `${HUB}/totally_unknown/x`,
      targetPlatform: null,
    })
  })

  it('ignores the platforms arg — membership in hostedTypes decides', () => {
    expect(
      compose('onboarding_guide', 'g', [{ name: 'flamingo' }]),
    ).toEqual({ href: '/onboarding-guides/g', targetPlatform: null })
  })

  it('custom suffixes override the defaults', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set(['onboarding_guide']),
      contentOrigin: HUB,
      suffixes: { onboarding_guide: 'docs/onboarding' },
    })
    expect(c('onboarding_guide', 'g')).toEqual({
      href: '/docs/onboarding/g',
      targetPlatform: null,
    })
  })

  it('per-type override wins over suffix logic', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set<string>(),
      contentOrigin: HUB,
      overrides: {
        product_release: (slug) => ({ href: `/custom/${slug}`, targetPlatform: 'openframe' }),
      },
    })
    expect(c('product_release', 'v2')).toEqual({ href: '/custom/v2', targetPlatform: 'openframe' })
  })

  it('prototype keys do not leak from the suffix/override maps', () => {
    // `constructor` is not a hosted type and not an own suffix key → raw segment, hub origin.
    expect(compose('constructor', 'x')).toEqual({
      href: `${HUB}/constructor/x`,
      targetPlatform: null,
    })
  })
})

describe('DEFAULT_CONTENT_SUFFIXES', () => {
  it('mirrors the hub PUBLIC_URL_PATHS public subset', () => {
    expect(DEFAULT_CONTENT_SUFFIXES).toMatchObject({
      onboarding_guide: 'onboarding-guides',
      product_release: 'releases',
      blog_post: 'blog',
      case_study: 'case-studies',
      customer_interview: 'interviews',
      investor_update: 'investor-updates',
      webinar: 'webinars',
      podcast: 'podcasts',
      event: 'events',
    })
  })
})
