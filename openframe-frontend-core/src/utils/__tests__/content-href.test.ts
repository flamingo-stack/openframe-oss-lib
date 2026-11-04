import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_SUFFIXES, makeComposeContentUrl, makeEmbedderComposeContentUrl } from '../content-href';

const HUB = 'https://openframe.app';

describe('makeComposeContentUrl (unified single-object seam)', () => {
  const compose = makeComposeContentUrl({
    hostedTypes: new Set(['onboarding_guide', 'product_release']),
    contentOrigin: HUB,
  });

  // ── Page-view inputs (no externalUrl; identifier IS the slug) ──────────────
  it('hosted type, no externalUrl → relative in-app href (default suffix)', () => {
    expect(compose({ type: 'onboarding_guide', identifier: 'getting-started' })).toEqual({
      href: '/onboarding-guides/getting-started',
      targetPlatform: null,
    });
    expect(compose({ type: 'product_release', identifier: 'v1-2-0' })).toEqual({
      href: '/releases/v1-2-0',
      targetPlatform: null,
    });
  });

  it('non-hosted type, no externalUrl → hub origin href', () => {
    expect(compose({ type: 'blog_post', identifier: 'hello' })).toEqual({
      href: `${HUB}/blog/hello`,
      targetPlatform: null,
    });
    expect(compose({ type: 'case_study', identifier: 'acme' })).toEqual({
      href: `${HUB}/case-studies/acme`,
      targetPlatform: null,
    });
  });

  it('canonicalizes rail-vocab aliases before matching suffixes', () => {
    // `blog_post_existing` is the legacy ContentRef spelling `buildListUrl`
    // accepts. Without canonicalization here it missed `suffixes` entirely and
    // emitted `<hub>/blog_post_existing/<slug>` — the same post reachable at
    // two different urls depending on which call site produced the link.
    expect(compose({ type: 'blog_post_existing', identifier: 'hello' })).toEqual(
      compose({ type: 'blog_post', identifier: 'hello' }),
    );
    expect(compose({ type: 'blog_post_existing', identifier: 'hello' })).toEqual({
      href: `${HUB}/blog/hello`,
      targetPlatform: null,
    });
  });

  it('non-hosted row resolves to the OWNING platform, not to contentOrigin', () => {
    // The reported bug: an OpenMSP-owned blog post linked to flamingo.run.
    expect(compose({ type: 'blog_post', identifier: 'why-mdr', platforms: [{ name: 'openmsp' }] })).toEqual({
      href: 'https://www.openmsp.ai/blog/why-mdr',
      targetPlatform: 'openmsp',
    });
  });

  it('reads all three junction shapes the DALs produce', () => {
    const shapes = [
      [{ name: 'openmsp' }],
      [{ platform_name: 'openmsp' } as unknown as { name?: string }],
      [{ platforms: { name: 'openmsp' } } as unknown as { name?: string }],
    ];
    for (const platforms of shapes) {
      expect(compose({ type: 'blog_post', identifier: 'x', platforms }).href).toBe('https://www.openmsp.ai/blog/x');
    }
  });

  it('explicit targetPlatform wins over the junction', () => {
    expect(
      compose({
        type: 'blog_post',
        identifier: 'x',
        targetPlatform: 'tmcg',
        platforms: [{ name: 'openmsp' }],
      }),
    ).toEqual({ href: 'https://www.tmcg.miami/blog/x', targetPlatform: 'tmcg' });
  });

  it('falls back to contentOrigin for an unknown or absent platform', () => {
    expect(compose({ type: 'blog_post', identifier: 'x' })).toEqual({
      href: `${HUB}/blog/x`,
      targetPlatform: null,
    });
    // An unresolvable owner reports `null`, NOT its own name: the href came
    // from `contentOrigin`, and `decideNewTab` prefers `targetPlatform` over
    // its origin check — so claiming a platform here forced a same-host link
    // into a new tab.
    expect(compose({ type: 'blog_post', identifier: 'x', platforms: [{ name: 'not-a-platform' }] })).toEqual({
      href: `${HUB}/blog/x`,
      targetPlatform: null,
    });
    expect(compose({ type: 'blog_post', identifier: 'x', targetPlatform: 'not-a-platform' })).toEqual({
      href: `${HUB}/blog/x`,
      targetPlatform: null,
    });
  });

  it('externalUrl still wins — the RAG url is authoritative', () => {
    expect(
      compose({
        type: 'blog_post',
        identifier: 'x',
        externalUrl: 'https://www.openmsp.ai/blog/x',
        targetPlatform: 'openmsp',
        platforms: [{ name: 'flamingo' }],
      }),
    ).toEqual({ href: 'https://www.openmsp.ai/blog/x', targetPlatform: 'openmsp' });
  });

  it('always returns a tuple (never null) — even for an unknown type', () => {
    expect(compose({ type: 'totally_unknown', identifier: 'x' })).toEqual({
      href: `${HUB}/totally_unknown/x`,
      targetPlatform: null,
    });
  });

  it('ignores the platforms arg — membership in hostedTypes decides', () => {
    expect(compose({ type: 'onboarding_guide', identifier: 'g', platforms: [{ name: 'flamingo' }] })).toEqual({
      href: '/onboarding-guides/g',
      targetPlatform: null,
    });
  });

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
    ).toEqual({ href: '/releases/my-cool-release', targetPlatform: null });
  });

  it('non-hosted type WITH externalUrl → externalUrl verbatim + targetPlatform passthrough', () => {
    expect(
      compose({
        type: 'blog_post',
        identifier: '777',
        externalUrl: `https://www.openmsp.ai/blog/some-post`,
        targetPlatform: 'openmsp',
      }),
    ).toEqual({ href: 'https://www.openmsp.ai/blog/some-post', targetPlatform: 'openmsp' });
  });

  it('hosted type WITH externalUrl that has no path segment → falls back to the identifier', () => {
    // Origin-only URL → no last path segment → recover via the identifier.
    expect(compose({ type: 'product_release', identifier: 'fallback-slug', externalUrl: HUB })).toEqual({
      href: '/releases/fallback-slug',
      targetPlatform: null,
    });
  });

  it('hosted type WITH a list-style externalUrl whose last segment IS the type suffix → falls back to the identifier (no /releases/releases)', () => {
    // A malformed / list externalUrl like `${HUB}/releases/` has last segment
    // 'releases' === the type's own suffix. The `recovered !== seg` guard must
    // reject it and recover via the identifier, NOT emit a nonsensical
    // `/releases/releases`. (Covers the collision branch of the slug-recovery guard.)
    expect(compose({ type: 'product_release', identifier: 'fallback-slug', externalUrl: `${HUB}/releases/` })).toEqual({
      href: '/releases/fallback-slug',
      targetPlatform: null,
    });
  });

  // ── Config knobs ───────────────────────────────────────────────────────────
  it('custom suffixes override the defaults', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set(['onboarding_guide']),
      contentOrigin: HUB,
      suffixes: { onboarding_guide: 'docs/onboarding' },
    });
    expect(c({ type: 'onboarding_guide', identifier: 'g' })).toEqual({
      href: '/docs/onboarding/g',
      targetPlatform: null,
    });
  });

  it('per-type override wins over suffix + externalUrl logic', () => {
    const c = makeComposeContentUrl({
      hostedTypes: new Set<string>(),
      contentOrigin: HUB,
      overrides: {
        product_release: id => ({ href: `/custom/${id}`, targetPlatform: 'openframe' }),
      },
    });
    expect(c({ type: 'product_release', identifier: 'v2', externalUrl: `${HUB}/releases/v2` })).toEqual({
      href: '/custom/v2',
      targetPlatform: 'openframe',
    });
  });

  it('prototype keys do not leak from the suffix/override maps', () => {
    expect(compose({ type: 'constructor', identifier: 'x' })).toEqual({
      href: `${HUB}/constructor/x`,
      targetPlatform: null,
    });
  });
});

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
    });
  });
});

