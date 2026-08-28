import { describe, expect, it } from 'vitest';
import { makeComposeContentUrl } from '../../../../utils/content-href';
import type { SearchResult } from '../../../ui/search-input';
import { resolveSearchResultAction } from '../resolve-search-result-action';

const HUB = 'https://www.flamingo.run';

/** A RAG row for a guide the hub owns, shaped like `mapDocSearchResults` emits. */
const guideRow: SearchResult = {
  id: 'onboarding-guides/deploy-first-device',
  title: 'Deploy your first device',
  path: 'onboarding-guides/deploy-first-device',
  metadata: {
    documentType: 'onboarding_guide',
    externalUrl: `${HUB}/onboarding-guides/deploy-first-device`,
    sourceRepo: 'onboarding-guides',
    id: 'guide-123',
    targetPlatform: 'openframe',
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
  it('no seam wired → the RAG externalUrl verbatim (legacy behavior)', () => {
    expect(resolveSearchResultAction(guideRow, 'openframe')).toEqual({
      kind: 'navigate-same-tab',
      href: `${HUB}/onboarding-guides/deploy-first-device`,
    });
  });

  it('hosted type → the host in-app route, slug recovered from externalUrl', () => {
    expect(resolveSearchResultAction(guideRow, 'openframe', 'host', helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/onboarding-guides/deploy-first-device',
    });
  });

  it('relative composed href stays same-tab even in embed mode', () => {
    // `decideNewTab` forces new-tab under embed; an in-app path must not be
    // handed to window.open — the short-circuit runs before that decision.
    expect(resolveSearchResultAction(guideRow, 'openframe', 'embed', helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/onboarding-guides/deploy-first-device',
    });
  });

  it('override type → the host deep-link, primary key as identifier', () => {
    const row: SearchResult = {
      id: 'delivery-1',
      title: 'Fix the thing',
      metadata: {
        documentType: 'delivery_item',
        externalUrl: `${HUB}/bug-fixes-and-enhancements?search=abc123`,
        sourceRepo: 'clickup-delivery',
        id: 'abc123',
      },
    };
    expect(resolveSearchResultAction(row, 'openframe', 'host', helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: '/help-center/bug-fixes?search=abc123',
    });
  });

  it('non-hosted type → the seam returns externalUrl verbatim, opens out', () => {
    const row: SearchResult = {
      id: 'blog-1',
      title: 'Hello',
      metadata: {
        documentType: 'blog_post',
        externalUrl: `${HUB}/blog/hello`,
        sourceRepo: 'blog-posts',
        id: 'blog-1',
        targetPlatform: 'flamingo',
      },
    };
    expect(resolveSearchResultAction(row, 'openframe', 'host', helpCenterCompose)).toEqual({
      kind: 'navigate-new-tab',
      href: `${HUB}/blog/hello`,
    });
  });

  it('row without documentType → seam skipped, externalUrl verbatim', () => {
    const row: SearchResult = {
      id: 'x',
      title: 'Untyped',
      metadata: { externalUrl: `${HUB}/somewhere`, targetPlatform: 'openframe' },
    };
    expect(resolveSearchResultAction(row, 'openframe', 'host', helpCenterCompose)).toEqual({
      kind: 'navigate-same-tab',
      href: `${HUB}/somewhere`,
    });
  });

  it('no externalUrl → unchanged ask-ai / route / noop fallbacks', () => {
    expect(
      resolveSearchResultAction(
        {
          id: 'cap-1',
          title: 'Cap Table',
          metadata: { documentType: 'cap_table', sourceRepo: 'financial-cap-table', id: 'row-9' },
        },
        'company-hub',
        'host',
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
        { id: 'doc', title: 'Doc', path: 'repo/architecture/api.md' },
        'openframe',
        'host',
        helpCenterCompose,
      ),
    ).toEqual({ kind: 'route', path: 'repo/architecture/api.md' });

    expect(resolveSearchResultAction({ id: 'empty', title: 'Empty' }, 'openframe', 'host', helpCenterCompose)).toEqual({
      kind: 'noop',
    });
  });
});
