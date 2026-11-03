/**
 * Chips and cards through the real component and the real markdown engine. A record link
 * (`[name](record://type/id)`) is a chip in the sentence and never a card; a card comes only from the message's
 * `data-record-cards` part and is drawn where that part sits in the message.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyChunk, createWireState } from '../../../chat-protocol/apply-chunk';
import type { ChatPart } from '../../../chat-protocol/chat-message';
import { createMingoDecoder, messageOfStoredRow } from '../../../chat-protocol/message-decoder';
import { recordHref } from '../../../chat-protocol/record-link';
import {
  CHAT_INTERRUPTED_AFTER_RUN_NOTICE,
  CHAT_INTERRUPTED_NOTICE,
  CHAT_TIMED_OUT_AFTER_RUN_NOTICE,
} from '../../../chat-protocol/ui-chunks';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import type { ChatRef } from '../chat-ref.types';
import { ChatCardLoader } from '../entity-cards/dispatch';
import type { HistoricalMessage } from '../types';
import { processHistoricalMessages } from '../utils/process-historical-messages';

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>;
}

/** A fetch-mode card: a plain element, which the bubble hoists as a block. */
const renderEntityCard = (ref: ChatRef) => <div data-testid={`card-${ref.id}`}>{ref.title}</div>;

const renderRecordChip = ({ type, id }: { type: string; id: string; label: string }) =>
  type === 'script' ? <span data-testid={`chip-${type}-${id}`}>{id}</span> : null;

function show(text: string, cards: Array<{ type: string; id: string }> = []) {
  const parts: ChatPart[] = [
    ...(cards.length > 0
      ? [{ type: 'data-record-cards' as const, data: { records: cards.map(card => recordHref(card.type, card.id)) } }]
      : []),
    { type: 'text', text },
  ];
  return render(
    <ChatMessageEnhanced
      role="assistant"
      parts={parts}
      renderEntityCard={renderEntityCard}
      renderRecordChip={renderRecordChip}
      NavLinkAnchor={NavLinkAnchor}
    />,
  );
}

describe('ChatMessageEnhanced — record links', () => {
  it('draws a record the host has a chip for with the host chip, and no card for a chip-only type', () => {
    show('Run [Patch script](record://script/6aad91a3b776f95ad7491bd9) again.');
    expect(screen.getByTestId('chip-script-6aad91a3b776f95ad7491bd9')).toBeTruthy();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });

  // TODO(CU-17tkuw61kfy): goes with the old mention token, `old-wire.ts`.
  describe('an old mention no host resolved', () => {
    it('reads as the raw token it was, for a word that names no record', () => {
      show('Connect to [@server:8080](record://server/8080) now.');
      expect(screen.queryByTestId('inline-chip')).toBeNull();
      const token = screen.getByText('@server:8080');
      expect(token.tagName).toBe('SPAN');
      expect(token.className).toContain('text-ods-text-secondary');
      expect(screen.queryByText(/record:\/\//)).toBeNull();
    });

    it('still reads as a chip when the type is a record the lib can open', () => {
      show('Read [@onboarding_guide:mac-guide](record://onboarding_guide/mac-guide) first.');
      expect(within(screen.getByTestId('inline-chip')).getByText('@onboarding_guide:mac-guide')).toBeTruthy();
    });

    it('leaves the host its chip, and a name its chip, whatever the type', () => {
      show('Run [@script:s1](record://script/s1) on [MacBook](record://device/abc).');
      expect(screen.getByTestId('chip-script-s1')).toBeTruthy();
      expect(within(screen.getByTestId('inline-chip')).getByText('MacBook')).toBeTruthy();
    });

    it('is what the decoder makes of a word followed by a port', () => {
      const entry = createMingoDecoder().decode({ type: 'TEXT', text: 'Run @redis:6379 first.' }, { row: { seq: 1 } });
      const wire = createWireState();
      const parts = entry.chunks.reduce<ChatPart[]>((all, chunk) => applyChunk(all, chunk, wire), []);
      render(<ChatMessageEnhanced role="assistant" parts={parts} NavLinkAnchor={NavLinkAnchor} />);
      expect(screen.queryByTestId('inline-chip')).toBeNull();
      expect(screen.getByText('@redis:6379').tagName).toBe('SPAN');
    });
  });

  it('draws a linked record as a chip with its name in the sentence, and no card from the link', () => {
    show('The [Mac guide](record://onboarding_guide/mac-guide) covers it.');
    expect(within(screen.getByTestId('inline-chip')).getByText('Mac guide')).toBeTruthy();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
    expect(screen.queryByText(/record:\/\//)).toBeNull();
  });

  it('draws a record-cards part where it sits: between the text before and after it', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          { type: 'text', text: 'Putting it in the same list:' },
          { type: 'data-record-cards', data: { records: ['record://onboarding_guide/mac-guide'] } },
          { type: 'text', text: 'The [Mac guide](record://onboarding_guide/mac-guide) covers it.' },
        ]}
        renderEntityCard={renderEntityCard}
        renderRecordChip={renderRecordChip}
        NavLinkAnchor={NavLinkAnchor}
      />,
    );
    const cards = screen.getByTestId('chat-record-cards');
    // Titled by the name the text gives the record.
    expect(within(cards).getByTestId('card-mac-guide').textContent).toBe('Mac guide');
    const before = screen.getByText(/Putting it in the same list/);
    const after = screen.getByText(/covers it/);
    expect(before.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cards.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("takes a card's title and url from the message's own source part with the same URI", () => {
    const seen: ChatRef[] = [];
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            type: 'source-url',
            sourceId: 'record://blog_post/1108',
            url: 'https://www.flamingo.run/blog/a',
            title: 'A',
          },
          { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
        ]}
        renderEntityCard={ref => {
          seen.push(ref);
          return <div>{ref.title}</div>;
        }}
        NavLinkAnchor={NavLinkAnchor}
      />,
    );
    expect(seen[0]).toMatchObject({
      type: 'blog_post',
      id: '1108',
      title: 'A',
      url: 'https://www.flamingo.run/blog/a',
    });
  });

  it('draws one card per record however many times the part names it', () => {
    show('Here it is.', [
      { type: 'onboarding_guide', id: 'mac-guide' },
      { type: 'onboarding_guide', id: 'mac-guide' },
    ]);
    expect(within(screen.getByTestId('chat-record-cards')).getAllByTestId('card-mac-guide')).toHaveLength(1);
  });

  describe('one card per record in a message, where it first shows', () => {
    const card = (id: string): ChatPart => ({
      type: 'data-record-cards',
      data: { records: [`record://blog_post/${id}`] },
    });
    const draw = (parts: ChatPart[]) =>
      render(<ChatMessageEnhanced role="assistant" parts={parts} renderEntityCard={renderEntityCard} />);

    it('across parts, and a part left with nothing draws nothing', () => {
      draw([card('7'), { type: 'text', text: 'Between.' }, card('7'), { type: 'text', text: 'End.' }]);
      expect(screen.getAllByTestId('card-7')).toHaveLength(1);
      expect(screen.getAllByTestId('chat-record-cards')).toHaveLength(1);
    });

    it('a part keeps the records it shows first', () => {
      draw([
        card('7'),
        { type: 'text', text: 'Between.' },
        {
          type: 'data-record-cards',
          data: { records: ['record://blog_post/7', 'record://blog_post/8'] },
        },
      ]);
      expect(screen.getAllByTestId('card-7')).toHaveLength(1);
      expect(screen.getAllByTestId('card-8')).toHaveLength(1);
    });

    it('an old Mingo row that names a record twice', () => {
      const { messages } = processHistoricalMessages([
        {
          id: 'a1',
          createdAt: '2026-01-01T00:00:01Z',
          owner: { type: 'ASSISTANT' },
          messageData: [
            { type: 'TEXT', text: 'See [card://blog_post:7] first.\n\nMore.\n\n[card://blog_post:7]\n\nEnd.' },
          ],
        },
      ] as never);
      draw(messages[0].parts);
      expect(screen.getAllByTestId('card-7')).toHaveLength(1);
    });

    it('an old hub`s row that names a record twice', () => {
      const message = messageOfStoredRow({
        seq: 2,
        role: 'assistant',
        content: '[card://blog_post:7]\n\nIntro.\n\n[card://blog_post:7]\n',
        sources: [],
      });
      draw(message?.parts ?? []);
      expect(screen.getAllByTestId('card-7')).toHaveLength(1);
    });
  });

  it('whitespace between two cards draws no block of its own', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          { type: 'data-record-cards', data: { records: ['record://blog_post/1'] } },
          { type: 'text', text: '\n\n' },
          { type: 'data-record-cards', data: { records: ['record://blog_post/2'] } },
        ]}
        renderEntityCard={renderEntityCard}
      />,
    );
    expect(screen.getByTestId('card-1')).toBeTruthy();
    expect(screen.getByTestId('card-2')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('draws no card for a type the chat has none for, even in the part', () => {
    show('Run it.', [{ type: 'script', id: '6aad91a3b776f95ad7491bd9' }]);
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });

  it('draws no chip and no card for a record link quoted in code', () => {
    show('Write `[Guide](record://onboarding_guide/mac-guide)` to link it.');
    expect(screen.queryByTestId('inline-chip')).toBeNull();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });
});