describe('makeComposeContentUrl: slugIsIdentifier', () => {
  const compose = makeComposeContentUrl({
    hostedTypes: new Set(['markdown', 'product_release']),
    contentOrigin: 'https://www.flamingo.run',
    suffixes: { markdown: 'knowledge-base', product_release: 'releases' },
    slugIsIdentifier: new Set(['markdown']),
  });

  it("keeps a doc's tree path, where the url's last segment would lose it", () => {
    expect(
      compose({
        type: 'markdown',
        identifier: 'docs/guides/setup.md',
        externalUrl: 'https://hub.openframe.ai/knowledge-base/docs/guides/setup.md',
      }),
    ).toEqual({ href: '/knowledge-base/docs/guides/setup.md', targetPlatform: null });
  });

  it('strips what a route may not hold', () => {
    expect(compose({ type: 'markdown', identifier: 'docs/a?x=1#y.md' }).href).toBe('/knowledge-base/docs/ax1y.md');
  });

  it('never climbs out of the docs tree', () => {
    expect(compose({ type: 'markdown', identifier: '../../admin/./x//y.md' }).href).toBe(
      '/knowledge-base/admin/x/y.md',
    );
  });

  it('strips the slug hint the same way', () => {
    expect(compose({ type: 'markdown', identifier: 'uuid-1', slug: '../docs/a?x=1.md' }).href).toBe(
      '/knowledge-base/docs/ax1.md',
    );
  });

  it('a doc`s tree path, passed as the slug, wins over its row id', () => {
    expect(compose({ type: 'markdown', identifier: 'uuid-1', slug: 'docs/setup.md' }).href).toBe(
      '/knowledge-base/docs/setup.md',
    );
  });

  it('every other hosted type recovers its slug from the url', () => {
    expect(
      compose({
        type: 'product_release',
        identifier: 'id-1',
        externalUrl: 'https://www.flamingo.run/releases/v1-2-0',
      }).href,
    ).toBe('/releases/v1-2-0');
  });
});

