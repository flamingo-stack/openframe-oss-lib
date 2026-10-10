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
import { AssistantAskPrompts } from '../../chat/assistant-ask-prompts';
import { buildAskPromptsUrl, resetAskSurfaces } from '../../chat/hooks/use-ask-prompts';
import { ASK_AI_OPEN_EVENT, MingoAiButton } from '../../navigation/mingo-ai-button';
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
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ prompts: PROMPTS }) });
  vi.stubGlobal('fetch', fetchMock);
  resetAskSurfaces();
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
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />);

    expect(screen.getByText('Still deciding?')).toBeInTheDocument();
    expect(screen.getByText('Mingo answers from our docs and customer stories.')).toBeInTheDocument();
    expect(await screen.findByText('How does pricing work?')).toBeInTheDocument();
  });

  it('shows no card with no runtime, an unavailable chat, or no name', () => {
    for (const runtime of [null, { ...RUNTIME, available: false }, { ...RUNTIME, name: null }]) {
      const { unmount } = renderFaq(runtime, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />);
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
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} aside={<p>Host block</p>} />);
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

  it('asks for the questions of the entity it is attached to when the host states no topic', async () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} entityType="case_study" entityId={7} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(new URL(requestedUrl(), 'https://host.test').searchParams.get('section')).toBe('case_study');
  });

  it('shows no card with no topic and no entity: the lib names no topic of its own', () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} />);
    expect(screen.getByText('What is OpenFrame?')).toBeInTheDocument();
    expect(screen.queryByText('Still deciding?')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits while the page is still picking its own questions', () => {
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq', exclude: null }} />);
    expect(screen.getByText('Still deciding?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the launcher with no questions on a host with no questions endpoint', () => {
    renderFaq({ ...RUNTIME, askPromptsUrl: undefined }, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />);
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
    renderFaq(RUNTIME, <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />);

    fireEvent.click(await screen.findByText('How does pricing work?'));
    expect(siteChat).toHaveBeenCalledTimes(1);
    expect((siteChat.mock.calls[0][0] as CustomEvent).detail).toEqual({
      source: 'flamingo',
      prompt: 'Explain the pricing',
    });
    window.removeEventListener(ASK_AI_OPEN_EVENT, siteChat);
  });
});