describe('ChatMessageEnhanced — a record chip opens its record', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("links the chip to the page the record's card opens, and routes a click through the runtime", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ items: [{ id: 'mac-guide', slug: 'install-on-mac' }] }))),
      ),
    );
    const navigate = vi.fn().mockReturnValue(true);
    const runtime = {
      endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
      navigation: { mode: 'host', navigate },
      source: 'flamingo',
      composeContentUrl: ({ slug }: { slug?: string | null }) => ({ href: `/onboarding-guides/${slug}` }),
    } as unknown as ChatRuntime;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatRuntimeContext.Provider value={runtime}>
          <ChatMessageEnhanced
            role="assistant"
            parts={[{ type: 'text', text: 'The [Mac guide](record://onboarding_guide/mac-guide) covers it.' }]}
            renderEntityCard={renderEntityCard}
            NavLinkAnchor={NavLinkAnchor}
          />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    const link = await screen.findByRole('link', { name: 'Mac guide' });
    expect(link.getAttribute('href')).toBe('/onboarding-guides/install-on-mac');
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/onboarding-guides/install-on-mac' }));
  });
});

describe('ChatMessageEnhanced — a chip that knows only its id', () => {
  afterEach(() => vi.unstubAllGlobals());
  const runtime = {
    endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
    navigation: { mode: 'host', navigate: vi.fn().mockReturnValue(true) },
    source: 'flamingo',
    composeContentUrl: ({ slug }: { slug?: string | null }) => ({ href: `/onboarding-guides/${slug}` }),
  } as unknown as ChatRuntime;
  const answer = (text: string) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="assistant" parts={[{ type: 'text', text }]} NavLinkAnchor={NavLinkAnchor} />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
  const answersRow = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [{ id: 'mac-guide', slug: 'mac', title: 'Install on a Mac' }] })),
        ),
      ),
    );

  it('shows the name its row answers', async () => {
    answersRow();
    render(answer('See [mac-guide](record://onboarding_guide/mac-guide) now.'));
    expect(await screen.findByRole('link', { name: 'Install on a Mac' })).toBeTruthy();
  });

  it('a name the answer gave stays', async () => {
    answersRow();
    render(answer('See [Mac guide](record://onboarding_guide/mac-guide) now.'));
    expect(await screen.findByRole('link', { name: 'Mac guide' })).toBeTruthy();
  });
});

