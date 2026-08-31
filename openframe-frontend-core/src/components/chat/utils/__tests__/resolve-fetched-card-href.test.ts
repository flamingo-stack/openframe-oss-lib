import { describe, expect, it } from 'vitest';
import { makeComposeContentUrl } from '../../../../utils/content-href';
import { pickFetchedCardHref, resolveFetchedCardHref } from '../resolve-fetched-card-href';

const HUB = 'https://www.flamingo.run';

/** The OpenFrame Help Center seam, verbatim in shape from
 *  `openframe-oss-frontend/src/app/(app)/help-center/help-center-content-href.ts`. */
const compose = makeComposeContentUrl({
  hostedTypes: new Set(['onboarding_guide', 'product_release']),
  contentOrigin: HUB,
  suffixes: {
    onboarding_guide: 'help-center/onboarding-guides',
    product_release: 'help-center/releases',
    blog_post: 'blog',
    case_study: 'case-studies',
  },
  overrides: {
    roadmap_item: id => ({
      href: `/help-center/roadmap?search=${encodeURIComponent(id)}`,
      targetPlatform: null,
    }),
  },
});

describe('resolveFetchedCardHref — Mingo cards with no ref metadata', () => {
  it('override type deep-links on the MARKER id, not the fetched row id', () => {
    // The `[card://roadmap_item:86ad3qvv5]` id is the ClickUp task id the
    // roadmap list filters by; the fetched row carries its own db id.
    expect(
      resolveFetchedCardHref({
        contentRefType: 'roadmap_item',
        id: '86ad3qvv5',
        item: { id: 'db-uuid-9', title: 'Deep Google Workspace tenant management' },
        composeContentUrl: compose,
      }),
    ).toEqual({ href: '/help-center/roadmap?search=86ad3qvv5', targetPlatform: null, hostOverride: true });
  });

  it('hosted type uses the fetched row slug for its in-app detail route', () => {
    expect(
      resolveFetchedCardHref({
        contentRefType: 'product_release',
        id: 'row-uuid-1',
        item: { id: 'row-uuid-1', slug: 'v1-2-0' },
        composeContentUrl: compose,
      }),
    ).toEqual({ href: '/help-center/releases/v1-2-0', targetPlatform: null });
  });

  it('hosted type with no slug falls back to the marker id', () => {
    expect(
      resolveFetchedCardHref({
        contentRefType: 'onboarding_guide',
        id: 'guide-7',
        item: { id: 'guide-7' },
        composeContentUrl: compose,
      }),
    ).toEqual({ href: '/help-center/onboarding-guides/guide-7', targetPlatform: null });
  });

  it('non-hosted type resolves to the content hub', () => {
    expect(
      resolveFetchedCardHref({
        contentRefType: 'case_study',
        id: 'cs-1',
        item: { id: 'cs-1', slug: 'acme-migration' },
        composeContentUrl: compose,
      }),
    ).toEqual({ href: `${HUB}/case-studies/acme-migration`, targetPlatform: null });
  });

  it('legacy rail-vocab alias resolves to the SAME url as the canonical type', () => {
    // The card registry keys blog entries by `blog_post_existing` (what
    // `buildListUrl` wants). Both spellings must produce one url — the reported
    // split was `/blog/what-is-mdr` vs `/blog_post_existing/bitwarden-…`.
    const canonical = resolveFetchedCardHref({
      contentRefType: 'blog_post',
      id: 'p1',
      item: { id: 'p1', slug: 'bitwarden-review-for-msps' },
      composeContentUrl: compose,
    });
    const alias = resolveFetchedCardHref({
      contentRefType: 'blog_post_existing',
      id: 'p1',
      item: { id: 'p1', slug: 'bitwarden-review-for-msps' },
      composeContentUrl: compose,
    });
    expect(alias).toEqual(canonical);
    expect(alias).toEqual({
      href: `${HUB}/blog/bitwarden-review-for-msps`,
      targetPlatform: null,
    });
  });

  it('no seam wired → null (card stays unlinked, pre-existing behavior)', () => {
    expect(
      resolveFetchedCardHref({
        contentRefType: 'roadmap_item',
        id: '86ad3qvv5',
        item: { id: '86ad3qvv5' },
      }),
    ).toBeNull();
  });

  it('guards a missing type / id / malformed item', () => {
    expect(resolveFetchedCardHref({ contentRefType: '', id: 'x', item: {}, composeContentUrl: compose })).toBeNull();
    expect(
      resolveFetchedCardHref({
        contentRefType: 'case_study',
        id: '',
        item: {},
        composeContentUrl: compose,
      }),
    ).toBeNull();
    // A non-object item (or a non-string slug) must not throw — it just loses
    // the slug hint and falls back to the marker id.
    expect(
      resolveFetchedCardHref({
        contentRefType: 'case_study',
        id: 'cs-2',
        item: { slug: 42 },
        composeContentUrl: compose,
      }),
    ).toEqual({ href: `${HUB}/case-studies/cs-2`, targetPlatform: null });
  });
});

