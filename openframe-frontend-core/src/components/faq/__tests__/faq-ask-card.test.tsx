/**
 * The FAQ's "ask the assistant" card, owned by `FaqSection`.
 *
 * Pins what every host depends on: the card appears only where the assistant
 * runtime says a chat is there to open, a host can switch it off, the FAQ's
 * topic reaches the questions endpoint as ANY string (no list of topics lives
 * here), and a click goes to the opener the host or the runtime supplies, so
 * a FAQ beside an embedded chat never opens the site's one.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssistantRuntimeContext, type AssistantRuntime } from '../../../contexts/assistant-runtime-context';
import type { Faq } from '../../../types/faq';
import { ASK_AI_OPEN_EVENT } from '../../navigation/mingo-ai-button';
import { buildAskPromptsUrl } from '../faq-ask-card';
import { FaqSection } from '../faq-section';

const FAQS = [{ id: 1, question: 'What is OpenFrame?', answer: 'A platform.', section: null }] as unknown as Faq[];

const PROMPTS = [
  { id: 'q1', label: 'How does pricing work?', prompt: 'Explain the pricing' },
  { id: 'q2', label: 'Is it open source?' },
];

/** Reports every observed element as on screen at once: the card picks its questions on mount. */
class VisibleObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', VisibleObserver);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ prompts: PROMPTS }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFaq(runtime: AssistantRuntime | null, faq: ReactNode) {
  return render(<AssistantRuntimeContext.Provider value={runtime}>{faq}</AssistantRuntimeContext.Provider>);
}

const RUNTIME: AssistantRuntime = {
  available: true,
  name: 'Mingo',
  source: 'flamingo',
  askPromptsUrl: '/api/quick-actions/questions',
};

const requestedUrl = () => String(fetchMock.mock.calls[0]?.[0]);

describe('FaqSection ask card', () => {
  it('shows the card, with the assistant named, where a chat is available', async () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} />);

    expect(screen.getByText('Still deciding?')).toBeInTheDocument();
    expect(screen.getByText('Mingo answers from our docs and customer stories.')).toBeInTheDocument();
    expect(await screen.findByText('How does pricing work?')).toBeInTheDocument();
  });

  it('shows no card with no runtime, an unavailable chat, or no name', () => {
    for (const runtime of [null, { ...RUNTIME, available: false }, { ...RUNTIME, name: null }]) {
      const { unmount } = renderFaq(runtime, <FaqSection initialFaqs={FAQS} />);
      expect(screen.getByText('What is OpenFrame?')).toBeInTheDocument();
      expect(screen.queryByText('Still deciding?')).not.toBeInTheDocument();
      unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is switched off with ask={false}', () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={false} />);
    expect(screen.queryByText('Still deciding?')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives way to the host's own aside", () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} aside={<p>Host block</p>} />);
    expect(screen.getByText('Host block')).toBeInTheDocument();
    expect(screen.queryByText('Still deciding?')).not.toBeInTheDocument();
  });

  it('sends any topic string as the section, with the count and the exclusions', async () => {
    renderFaq(
      RUNTIME,
      <FaqSection initialFaqs={FAQS} ask={{ topic: 'a topic nobody listed', exclude: ['a', 'b'], count: 2 }} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = new URL(requestedUrl(), 'https://host.test');
    expect(url.pathname).toBe('/api/quick-actions/questions');
    expect(url.searchParams.get('section')).toBe('a topic nobody listed');
    expect(url.searchParams.get('count')).toBe('2');
    expect(url.searchParams.get('exclude')).toBe('a,b');
  });

  it("falls back to the FAQ's entity type as its topic", async () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} entityType="case_study" entityId={7} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(new URL(requestedUrl(), 'https://host.test').searchParams.get('section')).toBe('case_study');
  });

  it('waits while the page is still picking its own questions', () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={{ exclude: null }} />);
    expect(screen.getByText('Still deciding?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the launcher with no questions on a host with no questions endpoint', () => {
    renderFaq({ ...RUNTIME, askPromptsUrl: undefined }, <FaqSection initialFaqs={FAQS} />);
    expect(screen.getByRole('button', { name: 'Mingo' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the runtime's chat, with the prompt and the topic, and reports the ask", async () => {
    const open = vi.fn();
    const onAsk = vi.fn();
    const siteChat = vi.fn();
    window.addEventListener(ASK_AI_OPEN_EVENT, siteChat);
    renderFaq({ ...RUNTIME, open, onAsk }, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />);

    fireEvent.click(await screen.findByText('How does pricing work?'));
    expect(open).toHaveBeenCalledWith({ prompt: 'Explain the pricing', topic: 'faq' });
    expect(onAsk).toHaveBeenCalledWith({ promptId: 'q1', topic: 'faq' });

    fireEvent.click(screen.getByRole('button', { name: 'Mingo' }));
    expect(open).toHaveBeenLastCalledWith({ topic: 'faq' });
    // The runtime's opener replaces the site chat's event: it is never also dispatched.
    expect(siteChat).not.toHaveBeenCalled();
    window.removeEventListener(ASK_AI_OPEN_EVENT, siteChat);
  });

  it("prefers the FAQ's own opener over the runtime's", async () => {
    const runtimeOpen = vi.fn();
    const embeddedOpen = vi.fn();
    renderFaq(
      { ...RUNTIME, open: runtimeOpen },
      <FaqSection initialFaqs={FAQS} ask={{ topic: 'docs', onOpen: embeddedOpen }} />,
    );

    fireEvent.click(await screen.findByText('Is it open source?'));
    expect(embeddedOpen).toHaveBeenCalledWith({ prompt: 'Is it open source?', topic: 'docs' });
    expect(runtimeOpen).not.toHaveBeenCalled();
  });

  it('opens the site chat of the runtime source when no opener is supplied', async () => {
    const siteChat = vi.fn();
    window.addEventListener(ASK_AI_OPEN_EVENT, siteChat);
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} />);

    fireEvent.click(await screen.findByText('How does pricing work?'));
    expect(siteChat).toHaveBeenCalledTimes(1);
    expect((siteChat.mock.calls[0][0] as CustomEvent).detail).toEqual({
      source: 'flamingo',
      prompt: 'Explain the pricing',
    });
    window.removeEventListener(ASK_AI_OPEN_EVENT, siteChat);
  });
});

describe('buildAskPromptsUrl', () => {
  it('leaves out an empty topic and an empty exclusion list, and keeps a base query', () => {
    expect(buildAskPromptsUrl('/q', { count: 3, exclude: [] })).toBe('/q?count=3');
    expect(buildAskPromptsUrl('/q?agent=mingo', { count: 1, topic: 'faq', exclude: ['x'] })).toBe(
      '/q?agent=mingo&count=1&section=faq&exclude=x',
    );
  });
});
