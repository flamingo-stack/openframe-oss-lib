/**
 * One record, every surface: its card, its chip in a sentence, its citation, its row of the sources strip and its search
 * result all open the same page in the same tab, through the one resolver (`resolveRecordDestination`), under each kind of
 * host (the hub, an app that hosts some types under its own route, an embedded guest). In embed mode a route the host
 * claimed stays on the host: the citation and the strip click through `RecordNavWrap` with `hostRoute`, as the card does.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatSourcePart } from '../../../chat-protocol/chat-message';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { makeEmbedderComposeContentUrl } from '../../../utils/content-href';
import { resolveSearchResultAction } from '../../shared/doc-search/resolve-search-result-action';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ChatMessageSources } from '../chat-message-sources';
import { recordRowOf, resolveRecordDestination } from '../utils/card-destination';
import { sourceRowInputOf } from '../utils/cited-sources';

const FLAMINGO = 'https://www.flamingo.run';
const GUIDE_URL = `${FLAMINGO}/onboarding-guides/mac-guide`;
const BLOG_URL = `${FLAMINGO}/blog/openframe-vs-atera`;

const appCompose = makeEmbedderComposeContentUrl({
  contentOrigin: FLAMINGO,
  routes: { onboardingGuide: slug => `/help-center/onboarding-guides/${slug}` },
});

const runtimeOf = (mode: 'host' | 'embed', compose = appCompose): ChatRuntime =>
  ({
    endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
    navigation: {
      mode,
      navigate: vi.fn().mockReturnValue(true),
      ...(mode === 'embed' ? { defaultContentOrigin: FLAMINGO } : {}),
    },
    source: 'openframe',
    composeContentUrl: compose,
  }) as unknown as ChatRuntime;

const sourcePart = (sourceId: string, url: string, title: string): ChatSourcePart => ({
  type: 'source-url',
  sourceId,
  url,
  title,
});

describe.each([
  ['the hub', runtimeOf('host', ({ externalUrl }) => ({ href: externalUrl ?? '', targetPlatform: 'flamingo' }))],
  ['an app hosting guides', runtimeOf('host')],
  ['an embedded guest', runtimeOf('embed')],
])('one destination on %s', (_host, runtime) => {
  it.each([
    ['onboarding_guide', 'mac-guide', GUIDE_URL],
    ['blog_post', 'openframe-vs-atera', BLOG_URL],
  ])('%s: card, chip, citation, strip row and search result agree', (type, id, url) => {
    const part = sourcePart(`record://${type}/${id}`, url, 'T');
    const card = resolveRecordDestination(recordRowOf({ chatRef: { type, id, title: 'T', url } }), runtime);
    const fromSource = resolveRecordDestination(sourceRowInputOf(part), runtime);
    expect(fromSource).toMatchObject({
      url: card.url,
      targetPlatform: card.targetPlatform,
      hostRoute: card.hostRoute,
      isNewTab: card.isNewTab,
    });
    const search = resolveSearchResultAction(
      { id, title: 'T', type: 'file', metadata: { url, sourceId: part.sourceId } },
      'openframe',
      runtime,
    );
    expect(search).toMatchObject({
      kind: card.isNewTab ? 'navigate-new-tab' : 'navigate-same-tab',
      targetPlatform: card.targetPlatform,
    });
    expect('hostRoute' in search && search.hostRoute).toBe(card.hostRoute);
  });
});

describe('an embedded guest keeps a route the host claimed on the host', () => {
  afterEach(() => vi.restoreAllMocks());

  const inChat = (runtime: ChatRuntime, node: React.ReactNode) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatRuntimeContext.Provider value={runtime}>{node}</ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
  const guide = sourcePart('record://onboarding_guide/mac-guide', GUIDE_URL, 'Mac guide');

  it("the strip's row navigates the host to its route, never a new hub tab", () => {
    const runtime = runtimeOf('embed');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    inChat(runtime, <ChatMessageSources message={{ id: 'a', role: 'assistant', parts: [guide] }} />);
    // The guide's table chip opens its rows; the row is the record's link.
    fireEvent.click(screen.getByText(/Onboarding/));
    const link = screen.getByRole('link', { name: /Mac guide/ });
    expect(link.getAttribute('href')).toBe('/help-center/onboarding-guides/mac-guide');
    expect(link.getAttribute('target')).toBeNull();
    fireEvent.click(link);
    expect(open).not.toHaveBeenCalled();
    expect(runtime.navigation.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/help-center/onboarding-guides/mac-guide' }),
    );
  });

  it('the citation does the same', () => {
    const runtime = runtimeOf('embed');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    inChat(
      runtime,
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          guide,
          {
            type: 'text',
            text: 'Install it.',
            citations: [
              {
                source: { type: 'source', sourceType: 'url', id: guide.sourceId, url: GUIDE_URL, title: 'Mac guide' },
                endIndex: 11,
              },
            ],
          },
        ]}
      />,
    );
    const chip = screen.getByRole('link', { name: '[1]' });
    expect(chip.getAttribute('href')).toBe('/help-center/onboarding-guides/mac-guide');
    fireEvent.click(chip);
    expect(open).not.toHaveBeenCalled();
    expect(runtime.navigation.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/help-center/onboarding-guides/mac-guide' }),
    );
  });
});