describe('makeComposeContentUrl — the new `slug` hint', () => {
  it('externalUrl still wins over the hint (SSE path unchanged)', () => {
    expect(
      compose({
        type: 'product_release',
        identifier: 'row-uuid-1',
        slug: 'from-the-row',
        externalUrl: `${HUB}/releases/from-the-url`,
      }),
    ).toEqual({ href: '/help-center/releases/from-the-url', targetPlatform: null });
  });

  it('applies to non-hosted types too — hub detail routes are slug-based', () => {
    expect(compose({ type: 'blog_post', identifier: 'id-1', slug: 'hello-world' })).toEqual({
      href: `${HUB}/blog/hello-world`,
      targetPlatform: null,
    });
  });

  it('no hint → identifier, unchanged for page-view and SSE callers', () => {
    expect(compose({ type: 'blog_post', identifier: 'hello-world' })).toEqual({
      href: `${HUB}/blog/hello-world`,
      targetPlatform: null,
    });
  });
});

describe('pickFetchedCardHref — which producer owns a fetched card destination', () => {
  const composedPlain = { href: `${HUB}/tickets/47979601418`, targetPlatform: null };
  const composedOverride = {
    href: '/help-center/tickets?ticket=479&search=479#ticket-479',
    targetPlatform: null,
    hostOverride: true,
  };

  it('an explicit host override beats the fetched row url', () => {
    // The regression: `hubspot_ticket_self` hydrates from the hub, whose row
    // carries `/tickets?ticket=…` — a path the OpenFrame console also owns, for
    // an unrelated ticket board. The host re-homes the type; that has to win.
    expect(
      pickFetchedCardHref({
        composed: composedOverride,
        itemHref: '/tickets?ticket=479&search=479#ticket-479',
        allowComposed: false,
      }),
    ).toEqual({
      source: 'hostOverride',
      href: '/help-center/tickets?ticket=479&search=479#ticket-479',
      targetPlatform: null,
    });
  });

  it('the row url still beats a merely SYNTHESIZED href — what noComposedHref guards', () => {
    expect(
      pickFetchedCardHref({ composed: composedPlain, itemHref: '/tickets?ticket=479', allowComposed: false }),
    ).toEqual({ source: 'item', href: '/tickets?ticket=479' });
    // …and even when synthesis is allowed, a row that knows its own url wins.
    expect(
      pickFetchedCardHref({ composed: composedPlain, itemHref: '/tickets?ticket=479', allowComposed: true }),
    ).toEqual({ source: 'item', href: '/tickets?ticket=479' });
  });

  it('falls through to the composed href only when the registry allows synthesis', () => {
    expect(pickFetchedCardHref({ composed: composedPlain, itemHref: null, allowComposed: true })).toEqual({
      source: 'composed',
      href: `${HUB}/tickets/47979601418`,
      targetPlatform: null,
    });
    expect(pickFetchedCardHref({ composed: composedPlain, itemHref: null, allowComposed: false })).toBeNull();
  });

  it('nothing to link to → null (card renders unlinked)', () => {
    expect(pickFetchedCardHref({ composed: null, itemHref: null, allowComposed: true })).toBeNull();
  });

  it('an override with no host seam wired cannot appear — null composed, row url stands', () => {
    expect(pickFetchedCardHref({ composed: null, itemHref: '/tickets?ticket=479', allowComposed: true })).toEqual({
      source: 'item',
      href: '/tickets?ticket=479',
    });
  });
});

describe('makeComposeContentUrl — hostOverride flag', () => {
  it('marks ONLY the explicit overrides branch', () => {
    expect(compose({ type: 'roadmap_item', identifier: 'task-1' })).toEqual({
      href: '/help-center/roadmap?search=task-1',
      targetPlatform: null,
      hostOverride: true,
    });
    // hosted, verbatim-externalUrl and origin-synthesis branches stay unflagged,
    // so a fetched row's own url keeps beating them.
    expect(compose({ type: 'product_release', identifier: 'rel-1', slug: 'v1' }).hostOverride).toBeUndefined();
    expect(
      compose({ type: 'blog_post', identifier: 'b-1', externalUrl: `${HUB}/blog/x` }).hostOverride,
    ).toBeUndefined();
    expect(compose({ type: 'blog_post', identifier: 'b-1' }).hostOverride).toBeUndefined();
  });
});
