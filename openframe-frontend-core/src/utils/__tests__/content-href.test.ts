import { describe, expect, it } from 'vitest'
import { makeComposeContentUrl, DEFAULT_CONTENT_SUFFIXES } from '../content-href'

const HUB = 'https://openframe.app'

describe('makeComposeContentUrl (unified single-object seam)', () => {
  const compose = makeComposeContentUrl({
    hostedTypes: new Set(['onboarding_guide', 'product_release']),
    contentOrigin: HUB,
  })

  // ── Page-view inputs (no externalUrl; identifier IS the slug) ──────────────
  it('hosted type, no externalUrl → relative in-app href (default suffix)', () => {
    expect(compose({ type: 'onboarding_guide', identifier: 'getting-started' })).toEqual({
      href: '/onboarding-guides/getting-started',
      targetPlatform: null,
    })
    expect(compose({ type: 'product_release', identifier: 'v1-2-0' })).toEqual({
      href: '/releases/v1-2-0',
      targetPlatform: null,
    })
  })

  it('non-hosted type, no externalUrl → hub origin href', () => {
    expect(compose({ type: 'blog_post', identifier: 'hello' })).toEqual({
      href: `${HUB}/blog/hello`,
      targetPlatform: null,
    })
    expect(compose({ type: 'case_study', identifier: 'acme' })).toEqual({
      href: `${HUB}/case-studies/acme`,
      targetPlatform: null,
    })
  })

  it('always returns a tuple (never null) — even for an unknown type', () => {
    expect(compose({ type: 'totally_unknown', identifier: 'x' })).toEqual({
      href: `${HUB}/totally_unknown/x`,
      targetPlatform: null,
    })
  })

  it('ignores the platforms arg — membership in hostedTypes decides', () => {
    expect(
      compose({ type: 'onboarding_guide', identifier: 'g', platforms: [{ name: 'flamingo' }] }),
    ).toEqual({ href: '/onboarding-guides/g', targetPlatform: null })
  })

  // ── Chat-row inputs (externalUrl present; identifier is the id) ────────────
  it('hosted type WITH externalUrl → relativizes to in-app, recovering the slug from the URL', () => {
    // Chat rows carry the hub URL, not the slug, and `identifier` is the numeric
    // id — the in-app path must come from the externalUrl's last segment.
    expect(
      compose({
        type: 'product_release',
        identifier: '12345',
        externalUrl: `${HUB}/releases/my-cool-release`,
      }),
    ).toEqual({ href: '/releases/my-cool-release', targetPlatform: null })
  })

  it('non-hosted type WITH externalUrl → externalUrl verbatim + targetPlatform passthrough', () => {
    expect(
      compose({
        type: 'blog_post',
        identifier: '777',
        externalUrl: `https://www.openmsp.ai/blog/some-post`,
        targetPlatform: 'openmsp',
      }),
    ).toEqual({ href: 'https://www.openmsp.ai/blog/some-post', targetPlatform: 'openmsp' })
  })

  it('hosted type WITH externalUrl that has no path segment → falls back to the identifier', () => {
    // Origin-only URL → no last path segment → recover via the identifier.
    expect(
      compose({ type: 'product_release', identifier: 'fallback-slug', externalUrl: HUB }),
    ).toEqual({ href: '/releases/fallback-slug', targetPlatform: null })
  })

  it('hosted type WITH a list-style externalUrl whose last segment IS the type suffix → falls back to the identifier (no /releases/releases)', () => {
    // A malformed / list externalUrl like `${HUB}/releases/` has last segment
    // 'releases' === the type's own suffix. The `recovered !== seg` guard must
    // reject it and recover via the identifier, NOT emit a nonsensical
    // `/releases/releases`. (Covers the collision branch of the slug-recovery guard.)
    expect(
      compose({ type: 'product_release', identifier: 'fallback-slug', externalUrl: `${HUB}/releases/` }),
    ).toEqual({ href: '/releases/fallback-slug', targetPlatform: null })
  })

  // ── Config knobs ───────────────────────────────────────────────────────────
  it('custom suffixes override the defaults', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set(['onboarding_guide']),
      contentOrigin: HUB,
      suffixes: { onboarding_guide: 'docs/onboarding' },
    })
    expect(c({ type: 'onboarding_guide', identifier: 'g' })).toEqual({
      href: '/docs/onboarding/g',
      targetPlatform: null,
    })
  })

  it('per-type override wins over suffix + externalUrl logic', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set<string>(),
      contentOrigin: HUB,
      overrides: {
        product_release: (id) => ({ href: `/custom/${id}`, targetPlatform: 'openframe' }),
      },
    })
    expect(
      c({ type: 'product_release', identifier: 'v2', externalUrl: `${HUB}/releases/v2` }),
    ).toEqual({ href: '/custom/v2', targetPlatform: 'openframe' })
  })

  it('prototype keys do not leak from the suffix/override maps', () => {
    expect(compose({ type: 'constructor', identifier: 'x' })).toEqual({
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
      // Hub-side home of the segment: AUTHORS_PATH in lib/utils/breadcrumbs.ts
      // (PUBLIC_URL_PATHS.author derives from it).
      author: 'authors',
    })
  })
})