const FLAMINGO_HUB = 'https://www.flamingo.run';

describe('makeEmbedderComposeContentUrl', () => {
  const compose = makeEmbedderComposeContentUrl({
    contentOrigin: FLAMINGO_HUB,
    routes: {
      onboardingGuide: slug => `/help-center/onboarding-guides/detail?slug=${slug}`,
      release: slug => `/help-center/releases/detail?slug=${slug}`,
      knowledgeBase: '/help-center/knowledge-base',
      roadmap: '/help-center/roadmap',
      delivery: '/help-center/bug-fixes-and-enhancements',
      faqs: '/help-center/faqs',
      tickets: '/help-center/tickets',
      trustCenter: '/help-center/trust-center',
    },
  });

  it("opens a record the host has a page for on the host's own route", () => {
    expect(
      compose({
        type: 'onboarding_guide',
        identifier: '7',
        externalUrl: `${FLAMINGO_HUB}/onboarding-guides/mac-guide`,
      }),
    ).toEqual({ href: '/help-center/onboarding-guides/detail?slug=mac-guide', targetPlatform: null });
    expect(compose({ type: 'product_release', identifier: 'v1-2-0' })).toEqual({
      href: '/help-center/releases/detail?slug=v1-2-0',
      targetPlatform: null,
    });
    expect(compose({ type: 'markdown', identifier: 'docs/setup.md' }).href).toBe(
      '/help-center/knowledge-base/docs/setup.md',
    );
    expect(compose({ type: 'roadmap_item', identifier: '86ad' }).href).toBe('/help-center/roadmap?search=86ad');
    expect(compose({ type: 'delivery_item', identifier: '86ae' }).href).toBe(
      '/help-center/bug-fixes-and-enhancements?search=86ae',
    );
    expect(compose({ type: 'faq', identifier: '49' }).href).toBe('/help-center/faqs#faq-item-49');
    expect(compose({ type: 'hubspot_ticket_self', identifier: '12' }).href).toMatch(
      /^\/help-center\/tickets\?ticket=12/,
    );
    expect(compose({ type: 'trust_center', identifier: 'main' }).href).toBe('/help-center/trust-center');
  });

  it("opens every other record at the server's address, naming no platform (an embedder is none)", () => {
    expect(
      compose({
        type: 'blog_post',
        identifier: '1',
        externalUrl: `${FLAMINGO_HUB}/blog/a`,
        targetPlatform: 'flamingo',
      }),
    ).toEqual({ href: `${FLAMINGO_HUB}/blog/a`, targetPlatform: null });
  });

  it("a page the host does not name is the hub's", () => {
    const bare = makeEmbedderComposeContentUrl({ contentOrigin: FLAMINGO_HUB, routes: {} });
    expect(bare({ type: 'faq', identifier: '49', externalUrl: `${FLAMINGO_HUB}/faqs#faq-item-49` })).toEqual({
      href: `${FLAMINGO_HUB}/faqs#faq-item-49`,
      targetPlatform: null,
    });
  });
});