describe('ChatMessageEnhanced — a chip whose row cannot load', () => {
  const runtime = {
    endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
    navigation: { mode: 'host', navigate: vi.fn().mockReturnValue(true) },
    source: 'flamingo',
    composeContentUrl: ({ externalUrl }: { externalUrl?: string | null }) => ({ href: externalUrl ?? null }),
  } as unknown as ChatRuntime;
  const VENDOR_URI = 'record://vendor/299';
  const VENDOR_URL = 'https://www.openmsp.ai/vendors/atera';
  const answer = (sources: ChatPart[]) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced
          role="assistant"
          parts={[...sources, { type: 'text', text: `Compare it with [Atera](${VENDOR_URI}).` }]}
          NavLinkAnchor={NavLinkAnchor}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
  beforeEach(() =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: 'UNKNOWN_TYPE' }), { status: 404 }))),
    ),
  );
  afterEach(() => vi.unstubAllGlobals());

  it('opens the address of the message`s own source part, as its card does', async () => {
    render(answer([{ type: 'source-url', sourceId: VENDOR_URI, url: VENDOR_URL, title: 'Atera' }]));
    expect(await screen.findByRole('link', { name: 'Atera' })).toHaveAttribute('href', VENDOR_URL);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Atera' })).toHaveAttribute('href', VENDOR_URL);
  });

  it('with no such source, or one with no page, it stays a chip with no link', async () => {
    const { unmount } = render(answer([]));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByTestId('inline-chip')).toHaveTextContent('Atera');
    expect(screen.queryByRole('link', { name: 'Atera' })).toBeNull();
    unmount();
    render(answer([{ type: 'source-document', sourceId: VENDOR_URI, mediaType: 'text/plain', title: 'Atera' }]));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('link', { name: 'Atera' })).toBeNull();
  });
});

describe('ChatMessageEnhanced: a card whose row cannot load', () => {
  const VENDOR_URI = 'record://vendor/299';
  const VENDOR_URL = 'https://www.openmsp.ai/vendors/atera';
  const runtime = {
    endpoints: { chatStreamUrl: '/chat', buildListUrl: (type: string, ids: string[]) => `/api/${type}?ids=${ids}` },
    navigation: { mode: 'host', navigate: vi.fn().mockReturnValue(true) },
    source: 'product-hub',
    composeContentUrl: ({ externalUrl }: { externalUrl?: string | null }) => ({ href: externalUrl ?? null }),
  } as unknown as ChatRuntime;
  // The default retries, as a host has them: a 404 asked again would show as more requests.
  const answer = (parts: ChatPart[]) => (
    <QueryClientProvider client={new QueryClient()}>
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced
          role="assistant"
          parts={[...parts, { type: 'data-record-cards', data: { records: [VENDOR_URI] } }]}
          renderEntityCard={ref => <ChatCardLoader chatRef={ref} />}
          NavLinkAnchor={NavLinkAnchor}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
  const answersRow = (status: number) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ code: 'UNKNOWN_TYPE' }), { status }))),
    );
  afterEach(() => vi.unstubAllGlobals());

  it('a 404 is asked once, and the message`s own source part makes it the record`s link, never a failure', async () => {
    answersRow(404);
    render(answer([{ type: 'source-url', sourceId: VENDOR_URI, url: VENDOR_URL, title: 'Atera' }]));
    expect(await screen.findByRole('link', { name: 'Atera' })).toHaveAttribute('href', VENDOR_URL);
    expect(screen.queryByText('FAILED')).toBeNull();
    expect(screen.queryByText(/Failed to load/)).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 1200));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a row that failed is a failure, whatever the message knows: nothing says it works', async () => {
    answersRow(500);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ChatRuntimeContext.Provider value={runtime}>
          <ChatMessageEnhanced
            role="assistant"
            parts={[
              { type: 'source-url', sourceId: VENDOR_URI, url: VENDOR_URL, title: 'Atera' },
              { type: 'data-record-cards', data: { records: [VENDOR_URI] } },
            ]}
            renderEntityCard={ref => <ChatCardLoader chatRef={ref} />}
            NavLinkAnchor={NavLinkAnchor}
          />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Failed to load/)).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Atera' })).toBeNull();
  });

  it('a record gone from this host (a 200 with no row) says Not found, whatever the message knows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))),
    );
    render(answer([{ type: 'source-url', sourceId: VENDOR_URI, url: VENDOR_URL, title: 'Atera' }]));
    expect(await screen.findByText(/Not found/)).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Atera' })).toBeNull();
  });

  it('a source with no title of its own: the link says what the record is, never its bare id', async () => {
    answersRow(404);
    render(answer([{ type: 'source-url', sourceId: VENDOR_URI, url: VENDOR_URL }]));
    expect(await screen.findByRole('link', { name: 'Vendor 299' })).toHaveAttribute('href', VENDOR_URL);
    expect(screen.queryByText('FAILED')).toBeNull();
  });

  it('a source with no page names the record, with nothing to open', async () => {
    answersRow(404);
    render(answer([{ type: 'source-document', sourceId: VENDOR_URI, mediaType: 'text/plain', title: 'Atera' }]));
    await waitFor(() => expect(screen.getByTestId('inline-chip')).toHaveTextContent('Atera'));
    expect(screen.queryByRole('link', { name: 'Atera' })).toBeNull();
    expect(screen.queryByText('FAILED')).toBeNull();
  });

  it('with no source part and no row it says Not found, asked once', async () => {
    answersRow(404);
    render(answer([]));
    expect(await screen.findByText(/Not found/)).toBeTruthy();
    expect(screen.queryByTestId('inline-chip')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ChatMessageEnhanced — a chip shows its whole name', () => {
  it('draws a long name whole, in a box that wraps with its line', () => {
    const name = 'Install the OpenFrame Agent on macOS with Homebrew and confirm it reports in';
    show(`Read [${name}](record://onboarding_guide/mac-guide) first.`);
    const chip = screen.getByTestId('inline-chip');
    expect(chip.textContent).toBe(name);
    expect(chip.className).not.toMatch(/max-w-|truncate/);
    expect(chip.className).toContain('[box-decoration-break:clone]');
  });
});

describe('ChatMessageEnhanced — citations', () => {
  const source = {
    type: 'source-url' as const,
    sourceId: 'record://blog_post/1108',
    url: 'https://www.flamingo.run/blog/a',
    title: 'Pricing post',
  };
  const citedText = (): ChatPart => ({
    type: 'text',
    text: 'Priced per device. Second sentence.',
    citations: [
      {
        source: { type: 'source', sourceType: 'url', id: source.sourceId, url: source.url, title: source.title },
        endIndex: 18,
      },
    ],
  });
  const runtime = {
    endpoints: { chatStreamUrl: '/chat' },
    navigation: { mode: 'host', navigate: vi.fn().mockReturnValue(true) },
    source: 'flamingo',
  } as unknown as ChatRuntime;

  it('draws the chip where the citation ends, opening its source, and no number in the stored text', () => {
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="assistant" parts={[source, citedText()]} NavLinkAnchor={NavLinkAnchor} />
      </ChatRuntimeContext.Provider>,
    );
    const chip = screen.getByRole('link', { name: '[1]' });
    expect(chip.getAttribute('href')).toBe(source.url);
    expect(chip.getAttribute('title')).toBe('Pricing post');
    expect(chip.parentElement?.textContent).toBe('Priced per device. [1] Second sentence.');
  });

  it('an old row opening with its `[N]` keeps the block that follows it, with the chip before it', () => {
    const message = messageOfStoredRow({
      seq: 1,
      role: 'assistant',
      content: '[1]\n\n# Heading\n\nBody',
      sources: [{ index: 1, name: 'A', documentType: 'blog_post', id: '1', externalUrl: 'https://x.test/a' }],
    });
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="assistant" parts={message?.parts ?? []} NavLinkAnchor={NavLinkAnchor} />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '[1]' })).toBeTruthy();
  });

  it.each([
    ['a thematic break', 'a\n\n***\n\nb', 8],
    ['a raw HTML block', '<div>block</div>\n\nb', 16],
  ])('draws a chip after %s as a chip, and leaves the block a block', (_name, text, endIndex) => {
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced
          role="assistant"
          parts={[
            source,
            {
              type: 'text',
              text,
              citations: [
                {
                  source: { type: 'source', sourceType: 'url', id: source.sourceId, url: source.url },
                  endIndex,
                },
              ],
            },
          ]}
          NavLinkAnchor={NavLinkAnchor}
        />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.getByRole('link', { name: '[1]' })).toBeTruthy();
    expect(screen.queryByText(/citation-1/)).toBeNull();
    expect(screen.queryByText(/\*\*\*/)).toBeNull();
  });

  it('draws the same chip while the message is still streaming', () => {
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="assistant" parts={[source, citedText()]} NavLinkAnchor={NavLinkAnchor} isTyping />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.getByRole('link', { name: '[1]' }).getAttribute('href')).toBe(source.url);
  });

  it('draws a plain number outside a chat runtime: nothing to route it through', () => {
    render(<ChatMessageEnhanced role="assistant" parts={[source, citedText()]} NavLinkAnchor={NavLinkAnchor} />);
    expect(screen.queryByRole('link', { name: '[1]' })).toBeNull();
    expect(screen.getByText('[1]').tagName).toBe('SPAN');
  });

  it('draws a plain number for a source with no url', () => {
    const collection = {
      type: 'source-document' as const,
      sourceId: 'record://blog_post',
      mediaType: 'text/plain',
      title: 'Blog posts',
    };
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced
          role="assistant"
          parts={[
            collection,
            {
              type: 'text',
              text: 'All of them.',
              citations: [
                {
                  source: {
                    type: 'source',
                    sourceType: 'document',
                    id: collection.sourceId,
                    mediaType: collection.mediaType,
                    title: collection.title,
                  },
                  endIndex: 12,
                },
              ],
            },
          ]}
          NavLinkAnchor={NavLinkAnchor}
        />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.queryByRole('link', { name: '[1]' })).toBeNull();
    expect(screen.getByText('[1]')).toBeTruthy();
  });

  it('draws no source part in the body', () => {
    render(<ChatMessageEnhanced role="assistant" parts={[source]} NavLinkAnchor={NavLinkAnchor} />);
    expect(screen.queryByText('Pricing post')).toBeNull();
  });
});

