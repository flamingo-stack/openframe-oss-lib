/**
 * The server answers every record's url; a card and its chip open what the host's composer makes of it.
 *
 * Two contracts: the server's (a row's or a source part's absolute url is the destination, whoever carries it), and each
 * host's (hub, OpenFrame app, embedding example: chip and card give one href for every card type, and `hostRoute` is true
 * only for a relative route the composer claimed). The composers here are the shape each host wires; the hosts' own
 * suites pin their real ones.
 */

import { describe, expect, it } from 'vitest';
import { platformOfUrl } from '../../../../platform-domains';
import { type ComposeContentUrl, makeComposeContentUrl } from '../../../../utils/content-href';
import { buildListUrl } from '../../../../utils/list-url';
import { DOC_TABLE_TYPES } from '../../../../utils/source-grouping';
import type { ChatRef } from '../../chat-ref.types';
import { CHAT_CARD_REGISTRY } from '../../entity-cards/dispatch';
import { resolveCardDestination } from '../card-destination';
import { stripSameOriginToPath } from '../chat-nav-resolution';
import { resolveSourceRowCTA, type SourceRowContext } from '../source-row-cta';

const FLAMINGO = 'https://www.flamingo.run';

/** A record with only its identity, as a card mounts it before its row loads. */
const bare = (type: string, id: string): ChatRef => ({ type, id, title: id, url: null });

/** Ref-only types: nothing exists server-side to fetch, so nothing to open. */
const REF_ONLY = new Set(['deleted_data', 'video']);
const TYPES = Object.keys(CHAT_CARD_REGISTRY).filter(type => !REF_ONLY.has(type));

/** The url the one server rule answers for a record of `type`. A doc's id is its tree path. */
const answerOf = (type: string): { id: string; url: string } => {
  const isDoc = (DOC_TABLE_TYPES as readonly string[]).includes(type);
  const id = isDoc ? 'guides/getting-started/install.md' : '42';
  return { id, url: `${FLAMINGO}/${type}/${id}` };
};

/** The hub: its own platform relative, any other verbatim. */
const hubCompose: ComposeContentUrl = ({ externalUrl }) => {
  if (!externalUrl) return { href: '', targetPlatform: null };
  const owner = platformOfUrl(externalUrl);
  return owner === 'flamingo'
    ? { href: new URL(externalUrl).pathname, targetPlatform: 'flamingo' }
    : { href: externalUrl, targetPlatform: owner };
};

/** The OpenFrame app: hosted types, a doc by its tree path, a deep link of its own, the rest out. */
const appCompose = makeComposeContentUrl({
  hostedTypes: new Set(['onboarding_guide', 'product_release', 'markdown']),
  contentOrigin: FLAMINGO,
  suffixes: {
    onboarding_guide: 'help-center/onboarding-guides',
    product_release: 'help-center/releases',
    markdown: 'help-center/knowledge-base',
  },
  slugIsIdentifier: new Set(['markdown']),
  overrides: {
    delivery_item: id => ({ href: `/help-center/bug-fixes?search=${id}`, targetPlatform: null }),
    hubspot_ticket_self: id => ({ href: `/help-center/tickets?ticket=${id}`, targetPlatform: null }),
  },
});

/** The embedding example. */
const embedCompose = makeComposeContentUrl({
  hostedTypes: new Set(['onboarding_guide', 'product_release', 'markdown']),
  contentOrigin: FLAMINGO,
  suffixes: { onboarding_guide: 'onboarding-guides', product_release: 'releases', markdown: 'docs' },
  slugIsIdentifier: new Set(['markdown']),
});

