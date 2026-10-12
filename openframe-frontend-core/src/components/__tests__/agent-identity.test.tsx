import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AGENT_IDENTITIES_API_PATH, AgentIdentityProvider } from '../agent-identity';
import { AgentMark } from '../agent-mark';
import { EntityIcon } from '../icon-display';

const FAE_URL = 'https://files.test/fae.webp';

/** What the marks rendered. They are decorative (no accessible role), so the markup is read. */
const markup = (ui: ReactNode): string => {
  render(<div data-testid="marks">{ui}</div>);
  return screen.getByTestId('marks').innerHTML;
};

describe("an agent's mark is its identity's icon", () => {
  it('draws the uploaded picture for AgentMark and for EntityIcon named by the slug', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ fae: { name: null, url: FAE_URL } }}>
        <AgentMark agent="fae" />
        <EntityIcon icon={{ name: 'fae' }} size={24} />
      </AgentIdentityProvider>,
    );
    expect(html.match(/fae\.webp/g)).toHaveLength(2);
    expect(html).not.toContain('data:image');
  });

  it('crops an agent picture to a circle wherever it is drawn: the stored file is a plain square', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ fae: { name: null, url: FAE_URL } }}>
        <AgentMark agent="fae" />
        <EntityIcon icon={{ name: 'fae' }} size={24} />
      </AgentIdentityProvider>,
    );
    const pictures = html.match(/<img[^>]*>/g) ?? [];
    expect(pictures).toHaveLength(2);
    for (const picture of pictures) {
      expect(picture).toContain('rounded-full');
      expect(picture).toContain('object-cover');
    }
  });

  it('leaves any other uploaded icon as it is: only an agent picture is cropped', () => {
    const html = markup(
      <AgentIdentityProvider icons={{}}>
        <EntityIcon icon={{ name: null, url: 'https://files.test/logo.png' }} size={24} />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('logo.png');
    expect(html).not.toContain('rounded-full');
  });

  it('draws no picture of its own: an agent with no identity keeps an empty box of the size it was given', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const html = markup(
      <>
        <AgentMark agent="fae" className="size-6" />
        <AgentMark agent="mingo" className="size-6" />
      </>,
    );
    expect(html).toBe('<span aria-hidden="true" class="size-6"></span><span aria-hidden="true" class="size-6"></span>');
    // With no provider at all the host is told, outside production.
    expect(error).toHaveBeenCalledWith(expect.stringContaining('<AgentIdentityProvider>'));
    error.mockRestore();
  });

  it('draws the glyph an identity names, with the props the identity gives it', async () => {
    const html = markup(
      <AgentIdentityProvider icons={{ mingo: { name: 'mingo', url: null, props: { color: 'red' } } }}>
        <AgentMark agent="mingo" className="size-5" />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('<svg');
    // The glyph's module is loaded when it is drawn.
    await waitFor(() => expect(screen.getByTestId('marks').innerHTML).toContain('fill="red"'));
  });

  it("draws an agent's glyph in one colour wherever it sits, never the tint of its slot", async () => {
    markup(
      <AgentIdentityProvider icons={{ mingo: { name: 'mingo', url: null } }}>
        <span style={{ color: 'green' }}>
          <AgentMark agent="mingo" className="size-5" />
          <EntityIcon icon={{ name: 'mingo' }} size={20} />
        </span>
      </AgentIdentityProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('marks').innerHTML.match(/fill="var\(--color-text-primary\)"/g)?.length,
      ).toBeGreaterThan(1),
    );
    expect(screen.getByTestId('marks').innerHTML).not.toContain('currentColor');
  });

  it('draws the Mingo glyph for the identity that names it', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ mingo: { name: 'mingo', url: null } }}>
        <AgentMark agent="mingo" />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });

  it('lets an icon with its own picture win over the identity', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ fae: { url: FAE_URL } }}>
        <EntityIcon icon={{ name: 'fae', url: 'https://files.test/own.webp' }} />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('own.webp');
    expect(html).not.toContain('fae.webp');
  });
});

describe('with no copy from the host, the identities are read from the server', () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** A page: one react-query client above everything it draws. */
  const page = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks once for every provider on the page, and draws the picture the answer holds', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ slug: 'fae', icon: { name: null, url: FAE_URL, props: null } }] })),
    );
    page(
      <div data-testid="marks">
        <AgentIdentityProvider>
          <AgentMark agent="fae" />
        </AgentIdentityProvider>
        <AgentIdentityProvider>
          <EntityIcon icon={{ name: 'fae' }} size={24} />
        </AgentIdentityProvider>
      </div>,
    );
    await waitFor(() => expect(screen.getByTestId('marks').innerHTML.match(/fae\.webp/g)).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(AGENT_IDENTITIES_API_PATH);
  });

  it("reads from the embedder's own path", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ agents: [] })));
    page(
      <AgentIdentityProvider endpoint="/content/api/ai-agents">
        <AgentMark agent="fae" />
      </AgentIdentityProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/content/api/ai-agents', expect.anything()));
  });

  it('keeps the mark an empty box when the identities cannot be read', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    page(
      <div data-testid="marks">
        <AgentIdentityProvider>
          <AgentMark agent="fae" className="size-6" />
        </AgentIdentityProvider>
      </div>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('marks').innerHTML).toBe('<span aria-hidden="true" class="size-6"></span>');
  });

  it('asks for nothing, and needs no query client, when the host gave its copy', () => {
    render(
      <AgentIdentityProvider icons={{ fae: { url: FAE_URL } }}>
        <AgentMark agent="fae" />
      </AgentIdentityProvider>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks again when the first identity read is refused, so a mark does not stay blank for the page's life", async () => {
    const refusedThenServed = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValue(
        new Response(JSON.stringify({ agents: [{ slug: 'fae', icon: { name: null, url: FAE_URL } }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', refusedThenServed);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AgentIdentityProvider>
          <div data-testid="late">
            <AgentMark agent="fae" />
          </div>
        </AgentIdentityProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('late').innerHTML).toContain('fae.webp'), { timeout: 4000 });
    expect(refusedThenServed.mock.calls.length).toBeGreaterThanOrEqual(2);
    vi.unstubAllGlobals();
  });

  it('draws a glyph mark in the colour its row asks for', async () => {
    const html = markup(
      <AgentIdentityProvider icons={{ mingo: { name: 'chart-pie', url: null } }}>
        <AgentMark agent="mingo" color="currentColor" />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('<svg');
  });
});
