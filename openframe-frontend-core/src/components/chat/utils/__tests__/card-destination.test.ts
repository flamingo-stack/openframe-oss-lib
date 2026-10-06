import { describe, expect, it } from 'vitest';
import { makeComposeContentUrl } from '../../../../utils/content-href';
import { buildListUrl } from '../../../../utils/list-url';
import type { ChatRef } from '../../chat-ref.types';
import { CHAT_CARD_REGISTRY } from '../../entity-cards/dispatch';
import { resolveCardDestination } from '../card-destination';
import { DOC_TABLE_TYPES, resolveSourceRowCTA, type SourceRowContext } from '../source-row-cta';

const HUB = 'https://www.flamingo.run';
const compose = makeComposeContentUrl({ hostedTypes: new Set<string>(), contentOrigin: HUB });
const ctx: SourceRowContext = {
  currentPlatform: 'company-hub',
  composeContentUrl: compose,
  docPlatformTargets: {
    data_room_doc: { platform: 'company-hub', basePath: '/data-room' },
    markdown: { platform: 'flamingo', basePath: '/knowledge-base' },
  },
};

/** What a `[card://type:id]` marker becomes before its row loads. */
const marker = (type: string, id: string): ChatRef => ({ type, id, title: id, url: null });

/** Ref-only types: nothing exists server-side to fetch, so nothing to open. */
const REF_ONLY = new Set(['deleted_data', 'video']);
const isDoc = (type: string) => (DOC_TABLE_TYPES as readonly string[]).includes(type);

describe('resolveCardDestination — every registered card type', () => {
  const types = Object.keys(CHAT_CARD_REGISTRY);

  it('covers the whole registry', () => {
    expect(types.length).toBeGreaterThan(40);
    for (const type of REF_ONLY) expect(types).toContain(type);
  });

  it.each(types.filter(t => !REF_ONLY.has(t)))('%s: a bare marker gets a destination once its row loads', type => {
    const entry = CHAT_CARD_REGISTRY[type];
    expect(entry.contentRefType, 'a linkable card type must be fetchable').toBeTruthy();
    expect(buildListUrl(entry.contentRefType ?? '', ['1']), 'and have a list endpoint').toBeTruthy();
    // The row as its list endpoint returns it: a doc row has a tree path and no
    // url, every other row has its own url and / or a slug the host composes from.
    const item = isDoc(type)
      ? { id: '1', title: 'T', url: null, metadata: { path: 'legal/doc' } }
      : { id: '1', title: 'T', slug: 'the-slug', url: `/${type}/1` };
    const before = resolveCardDestination({ chatRef: marker(type, '1'), entry, ctx, composeContentUrl: compose });
    const after = resolveCardDestination({ chatRef: marker(type, '1'), item, entry, ctx, composeContentUrl: compose });
    expect(before.url, 'nothing to open before the row loads').toBeNull();
    expect(after.url, 'clickable once it has').toBeTruthy();
  });

  it.each(types.filter(t => !REF_ONLY.has(t)))('%s: a card and its source chip open the same page', type => {
    const entry = CHAT_CARD_REGISTRY[type];
    // The row both surfaces are built from on the server (`resolveUrl` + `path`).
    const row = isDoc(type)
      ? { externalUrl: null, targetPlatform: null, path: 'legal/doc' }
      : { externalUrl: `${HUB}/${type}/1`, targetPlatform: 'flamingo', path: null };
    const chip = resolveSourceRowCTA({ documentType: type, id: '1', title: 'T', ...row }, ctx);
    expect(chip.href).toBeTruthy();

    // (a) the card mounted from a full ref (the SSE `refs` frame).
    const fullRef: ChatRef = {
      type,
      id: '1',
      title: 'T',
      url: row.externalUrl,
      targetPlatform: row.targetPlatform,
      ...(row.path ? { metadata: { path: row.path } } : {}),
    };
    const fromRef = resolveCardDestination({ chatRef: fullRef, entry, ctx, composeContentUrl: compose });
    expect(fromRef.url).toBe(chip.href);
    expect(fromRef.targetPlatform).toBe(chip.targetPlatform);

    // (b) the card mounted from a bare marker. For a type whose row is the
    //     server's own ChatRef (`url` as the server resolved it, or a doc's
    //     `metadata.path`), the marker card must land where the chip does.
    //     Types that derive their link from the row some other way (a slug the
    //     host composes, a fixed page, a ClickUp url) are held to (a) here and
    //     to their real rows in the hub's own test.
    const rowIsChatRef = isDoc(type) || entry.fallbackHref?.({ url: '/probe' }) === '/probe';
    if (!rowIsChatRef) return;
    const fromMarker = resolveCardDestination({
      chatRef: marker(type, '1'),
      item: { ...fullRef },
      entry,
      ctx,
      composeContentUrl: compose,
    });
    expect(fromMarker.url).toBe(chip.href);
  });

  it.each([...REF_ONLY])('%s is ref-only: no row to fetch', type => {
    expect(CHAT_CARD_REGISTRY[type].contentRefType).toBeFalsy();
  });
});

describe('resolveCardDestination — precedence', () => {
  const entry = { contentRefType: 'data_room_doc', noComposedHref: true, fallbackHref: () => null };

  it('a doc marker has no link until the row brings its path (the Company Hub report)', () => {
    const chatRef = marker('data_room_doc', 'd-1');
    expect(resolveCardDestination({ chatRef, entry, ctx }).url).toBeNull();
    const loaded = resolveCardDestination({
      chatRef,
      item: { id: 'd-1', url: null, metadata: { path: 'legal/ein-cp-575' } },
      entry,
      ctx,
    });
    expect(loaded).toMatchObject({ source: 'row', targetPlatform: 'company-hub', path: 'legal/ein-cp-575' });
    expect(loaded.url).toMatch(/\/data-room\/legal\/ein-cp-575$/);
  });

  it("the ref's own url wins over the fetched row", () => {
    const chatRef: ChatRef = { type: 'financial_kpi', id: 'k-1', title: 'K', url: '/admin/financials' };
    const out = resolveCardDestination({
      chatRef,
      item: { url: '/somewhere/else' },
      entry: { contentRefType: 'financial_kpi', noComposedHref: true, fallbackHref: i => i.url },
      ctx,
    });
    expect(out).toMatchObject({ url: '/admin/financials', source: 'row' });
  });

  it('applies the embed-mode prefix to a row-resolved href', () => {
    const chatRef: ChatRef = { type: 'financial_kpi', id: 'k-1', title: 'K', url: '/admin/financials' };
    const out = resolveCardDestination({ chatRef, ctx: {}, resolveHref: href => `https://hub.example${href}` });
    expect(out.url).toBe('https://hub.example/admin/financials');
  });

  it('refuses an unsafe row url', () => {
    const out = resolveCardDestination({
      chatRef: marker('financial_kpi', 'k-1'),
      item: { url: 'javascript:alert(1)' },
      entry: { contentRefType: 'financial_kpi', noComposedHref: true, fallbackHref: i => i.url },
      ctx,
    });
    expect(out).toMatchObject({ url: null, source: 'none' });
  });
});