describe('resolveCardDestination: the server contract', () => {
  const ctx: SourceRowContext = {};

  it('covers the whole registry', () => {
    expect(TYPES.length).toBeGreaterThan(40);
    for (const type of REF_ONLY) expect(Object.keys(CHAT_CARD_REGISTRY)).toContain(type);
  });

  it.each(TYPES)('%s: the url on the source part and the url on the row are one destination', type => {
    const { id, url } = answerOf(type);
    expect(CHAT_CARD_REGISTRY[type].contentRefType, 'a linkable card type must be fetchable').toBeTruthy();
    expect(buildListUrl(CHAT_CARD_REGISTRY[type].contentRefType ?? '', ['1']), 'and have a list endpoint').toBeTruthy();
    const onRef = resolveCardDestination({ chatRef: { ...bare(type, id), url }, ctx });
    const onRow = resolveCardDestination({
      chatRef: bare(type, id),
      item: { url },
      entry: CHAT_CARD_REGISTRY[type],
      ctx,
    });
    expect(onRef).toEqual({ url, targetPlatform: 'flamingo', path: null, hostRoute: false });
    expect(onRow).toEqual(onRef);
  });

  it.each([...REF_ONLY])('%s is ref-only: no row to fetch', type => {
    expect(CHAT_CARD_REGISTRY[type].contentRefType).toBeFalsy();
  });

  it("the ref's own url wins over the fetched row", () => {
    const chatRef = { ...bare('financial_kpi', 'k-1'), url: `${FLAMINGO}/admin/financials` };
    const out = resolveCardDestination({ chatRef, item: { url: 'https://elsewhere.test/x' }, ctx });
    expect(out.url).toBe(`${FLAMINGO}/admin/financials`);
  });

  it('a record with no url has no destination', () => {
    expect(
      resolveCardDestination({ chatRef: bare('hubspot_ticket_anon', '1'), item: { url: null }, ctx }).url,
    ).toBeNull();
  });

  it('refuses an unsafe url', () => {
    const out = resolveCardDestination({
      chatRef: bare('financial_kpi', 'k-1'),
      item: { url: 'javascript:alert(1)' },
      ctx,
    });
    expect(out).toMatchObject({ url: null, hostRoute: false });
  });

  it('names no platform for a third party, and the platform for a url on one of ours', () => {
    expect(
      resolveCardDestination({ chatRef: { ...bare('slack_message', '1'), url: 'https://x.slack.com/a' }, ctx })
        .targetPlatform,
    ).toBeNull();
    expect(
      resolveCardDestination({ chatRef: { ...bare('blog_post', '1'), url: `${FLAMINGO}/blog/a` }, ctx }).targetPlatform,
    ).toBe('flamingo');
  });
});

describe.each([
  ['hub', hubCompose],
  ['OpenFrame app', appCompose],
  ['embedding example', embedCompose],
])('resolveCardDestination: chip and card on the %s', (_host, composeContentUrl) => {
  const ctx: SourceRowContext = { composeContentUrl };

  it.each(TYPES)('%s: one href, on the ref and on the row', type => {
    const { id, url } = answerOf(type);
    const chip = resolveSourceRowCTA(
      { documentType: type, id, title: 'T', externalUrl: url, targetPlatform: platformOfUrl(url) },
      ctx,
    );
    const onRef = resolveCardDestination({ chatRef: { ...bare(type, id), url }, ctx, composeContentUrl });
    const onRow = resolveCardDestination({
      chatRef: bare(type, id),
      item: { url },
      entry: CHAT_CARD_REGISTRY[type],
      ctx,
      composeContentUrl,
    });
    expect(chip.href).toBeTruthy();
    expect(onRef.url).toBe(chip.href);
    expect(onRow.url).toBe(chip.href);
    expect(onRef.targetPlatform).toBe(chip.targetPlatform);
    // A relative href out of the composer can only be a route the host claimed.
    expect(onRef.hostRoute).toBe(!/^https?:/.test(chip.href ?? ''));
    expect(onRow.hostRoute).toBe(onRef.hostRoute);
  });
});