describe('ChatMessageEnhanced — what a user attached', () => {
  const runtime = {
    endpoints: { chatStreamUrl: '/chat', attachmentViewUrlPrefix: '/content/api/storage/view/chat-attachments/' },
    navigation: { mode: 'host', navigate: vi.fn() },
    source: 'flamingo',
  } as unknown as ChatRuntime;
  const file = {
    type: 'file' as const,
    mediaType: 'image/png',
    filename: 'a.png',
    url: 'https://www.flamingo.run/api/storage/view/chat-attachments/chat/u/a.png?t=tok',
  };

  it('draws an image in the bubble of the text beside it, through the host prefix', () => {
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="user" parts={[{ type: 'text', text: 'Look' }, file]} NavLinkAnchor={NavLinkAnchor} />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.getByRole('img', { name: 'a.png' }).getAttribute('src')).toBe(
      '/content/api/storage/view/chat-attachments/chat/u/a.png?t=tok',
    );
    expect(screen.getByText('Look')).toBeTruthy();
  });

  it('draws a bubble for attachments alone', () => {
    render(
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatMessageEnhanced role="user" parts={[file, { ...file, filename: 'b.png' }]} NavLinkAnchor={NavLinkAnchor} />
      </ChatRuntimeContext.Provider>,
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});

describe('ChatMessageEnhanced — tool and approval parts', () => {
  const pendingPart = (
    id: string,
    batchId?: string,
    approvalType?: string,
  ): Extract<ChatPart, { type: 'dynamic-tool' }> => ({
    type: 'dynamic-tool',
    toolName: 'update_ticket',
    toolCallId: id,
    title: `Close ${id}`,
    state: 'approval-requested',
    input: {},
    approval: {
      id,
      requestReason: `Closing ${id}`,
      ...(batchId || approvalType
        ? { descriptor: { ...(batchId ? { batchId } : {}), ...(approvalType ? { approvalType } : {}) } }
        : {}),
    },
  });

  it('draws a run with one batchId as one card, and its buttons act on the batch', () => {
    const approve = vi.fn();
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[pendingPart('p1', 'batch:p1'), { type: 'text', text: 'between' }, pendingPart('p2', 'batch:p1')]}
        actions={{ approve }}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    expect(screen.getByText('Close p1')).toBeTruthy();
    expect(screen.getByText('Close p2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(approve).toHaveBeenCalledWith('batch:p1');
  });

  it('keeps a batch of one failed row one answered card', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            ...pendingPart('p1', 'batch:p1'),
            state: 'output-available',
            output: { ok: true },
            approval: { id: 'p1', approved: true, descriptor: { batchId: 'batch:p1' } },
          },
          {
            ...pendingPart('p2', 'batch:p1'),
            state: 'output-error',
            errorText: 'This approval expired.',
            approval: { id: 'p2', approved: true, descriptor: { batchId: 'batch:p1' } },
          },
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText('Approved')).toBeTruthy();
    // The row that ran has its check, the one refused its cross: the foot speaks for what ran.
    expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
  });

  it('a batch with every row refused says Failed, never Approved, and each row keeps its cross', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={(['p1', 'p2'] as const).map(id => ({
          ...pendingPart(id, 'batch:p1'),
          state: 'output-error' as const,
          errorText: 'This approval expired.',
          approval: { id, approved: true, descriptor: { batchId: 'batch:p1' } },
          toolMetadata: { resolvedByName: 'Roman' },
        }))}
      />,
    );
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.queryByText('by Roman')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(2);
  });

  describe('an approved card nobody knows the end of', () => {
    const notice = 'The answer stopped before saying how this ended.';
    /** Each row holds it too, collapsed: the foot's is the one a reader sees with no row opened. */
    const onTheFoot = () => screen.getAllByText(notice).filter(element => element.tagName === 'P');
    const unknownPart = (id: string, batchId?: string) => ({
      ...pendingPart(id, batchId),
      state: 'output-error' as const,
      errorText: notice,
      approval: { id, approved: true as const, ...(batchId ? { descriptor: { batchId } } : {}) },
      toolMetadata: { resolvedByName: 'Roman', outcomeUnknown: true },
    });

    it('a card of one says so, names no failure and no resolver, and shows why', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[unknownPart('p1')]} />);
      expect(screen.getByText('Outcome unknown')).toBeTruthy();
      expect(screen.queryByText('Failed')).toBeNull();
      expect(screen.queryByText(/Approved/)).toBeNull();
      expect(screen.queryByText(/Roman/)).toBeNull();
      expect(screen.getByText(notice)).toBeTruthy();
    });

    it('a batch says so on its foot with no row opened, and no row has a cross or a check', () => {
      render(
        <ChatMessageEnhanced role="assistant" parts={[unknownPart('p1', 'batch:p1'), unknownPart('p2', 'batch:p1')]} />,
      );
      expect(screen.getByText('Outcome unknown')).toBeTruthy();
      expect(onTheFoot()).toHaveLength(1);
      expect(screen.queryByText('Failed')).toBeNull();
      expect(screen.queryByText(/by Roman/)).toBeNull();
      expect(screen.queryByRole('img', { name: 'Failed' })).toBeNull();
      expect(screen.queryByRole('img', { name: 'Done' })).toBeNull();
    });

    it('for the end client too', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          assistantType="fae"
          approvalVariant="client"
          parts={[unknownPart('p1', 'batch:p1'), unknownPart('p2', 'batch:p1')]}
        />,
      );
      expect(screen.getByText('Outcome unknown')).toBeTruthy();
      expect(screen.getByText(notice)).toBeTruthy();
      expect(screen.queryByText('Failed')).toBeNull();
    });

    it('a batch that also ran says Approved, and the row it could not vouch for has no cross', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          parts={[
            {
              ...pendingPart('p1', 'batch:p1'),
              state: 'output-available',
              output: { ok: true },
              approval: { id: 'p1', approved: true, descriptor: { batchId: 'batch:p1' } },
            },
            unknownPart('p2', 'batch:p1'),
          ]}
        />,
      );
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(onTheFoot()).toHaveLength(1);
      expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
      expect(screen.queryByRole('img', { name: 'Failed' })).toBeNull();
    });
  });

  describe('what the foot says, from the click to the server`s word', () => {
    const REASON = 'This approval expired: approval cards are valid for 15 minutes. Ask me again to get fresh cards.';
    const sent = { answerSent: true };
    const batchGate = (id: string) => ({ id, descriptor: { batchId: 'batch:p1' } });
    const inFlight = (id: string, batchId?: string) => ({
      ...pendingPart(id, batchId),
      state: 'approval-responded' as const,
      approval: { ...(batchId ? batchGate(id) : { id }), approved: true as const },
      toolMetadata: sent,
    });
    const ran = (id: string, batchId?: string) => ({
      ...pendingPart(id, batchId),
      state: 'output-available' as const,
      output: { ok: true },
      approval: { ...(batchId ? batchGate(id) : { id }), approved: true as const },
      toolMetadata: sent,
    });
    const refused = (id: string, batchId?: string) => ({
      ...pendingPart(id, batchId),
      state: 'output-error' as const,
      errorText: REASON,
      approval: { ...(batchId ? batchGate(id) : { id }), approved: true as const },
      toolMetadata: sent,
    });
    /** Each row holds the reason too, collapsed: the foot's is the one a reader sees with no row opened. */
    const reasonOnTheFoot = () => screen.getAllByText(REASON).filter(element => element.tagName === 'P');
    /** The foot's check draws only with the word Approved, which each case rules out; a row's has its own name. */
    const noRowCheck = () => expect(screen.queryByRole('img', { name: 'Done' })).toBeNull();
    const buttonsStayInert = () => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    };

    it('a card approved here says Approving, no Approved and no check, with its buttons inert', () => {
      const answer = { approve: vi.fn(), reject: vi.fn() };
      render(<ChatMessageEnhanced role="assistant" parts={[inFlight('p1')]} actions={answer} />);
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.queryByText(/Approved/)).toBeNull();
      expect(screen.queryByText('Waiting for you')).toBeNull();
      noRowCheck();
      buttonsStayInert();
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(answer.approve).not.toHaveBeenCalled();
    });

    it('for the end client too', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          assistantType="fae"
          approvalVariant="client"
          parts={[inFlight('p1')]}
          actions={{ approve: vi.fn(), reject: vi.fn() }}
        />,
      );
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.queryByText(/Approved/)).toBeNull();
      noRowCheck();
      buttonsStayInert();
    });

    it('names nobody yet', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          parts={[
            inFlight('p1', 'batch:p1'),
            { ...inFlight('p2', 'batch:p1'), toolMetadata: { ...sent, resolvedByName: 'Roman' } },
          ]}
        />,
      );
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.queryByText(/Roman/)).toBeNull();
    });

    it('answered by a refusal: Failed, the whole sentence in the card`s type, no box, and the buttons go', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[refused('p1')]} />);
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.queryByText(/Approv/)).toBeNull();
      noRowCheck();
      const reason = screen.getByText(REASON);
      expect(reason.tagName).toBe('P');
      expect(reason.className).toContain('text-h6');
      expect(reason.className).not.toContain('truncate');
      expect(reason.className).not.toContain('text-h5');
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('answered and it ran: Approved with its check, and the buttons go', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[ran('p1')]} />);
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('a batch nothing has run on: Approving, every row waiting, no check', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[inFlight('p1', 'batch:p1'), inFlight('p2', 'batch:p1')]} />);
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.queryByText(/Approved/)).toBeNull();
      noRowCheck();
      buttonsStayInert();
    });

    it('a batch whose first row was refused: still Approving, the cross and the reason beside it', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[refused('p1', 'batch:p1'), inFlight('p2', 'batch:p1')]} />);
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.queryByText(/Approved/)).toBeNull();
      expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
      expect(reasonOnTheFoot()).toHaveLength(1);
      noRowCheck();
      buttonsStayInert();
    });

    it('a batch with a row that ran and one still waiting: Approved, its check, and the buttons inert until the last', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[ran('p1', 'batch:p1'), inFlight('p2', 'batch:p1')]} />);
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
      buttonsStayInert();
    });

    it('a mixed batch: Approved, its check and its cross, the reason with no row opened', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[ran('p1', 'batch:p1'), refused('p2', 'batch:p1')]} />);
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
      expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
      expect(reasonOnTheFoot()).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('a batch all refused: Failed, every cross, the reason once with no row opened', () => {
      render(<ChatMessageEnhanced role="assistant" parts={[refused('p1', 'batch:p1'), refused('p2', 'batch:p1')]} />);
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.queryByText(/Approv/)).toBeNull();
      expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(2);
      expect(reasonOnTheFoot()).toHaveLength(1);
      noRowCheck();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('for the end client: the reason on the card too', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          assistantType="fae"
          approvalVariant="client"
          parts={[refused('p1', 'batch:p1'), refused('p2', 'batch:p1')]}
        />,
      );
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.getByText(REASON).tagName).toBe('P');
    });

    it('a tool`s own failure stays in its row: its raw output is not the foot`s to say', () => {
      const raw = 'Traceback (most recent call last): rm -rf /tmp/x';
      render(
        <ChatMessageEnhanced
          role="assistant"
          assistantType="fae"
          approvalVariant="client"
          parts={[{ ...refused('p1', 'batch:p1'), errorText: raw, toolMetadata: { integratedToolType: 'SHELL' } }]}
        />,
      );
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.queryByText(raw)).toBeNull();
    });

    it('a batch with nothing to answer through keeps its buttons inert, as a card of one does', () => {
      const parts = [pendingPart('p1', 'batch:p1'), pendingPart('p2', 'batch:p1')];
      const { rerender } = render(<ChatMessageEnhanced role="assistant" parts={parts} actions={{}} />);
      buttonsStayInert();
      rerender(<ChatMessageEnhanced role="assistant" parts={parts} actions={{ approve: vi.fn(), reject: vi.fn() }} />);
      expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
    });

    it('a rejection reads Rejected at once, its buttons inert until the server has answered', () => {
      const rejecting = { ...inFlight('p1'), approval: { id: 'p1', approved: false as const } };
      const { rerender } = render(
        <ChatMessageEnhanced role="assistant" parts={[rejecting]} actions={{ approve: vi.fn(), reject: vi.fn() }} />,
      );
      expect(screen.getByText('Rejected')).toBeTruthy();
      buttonsStayInert();
      rerender(
        <ChatMessageEnhanced
          role="assistant"
          parts={[{ ...rejecting, state: 'output-denied', approval: { id: 'p1', approved: false } }]}
        />,
      );
      expect(screen.getByText('Rejected')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    describe('a screen reader', () => {
      const footOf = () => screen.getByRole('status');

      it.each(['admin', 'client'] as const)(
        'hears a card of one change, %s: one region, there from the first render',
        variant => {
          const { rerender } = render(
            <ChatMessageEnhanced role="assistant" parts={[pendingPart('p1')]} approvalVariant={variant} />,
          );
          const foot = footOf();
          expect(foot).toHaveAttribute('aria-atomic', 'true');
          expect(foot).toHaveTextContent('Waiting for you');

          rerender(<ChatMessageEnhanced role="assistant" parts={[inFlight('p1')]} approvalVariant={variant} />);
          expect(footOf()).toBe(foot);
          expect(foot).toHaveTextContent('Approving');

          rerender(<ChatMessageEnhanced role="assistant" parts={[refused('p1')]} approvalVariant={variant} />);
          expect(footOf()).toBe(foot);
          expect(foot.textContent).toBe(`Failed${REASON}`);
        },
      );

      it.each(['admin', 'client'] as const)(
        'hears a batch change, %s: its status and its reason, together',
        variant => {
          const { rerender } = render(
            <ChatMessageEnhanced
              role="assistant"
              parts={[pendingPart('p1', 'batch:p1'), pendingPart('p2', 'batch:p1')]}
              approvalVariant={variant}
            />,
          );
          const foot = footOf();
          expect(foot).toHaveTextContent('Waiting for you');

          rerender(
            <ChatMessageEnhanced
              role="assistant"
              parts={[inFlight('p1', 'batch:p1'), inFlight('p2', 'batch:p1')]}
              approvalVariant={variant}
            />,
          );
          expect(footOf()).toBe(foot);
          expect(foot).toHaveTextContent('Approving');

          rerender(
            <ChatMessageEnhanced
              role="assistant"
              parts={[refused('p1', 'batch:p1'), refused('p2', 'batch:p1')]}
              approvalVariant={variant}
            />,
          );
          expect(footOf()).toBe(foot);
          expect(foot.textContent).toBe(`Failed${REASON}`);
        },
      );
    });

    describe('a batch nobody knows the end of, with a row refused beside it', () => {
      const UNKNOWN = 'The answer stopped before saying how this ended, so it may or may not have gone through.';
      const unknownRow = (id: string) => ({
        ...pendingPart(id, 'batch:p1'),
        state: 'output-error' as const,
        errorText: UNKNOWN,
        approval: { ...batchGate(id), approved: true as const },
        toolMetadata: { ...sent, outcomeUnknown: true },
      });

      it('the refused row keeps its cross, and the one nobody knows has none', () => {
        render(<ChatMessageEnhanced role="assistant" parts={[refused('p1', 'batch:p1'), unknownRow('p2')]} />);
        expect(screen.getByText('Outcome unknown')).toBeTruthy();
        expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
        expect(screen.queryByRole('img', { name: 'Done' })).toBeNull();
      });

      it('two sentences on the foot each name their rows', () => {
        const titled = (part: ChatPart, title: string) => ({ ...part, title }) as ChatPart;
        render(
          <ChatMessageEnhanced
            role="assistant"
            parts={[
              titled(refused('p1', 'batch:p1'), 'Delete task A'),
              titled(refused('p3', 'batch:p1'), 'Delete task C'),
              titled(unknownRow('p2'), 'Delete task B'),
            ]}
          />,
        );
        expect(screen.getByRole('status').textContent).toBe(
          `Outcome unknownDelete task A, Delete task C: ${REASON}Delete task B: ${UNKNOWN}`,
        );
      });

      it('one sentence says it plainly, however many rows it is about', () => {
        render(<ChatMessageEnhanced role="assistant" parts={[refused('p1', 'batch:p1'), refused('p2', 'batch:p1')]} />);
        expect(reasonOnTheFoot()).toHaveLength(1);
        expect(reasonOnTheFoot()[0].textContent).toBe(REASON);
      });
    });

    it('a click keeps the foot`s two rows: a line, and the same two buttons', () => {
      const { rerender } = render(<ChatMessageEnhanced role="assistant" parts={[pendingPart('p1')]} />);
      const approve = screen.getByRole('button', { name: 'Approve' });
      expect(screen.getByText('Waiting for you')).toBeTruthy();
      rerender(<ChatMessageEnhanced role="assistant" parts={[inFlight('p1')]} />);
      expect(screen.getByText('Approving')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Approve' })).toBe(approve);
    });

    it('a Mingo row its server granted reads Approved with no buttons, read back or live: nothing is on its way', () => {
      const row = {
        id: 'a1',
        createdAt: '2026-11-02T10:00:00Z',
        owner: { type: 'ASSISTANT' },
        messageData: [
          {
            type: 'APPROVAL_REQUEST',
            approvalRequestId: 'req1',
            approvalType: 'ADMIN',
            toolCalls: [{ toolExecutionRequestId: 't1', toolName: 'run', toolTitle: 'Run ls', requiresApproval: true }],
          },
          { type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: true },
        ],
      } as HistoricalMessage;
      const [message] = processHistoricalMessages([row]).messages;
      render(<ChatMessageEnhanced role="assistant" parts={message.parts} />);
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.queryByText('Approving')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });
  });

  describe('the notice of a cut stream, beside an approval', () => {
    const NOTICE = /The answer was interrupted before it finished/;
    const unknown = {
      ...pendingPart('p1'),
      state: 'output-error' as const,
      errorText: 'The answer stopped before saying how this ended. Check before trying again.',
      approval: { id: 'p1', approved: true as const },
      toolMetadata: { answerSent: true, outcomeUnknown: true },
    };
    const inBatch = (id: string) => ({
      ...unknown,
      ...pendingPart(id, 'batch:p1'),
      state: 'output-error' as const,
      errorText: unknown.errorText,
      approval: { id, approved: true as const, descriptor: { batchId: 'batch:p1' } },
      toolMetadata: unknown.toolMetadata,
    });

    it('is not drawn under an approval nobody knows the end of: Outcome unknown is the one thing said', () => {
      render(<ChatMessageEnhanced role="assistant" interrupted parts={[unknown]} />);
      expect(screen.getByText('Outcome unknown')).toBeTruthy();
      expect(screen.getByText(unknown.errorText)).toBeTruthy();
      expect(screen.queryByText(NOTICE)).toBeNull();
    });

    it('nor under a batch with such a row, beside one that ran', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          interrupted
          parts={[
            {
              ...pendingPart('p2', 'batch:p1'),
              state: 'output-available',
              output: 1,
              approval: { id: 'p2', approved: true, descriptor: { batchId: 'batch:p1' } },
            },
            inBatch('p1'),
          ]}
        />,
      );
      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.queryByText(NOTICE)).toBeNull();
    });

    it('is drawn under a cut with no approval in it', () => {
      render(<ChatMessageEnhanced role="assistant" interrupted parts={[{ type: 'text', text: 'Half an answer' }]} />);
      expect(screen.getByText(NOTICE)).toBeTruthy();
    });

    it('under an approval that ran it says what was cut, and never to ask again: the request would run twice', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          interrupted
          parts={[
            {
              ...pendingPart('p1'),
              state: 'output-available',
              output: 1,
              approval: { id: 'p1', approved: true },
            },
            { type: 'text', text: 'Half a follow up' },
          ]}
        />,
      );
      expect(screen.queryByText(NOTICE)).toBeNull();
      expect(
        screen.getByText(
          'The answer was interrupted after this ran, so what follows may be incomplete. Ask about what is left rather than repeating the request.',
        ),
      ).toBeTruthy();
    });

    it('the same under a batch whose rows all ran', () => {
      const ranRow = (id: string) => ({
        ...pendingPart(id, 'batch:p1'),
        state: 'output-available' as const,
        output: 1,
        approval: { id, approved: true as const, descriptor: { batchId: 'batch:p1' } },
      });
      render(<ChatMessageEnhanced role="assistant" interrupted parts={[ranRow('p1'), ranRow('p2')]} />);
      expect(screen.queryByText(NOTICE)).toBeNull();
      expect(screen.getByText(/interrupted after this ran/)).toBeTruthy();
    });

    describe('a notice the server wrote into the answer', () => {
      const ran = {
        ...pendingPart('p1'),
        state: 'output-available' as const,
        output: 1,
        approval: { id: 'p1', approved: true as const },
      };
      const notices = (...sentences: string[]) => sentences.map(sentence => screen.queryAllByText(sentence).length);

      it('an older hub`s, under a card that ran, reads as the one that does not invite a second run', () => {
        render(
          <ChatMessageEnhanced
            role="assistant"
            interrupted
            parts={[ran, { type: 'text', text: `Was the agent off\n\n_${CHAT_INTERRUPTED_NOTICE}_` }]}
          />,
        );
        expect(notices(CHAT_INTERRUPTED_NOTICE, CHAT_INTERRUPTED_AFTER_RUN_NOTICE)).toEqual([0, 1]);
        expect(screen.getByText(/Was the agent off/)).toBeTruthy();
      });

      it('under no card that ran, it stays: asking again repeats nothing', () => {
        render(
          <ChatMessageEnhanced
            role="assistant"
            interrupted
            parts={[{ type: 'text', text: `Half an answer\n\n_${CHAT_INTERRUPTED_NOTICE}_` }]}
          />,
        );
        expect(notices(CHAT_INTERRUPTED_NOTICE, CHAT_INTERRUPTED_AFTER_RUN_NOTICE)).toEqual([1, 0]);
      });

      it.each([CHAT_INTERRUPTED_AFTER_RUN_NOTICE, CHAT_TIMED_OUT_AFTER_RUN_NOTICE])(
        'this hub`s own, under a card that ran, draws no second one: %s',
        sentence => {
          render(
            <ChatMessageEnhanced
              role="assistant"
              interrupted
              parts={[ran, { type: 'text', text: `Was the agent off\n\n_${sentence}_` }]}
            />,
          );
          expect(notices(sentence)).toEqual([1]);
          expect(screen.queryByText(NOTICE)).toBeNull();
          expect(screen.getAllByText(/after this ran/)).toHaveLength(1);
        },
      );

      it('neither one asks for the request again', () => {
        for (const sentence of [CHAT_INTERRUPTED_AFTER_RUN_NOTICE, CHAT_TIMED_OUT_AFTER_RUN_NOTICE]) {
          expect(sentence).not.toMatch(/ask again/i);
          expect(sentence).toMatch(/rather than repeating the request/);
        }
        expect(CHAT_TIMED_OUT_AFTER_RUN_NOTICE).toMatch(/shorter answer/);
      });
    });

    it('under an approval that did not run, asking again repeats nothing', () => {
      render(
        <ChatMessageEnhanced
          role="assistant"
          interrupted
          parts={[{ ...pendingPart('p1'), state: 'output-denied', approval: { id: 'p1', approved: false } }]}
        />,
      );
      expect(screen.getByText(NOTICE)).toBeTruthy();
      expect(screen.queryByText(/interrupted after this ran/)).toBeNull();
    });
  });

  it('a mixed batch: the row with no gate that ran keeps the foot from saying Failed over its check', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            ...pendingPart('p1', 'batch:p1'),
            state: 'output-error',
            errorText: 'boom',
            approval: { id: 'p1', approved: true, descriptor: { batchId: 'batch:p1' } },
          },
          {
            type: 'dynamic-tool',
            toolName: 'read',
            toolCallId: 'free',
            input: {},
            state: 'output-available',
            output: 'ok',
            toolMetadata: { batchId: 'batch:p1' },
          },
        ]}
      />,
    );
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Done' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Failed' })).toHaveLength(1);
  });

  it('a card of one that failed reads the same for the end client, with no name on it', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        assistantType="fae"
        approvalVariant="client"
        parts={[
          {
            ...pendingPart('p1'),
            state: 'output-error',
            errorText: 'It did not run.',
            approval: { id: 'p1', approved: true },
            toolMetadata: { resolvedByName: 'Roman' },
          },
        ]}
      />,
    );
    expect(screen.queryByText(/Approved/)).toBeNull();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('It did not run.')).toBeTruthy();
  });

  it('draws a single approval that failed as its card and the reason', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            ...pendingPart('p1'),
            state: 'output-error',
            errorText: 'This approval expired, ask again to get a fresh one.',
            approval: { id: 'p1', approved: true },
          },
        ]}
      />,
    );
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('This approval expired, ask again to get a fresh one.')).toBeTruthy();
  });

  it('draws tool-input-error as the error row, with no run to put a cross on', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            type: 'dynamic-tool',
            toolName: 'update_ticket',
            toolCallId: 'toolu_1',
            state: 'output-error',
            input: {},
            errorText: 'Could not complete the requested action right now.',
          },
        ]}
      />,
    );
    expect(screen.getByText('Could not complete the requested action right now.')).toBeTruthy();
  });

  it('holds back a pending approval of a tier this side does not answer, until it resolves', () => {
    const { rerender } = render(
      <ChatMessageEnhanced
        role="assistant"
        parts={[pendingPart('p1', undefined, 'ADMIN')]}
        displayApprovalTypes={['CLIENT']}
      />,
    );
    expect(screen.queryByText('Close p1')).toBeNull();
    rerender(
      <ChatMessageEnhanced
        role="assistant"
        parts={[
          {
            ...pendingPart('p1', undefined, 'ADMIN'),
            state: 'approval-responded',
            approval: { id: 'p1', approved: true, descriptor: { approvalType: 'ADMIN' } },
          },
        ]}
        displayApprovalTypes={['CLIENT']}
      />,
    );
    expect(screen.getByText('Close p1')).toBeTruthy();
  });

  it('draws the turn’s stages as rows above its parts, and the notice of a cut stream under its text', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        progress={[{ id: 't:searching', stage: 'searching', count: 3, state: 'done' }]}
        interrupted
        parts={[{ type: 'text', text: 'Half an answer' }]}
      />,
    );
    const stage = screen.getByText('Searching 3 sources');
    const body = screen.getByText('Half an answer');
    expect(stage.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/The answer was interrupted before it finished/)).toBeTruthy();
  });

  it('a stream cut before any text says so too, once: the notice is all that row has', () => {
    const { unmount } = render(<ChatMessageEnhanced role="assistant" interrupted parts={[]} />);
    expect(screen.getByText(/The answer was interrupted before it finished/)).toBeTruthy();
    unmount();

    render(
      <ChatMessageEnhanced
        role="assistant"
        interrupted
        parts={[{ type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/a', title: 'A' }]}
      />,
    );
    expect(screen.getAllByText(/The answer was interrupted before it finished/)).toHaveLength(1);
  });

  it('a server that wrote the notice itself is not repeated', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        interrupted
        parts={[
          {
            type: 'text',
            text: 'The answer was interrupted before it finished, so it may be incomplete. Please ask again.',
          },
        ]}
      />,
    );
    expect(screen.getAllByText(/The answer was interrupted before it finished/)).toHaveLength(1);
  });
});