describe('MingoAiButton', () => {
  it('takes its name and its opener from the assistant runtime, with no prop', () => {
    const open = vi.fn();
    const siteChat = vi.fn();
    window.addEventListener(ASK_AI_OPEN_EVENT, siteChat);
    renderFaq({ ...RUNTIME, name: 'Server Name', open }, <MingoAiButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Server Name' }));
    expect(open).toHaveBeenCalledWith({});
    expect(siteChat).not.toHaveBeenCalled();
    window.removeEventListener(ASK_AI_OPEN_EVENT, siteChat);
  });

  it('renders nothing with no name from the host or a runtime', () => {
    const { container } = render(<MingoAiButton source="flamingo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the site event of its source with no runtime', () => {
    const siteChat = vi.fn();
    window.addEventListener(ASK_AI_OPEN_EVENT, siteChat);
    render(<MingoAiButton source="flamingo" label="Mingo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mingo' }));
    expect((siteChat.mock.calls[0][0] as CustomEvent).detail).toEqual({ source: 'flamingo' });
    window.removeEventListener(ASK_AI_OPEN_EVENT, siteChat);
  });
});

describe('AssistantAskPrompts', () => {
  it('shows the launcher and the questions of its topic, and opens the runtime chat', async () => {
    const open = vi.fn();
    const onAsk = vi.fn();
    renderFaq({ ...RUNTIME, open, onAsk }, <AssistantAskPrompts topic="pricing" count={2} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = new URL(requestedUrl(), 'https://host.test');
    expect(url.searchParams.get('section')).toBe('pricing');
    expect(url.searchParams.get('count')).toBe('2');

    fireEvent.click(await screen.findByText('Is it open source?'));
    expect(open).toHaveBeenCalledWith({ prompt: 'Is it open source?', topic: 'pricing' });
    expect(onAsk).toHaveBeenCalledWith({ promptId: 'q2', topic: 'pricing' });
    expect(screen.getByRole('button', { name: 'Mingo' })).toBeInTheDocument();
  });

  it("leaves another assistant's rows out of its exclusions: one list per questions endpoint", async () => {
    render(
      <>
        <AssistantRuntimeContext.Provider value={{ ...RUNTIME, askPromptsUrl: '/other/questions' }}>
          <AssistantAskPrompts topic="pricing" count={1} />
        </AssistantRuntimeContext.Provider>
        <AssistantRuntimeContext.Provider value={RUNTIME}>
          <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />
        </AssistantRuntimeContext.Provider>
      </>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const card = fetchMock.mock.calls
      .map(call => String(call[0]))
      .find(url => url.startsWith('/api/quick-actions/questions'));
    expect(new URL(card ?? '', 'https://host.test').searchParams.get('exclude')).toBeNull();
  });

  it('renders nothing with no chat, and fetches nothing', () => {
    const { container } = renderFaq({ ...RUNTIME, available: false }, <AssistantAskPrompts topic="pricing" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps its questions out of the FAQ's card, which waits for the row's pick", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = new URL(String(input), 'https://host.test');
      const row = url.searchParams.get('section') === 'pricing';
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ prompts: row ? [PROMPTS[0]] : [PROMPTS[1]] }) });
    });
    renderFaq(
      RUNTIME,
      <>
        <AssistantAskPrompts topic="pricing" count={1} />
        <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq' }} />
      </>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const card = fetchMock.mock.calls
      .map(call => new URL(String(call[0]), 'https://host.test'))
      .find(url => url.searchParams.get('section') === 'faq');
    // One request for the card, made after the row's pick: it names the row's question.
    expect(card?.searchParams.get('exclude')).toBe('q1');
  });
});

describe('ask surfaces of one page', () => {
  /** Answers each request with one question its `exclude` does not name, and records the order. */
  function pickingHost() {
    const pool = ['q1', 'q2', 'q3'];
    fetchMock.mockImplementation((input: unknown) => {
      const url = new URL(String(input), 'https://host.test');
      const left = (url.searchParams.get('exclude') ?? '').split(',');
      const id = pool.find(candidate => !left.includes(candidate));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ prompts: id ? [{ id, label: `Question ${id}` }] : [] }),
      });
    });
  }
  const requests = () => fetchMock.mock.calls.map(call => new URL(String(call[0]), 'https://host.test'));

  it('two rows on ONE topic pick one after the other and never show the same question', async () => {
    pickingHost();
    renderFaq(
      RUNTIME,
      <>
        <AssistantAskPrompts topic="pricing" count={1} />
        <AssistantAskPrompts topic="pricing" count={1} />
      </>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requests().map(url => url.searchParams.get('exclude'))).toEqual([null, 'q1']);
    expect(await screen.findByText('Question q1')).toBeInTheDocument();
    expect(await screen.findByText('Question q2')).toBeInTheDocument();
    expect(screen.getAllByText(/^Question /)).toHaveLength(2);
  });

  it('rows on different topics leave out each other too, and the card leaves out both', async () => {
    pickingHost();
    renderFaq(
      RUNTIME,
      <>
        <AssistantAskPrompts topic="agents" count={1} />
        <AssistantAskPrompts topic="pricing" count={1} />
        <FaqSection initialFaqs={FAQS} ask={{ topic: 'faq', count: 1 }} />
      </>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(requests().map(url => [url.searchParams.get('section'), url.searchParams.get('exclude')])).toEqual([
      ['agents', null],
      ['pricing', 'q1'],
      ['faq', 'q1,q2'],
    ]);
  });

  it('a row keeps its questions when a later surface settles: one pick per mount', async () => {
    pickingHost();
    renderFaq(
      RUNTIME,
      <>
        <AssistantAskPrompts topic="pricing" count={1} />
        <AssistantAskPrompts topic="pricing" count={1} />
      </>,
    );
    await screen.findByText('Question q2');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a failed pick does not hold the surfaces after it', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const first = new URL(String(input), 'https://host.test').searchParams.get('section') === 'agents';
      return Promise.resolve(
        first ? { ok: false, status: 500 } : { ok: true, json: () => Promise.resolve({ prompts: [PROMPTS[1]] }) },
      );
    });
    renderFaq(
      RUNTIME,
      <>
        <AssistantAskPrompts topic="agents" count={1} />
        <AssistantAskPrompts topic="pricing" count={1} />
      </>,
    );
    expect(await screen.findByText('Is it open source?')).toBeInTheDocument();
  });

  it('the card is one of the surfaces: `AssistantAskPrompts` as a card', async () => {
    renderFaq(RUNTIME, <AssistantAskPrompts variant="card" topic="docs" count={2} />);
    expect(screen.getByText('Still deciding?')).toBeInTheDocument();
    expect(await screen.findByText('How does pricing work?')).toBeInTheDocument();
    expect(new URL(requestedUrl(), 'https://host.test').searchParams.get('section')).toBe('docs');
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