describe('resolveCardDestination: what a host claims', () => {
  it('keeps the tree path of a doc the host serves', () => {
    const { id, url } = answerOf('markdown');
    const out = resolveCardDestination({
      chatRef: { ...bare('markdown', id), url },
      ctx: { composeContentUrl: appCompose },
    });
    expect(out).toMatchObject({
      url: '/help-center/knowledge-base/guides/getting-started/install.md',
      hostRoute: true,
    });
  });

  it('a type the host does not serve opens out, on the server url', () => {
    const url = `${FLAMINGO}/blog/openframe-vs-atera`;
    const out = resolveCardDestination({
      chatRef: { ...bare('blog_post', '1108'), url },
      ctx: { composeContentUrl: appCompose },
    });
    expect(out).toEqual({ url, targetPlatform: 'flamingo', path: null, hostRoute: false });
  });

  it('a deep link of the host is its route', () => {
    const out = resolveCardDestination({
      chatRef: { ...bare('delivery_item', '86ak'), url: `${FLAMINGO}/delivery/86ak` },
      ctx: { composeContentUrl: appCompose },
    });
    expect(out).toMatchObject({ url: '/help-center/bug-fixes?search=86ak', hostRoute: true });
  });

  it("the hub's own platform stays on the preview: relative, the host's route", () => {
    const url = `${FLAMINGO}/blog/a`;
    expect(stripSameOriginToPath('/blog/a')).toBe('/blog/a');
    const out = resolveCardDestination({
      chatRef: { ...bare('blog_post', '1'), url },
      ctx: { composeContentUrl: hubCompose },
    });
    expect(out).toMatchObject({ url: '/blog/a', targetPlatform: 'flamingo', hostRoute: true });
  });
});

// TODO(CU-17tkuw61kfy): the old hub's page-shaped rows answer no url.
describe('legacyCardDestination', () => {
  const composeContentUrl = makeComposeContentUrl({
    hostedTypes: new Set(['onboarding_guide', 'data_room_doc']),
    contentOrigin: FLAMINGO,
    suffixes: { onboarding_guide: 'guides', data_room_doc: 'data-room' },
  });
  const ctx: SourceRowContext = { composeContentUrl };

  it('nothing to open before the row loads, and the composer once it has', () => {
    const entry = CHAT_CARD_REGISTRY.onboarding_guide;
    expect(
      resolveCardDestination({ chatRef: bare('onboarding_guide', 'g'), entry, ctx, composeContentUrl }).url,
    ).toBeNull();
    const out = resolveCardDestination({
      chatRef: bare('onboarding_guide', 'g'),
      item: { slug: 'mac' },
      entry,
      ctx,
      composeContentUrl,
    });
    expect(out).toMatchObject({ url: '/guides/mac', hostRoute: true });
  });

  it('a relative url an old row answered, which the composer hands back, is the content host’s page too', () => {
    const destination = resolveCardDestination({
      chatRef: bare('vendor', 'v'),
      item: { url: '/vendors/v' },
      ctx: { composeContentUrl: appCompose },
      composeContentUrl: appCompose,
    });
    expect(destination).toEqual({ url: '/vendors/v', targetPlatform: null, path: null, hostRoute: false });
  });

  it('a relative url the composer turned into a route of its own is one', () => {
    const destination = resolveCardDestination({
      chatRef: bare('product_release', 'r'),
      item: { url: '/releases/r' },
      ctx: { composeContentUrl: appCompose },
      composeContentUrl: appCompose,
    });
    expect(destination).toMatchObject({ url: '/help-center/releases/r', hostRoute: true });
  });

  it('a relative `fallbackHref` is the content host’s page, never a route of this host', () => {
    const out = resolveCardDestination({
      chatRef: bare('faq', '7'),
      item: { id: 7 },
      entry: CHAT_CARD_REGISTRY.faq,
      ctx,
      composeContentUrl,
    });
    expect(out.url).toMatch(/^\/faqs#/);
    expect(out.hostRoute).toBe(false);
  });

  it('a doc card takes the tree path from its row', () => {
    const entry = { contentRefType: 'data_room_doc', noComposedHref: true, fallbackHref: () => null };
    const out = resolveCardDestination({
      chatRef: bare('data_room_doc', 'd-1'),
      item: { id: 'd-1', url: null, metadata: { path: 'legal/ein-cp-575' } },
      entry,
      ctx,
      composeContentUrl,
    });
    expect(out).toMatchObject({ url: '/data-room/legal/ein-cp-575', path: 'legal/ein-cp-575', hostRoute: true });
  });
});
