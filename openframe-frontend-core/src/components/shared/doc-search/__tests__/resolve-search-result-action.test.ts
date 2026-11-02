import { describe, expect, it } from 'vitest';
import type { ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { makeComposeContentUrl } from '../../../../utils/content-href';
import type { SearchResult } from '../../../ui/search-input';
import { resolveSearchResultAction } from '../resolve-search-result-action';

const HUB = 'https://www.flamingo.run';

/** A chat runtime in `mode`, for the `openframe` source, with no host override of the new-tab rule. */
const runtimeIn = (mode: 'host' | 'embed'): ChatRuntime =>
  ({ navigation: { mode, defaultContentOrigin: HUB }, source: 'openframe' }) as unknown as ChatRuntime;

/** A row for a guide the hub owns, shaped like `mapDocSearchResults` emits. */
const guideRow: SearchResult = {
  id: 'onboarding-guides/deploy-first-device',
  title: 'Deploy your first device',
  path: 'onboarding-guides/deploy-first-device',
  metadata: {
    url: `${HUB}/onboarding-guides/deploy-first-device`,
    sourceId: 'record://onboarding_guide/guide-123',
  },
};

/** The OpenFrame Help Center seam: the two hosted types live under
 *  `/help-center/...`, list-filter types deep-link with `?search=<id>`. */
const helpCenterCompose = makeComposeContentUrl({
  hostedTypes: new Set(['onboarding_guide', 'product_release']),
  contentOrigin: HUB,
  suffixes: {
    onboarding_guide: 'help-center/onboarding-guides',
    product_release: 'help-center/releases',
    blog_post: 'blog',
  },
  overrides: {
    delivery_item: id => ({ href: `/help-center/bug-fixes?search=${id}`, targetPlatform: null }),
  },
});

describe('resolveSearchResultAction — composeContentUrl seam', () => {
  it("no runtime → the server's url verbatim, the lib's default rule (another origin → new tab)", () => {
    expect(resolveSearchResultAction(guideRow, 'openframe', null)).toEqual({
      kind: 'navigate-new-tab',
      href: `${HUB}/onboarding-guides/deploy-first-device`,
      targetPlatform: 'flamingo',
    });
  });

  it('hosted type → the host in-app route, slug recovered from the url', () => {
    expect(resolveSearchResultAction(guideRow, 'openframe', runtimeIn('host'), helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/onboarding-guides/deploy-first-device',
      targetPlatform: null,
      hostRoute: true,
    });
  });

  it('relative composed href stays same-tab even in embed mode', () => {
    // `decideNewTab` forces new-tab under embed; an in-app path must not be
    // handed to window.open — the short-circuit runs before that decision.
    expect(resolveSearchResultAction(guideRow, 'openframe', runtimeIn('embed'), helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/onboarding-guides/deploy-first-device',
      targetPlatform: null,
      hostRoute: true,
    });
  });

  it('override type → the host deep-link, primary key as identifier', () => {
    const row: SearchResult = {
      id: 'delivery-1',
      title: 'Fix the thing',
      metadata: {
        url: `${HUB}/bug-fixes-and-enhancements?search=abc123`,
        sourceId: 'record://delivery_item/abc123',
      },
    };
    expect(resolveSearchResultAction(row, 'openframe', runtimeIn('host'), helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/bug-fixes?search=abc123',
      targetPlatform: null,
      hostRoute: true,
    });
  });

  it('non-hosted type → the seam returns the url verbatim, opens out', () => {
    const row: SearchResult = {
      id: 'blog-1',
      title: 'Hello',
      metadata: {
        url: `${HUB}/blog/hello`,
        sourceId: 'record://blog_post/blog-1',
      },
    };
    expect(resolveSearchResultAction(row, 'openframe', runtimeIn('host'), helpCenterCompose)).toEqual({
      kind: 'navigate-new-tab',
      href: `${HUB}/blog/hello`,
      targetPlatform: 'flamingo',
    });
  });

  it('row naming no record → seam skipped, the url verbatim, its platform from the url', () => {
    const row: SearchResult = {
      id: 'x',
      title: 'Untyped',
      metadata: { url: `${HUB}/somewhere` },
    };
    expect(resolveSearchResultAction(row, 'openframe', runtimeIn('host'), helpCenterCompose)).toEqual({
      kind: 'navigate-new-tab',
      href: `${HUB}/somewhere`,
      targetPlatform: 'flamingo',
    });
  });

  it('no url → ask-ai / route / noop fallbacks', () => {
    expect(
      resolveSearchResultAction(
        {
          id: 'cap-1',
          title: 'Cap Table',
          metadata: { sourceId: 'record://cap_table/row-9' },
        },
        'company-hub',
        runtimeIn('host'),
        helpCenterCompose,
      ),
    ).toEqual({
      kind: 'ask-ai',
      detail: {
        source: 'company-hub',
        ref: { type: 'cap_table', id: 'row-9', title: 'Cap Table', url: null },
      },
    });

    expect(
      resolveSearchResultAction(
        {
          id: 'doc',
          title: 'Doc',
          path: 'repo/architecture/api.md',
          metadata: { sourceId: 'record://markdown/repo%2Farchitecture%2Fapi.md' },
        },
        'openframe',
        runtimeIn('host'),
        helpCenterCompose,
      ),
    ).toEqual({ kind: 'route', path: 'repo/architecture/api.md' });

    expect(
      resolveSearchResultAction(
        { id: 'doc', title: 'Doc', path: 'repo/architecture/api.md' },
        'openframe',
        runtimeIn('host'),
        helpCenterCompose,
      ),
    ).toEqual({ kind: 'route', path: 'repo/architecture/api.md' });

    expect(
      resolveSearchResultAction({ id: 'empty', title: 'Empty' }, 'openframe', runtimeIn('host'), helpCenterCompose),
    ).toEqual({
      kind: 'noop',
    });
  });
});
