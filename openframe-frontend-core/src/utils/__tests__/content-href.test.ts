import { describe, expect, it } from 'vitest';
import { makeEmbedderComposeContentUrl } from '../content-href';

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

  it('a record with no address of its own opens the hub, never a guessed path', () => {
    expect(compose({ type: 'blog_post', identifier: '1108' })).toEqual({ href: FLAMINGO_HUB, targetPlatform: null });
  });

  it('a page view passes the slug as its identifier; a list address of one segment gives no slug', () => {
    expect(
      compose({ type: 'product_release', identifier: 'v1-2-0', externalUrl: `${FLAMINGO_HUB}/releases` }).href,
    ).toBe('/help-center/releases/detail?slug=v1-2-0');
  });

  it('canonicalizes a rail-vocab alias before it names a page', () => {
    expect(compose({ type: 'blog_post_existing', identifier: '1', externalUrl: `${FLAMINGO_HUB}/blog/a` }).href).toBe(
      `${FLAMINGO_HUB}/blog/a`,
    );
  });

  it('prototype keys never name a page', () => {
    expect(compose({ type: 'toString', identifier: 'x', externalUrl: `${FLAMINGO_HUB}/x/y` }).href).toBe(
      `${FLAMINGO_HUB}/x/y`,
    );
  });

  describe("a doc in the host's viewer, at its tree path", () => {
    it("keeps the tree, where the url's last segment would lose it", () => {
      expect(
        compose({
          type: 'markdown',
          identifier: 'docs/guides/setup.md',
          externalUrl: 'https://hub.openframe.ai/knowledge-base/docs/guides/setup.md',
        }).href,
      ).toBe('/help-center/knowledge-base/docs/guides/setup.md');
    });

    it('strips what a route may not hold, and never climbs out of the tree', () => {
      expect(compose({ type: 'markdown', identifier: 'docs/a?x=1#y.md' }).href).toBe(
        '/help-center/knowledge-base/docs/ax1y.md',
      );
      expect(compose({ type: 'markdown', identifier: '../../admin/./x//y.md' }).href).toBe(
        '/help-center/knowledge-base/admin/x/y.md',
      );
    });

    it('the tree path, passed as the slug, wins over the row id', () => {
      expect(compose({ type: 'markdown', identifier: 'uuid-1', slug: '../docs/a?x=1.md' }).href).toBe(
        '/help-center/knowledge-base/docs/ax1.md',
      );
    });
  });
});
