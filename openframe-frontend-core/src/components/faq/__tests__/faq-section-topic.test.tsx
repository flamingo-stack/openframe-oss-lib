/**
 * `FaqSection` as a page's own FAQ block. Pins what every host depends on: the
 * topic is the page's, its path, the
 * block fetches that topic's FAQs or shows the host's own read, it renders
 * nothing when there is no FAQ, it can print its topic for whoever edits the
 * FAQs, it reads the host's FAQ endpoint, and a shared page of the lib renders
 * it only when its host names that endpoint (`EndpointsRuntime.faqsUrl`).
 */

import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EndpointsRuntimeContext, type EndpointsRuntime } from '../../../contexts/endpoints-runtime-context';
import { PageTopicsProvider } from '../../../contexts/page-topics-context';
import type { Faq } from '../../../types/faq';
import { DeliveryPage } from '../../help-center-pages/delivery-page';
import { FaqSection, PAGE_FAQ_SECTION_ID } from '../faq-section';

/** The page under test is `/` (jsdom's address); its topic is the path it is given. */
const onPage = (topic: string, node: React.ReactNode) => (
  <PageTopicsProvider pathname={topic}>{node}</PageTopicsProvider>
);

/** A host that serves its FAQs behind a proxy, as the OpenFrame app does. */
const HOST_ENDPOINTS: EndpointsRuntime = {
  announcementsUrl: '/content/api/announcements/active',
  accessCode: { validateUrl: '/content/api/validate-access-code', consumeUrl: '/content/api/consume-access-code' },
  contactUrl: '/content/api/contact',
  faqsUrl: '/content/api/faqs',
};
const withHost = (node: React.ReactNode) => (
  <EndpointsRuntimeContext.Provider value={HOST_ENDPOINTS}>{node}</EndpointsRuntimeContext.Provider>
);

const FAQS = [{ id: 1, question: 'Do I pay per technician?', answer: 'No.', section: null }] as unknown as Faq[];

const fetchMock = vi.fn();
/** The rendered document as markup: where a section id and a JSON-LD script are read without reaching into nodes. */
const markup = () => document.body.innerHTML;
const FAQ_SECTION = `id="${PAGE_FAQ_SECTION_ID}"`;
const requestedFaqs = () =>
  fetchMock.mock.calls
    .map(call => new URL(String(call[0]), 'https://host.test'))
    .filter(u => u.pathname.endsWith('/api/faqs'));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: unknown) => {
    const url = new URL(String(input), 'https://host.test');
    const faqs = url.pathname.endsWith('/api/faqs') && url.searchParams.get('topic') === '/pricing' ? FAQS : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ faqs, completed: [], inProgress: [] }) });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a page's own FAQ block", () => {
  it("fetches the FAQs of the page's topic, from the host's base", async () => {
    render(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} apiBaseUrl="/content" />));

    expect(await screen.findByText('Do I pay per technician?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
    expect(markup()).toContain(FAQ_SECTION);
    const [request] = requestedFaqs();
    expect(request.pathname).toBe('/content/api/faqs');
    expect(request.searchParams.get('topic')).toBe('/pricing');
  });

  it("reads the host's FAQ endpoint when it states no base of its own", async () => {
    render(withHost(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} />)));
    expect(await screen.findByText('Do I pay per technician?')).toBeInTheDocument();
    expect(requestedFaqs()[0].pathname).toBe('/content/api/faqs');
  });

  it('asks the same-origin /api/faqs with no base and no host endpoint', async () => {
    render(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} />));
    await waitFor(() => expect(requestedFaqs()).toHaveLength(1));
    expect(new URL(String(fetchMock.mock.calls[0][0]), 'https://host.test').pathname).toBe('/api/faqs');
  });

  it("shows the host's own read of the page's topic without fetching it", () => {
    render(
      onPage(
        '/pricing',
        <FaqSection id={PAGE_FAQ_SECTION_ID} initialFaqs={FAQS} heading={<h2>Pricing questions</h2>} />,
      ),
    );
    expect(screen.getByText('Do I pay per technician?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pricing questions' })).toBeInTheDocument();
    expect(requestedFaqs()).toHaveLength(0);
  });

  it('prints its bare topic under the heading only when asked, and always carries it as data', () => {
    const { unmount } = render(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} initialFaqs={FAQS} />));
    expect(screen.queryByText('/pricing')).not.toBeInTheDocument();
    expect(markup()).toContain('data-faq-topic="/pricing"');
    unmount();

    render(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} initialFaqs={FAQS} showTopic />));
    expect(screen.getByText('/pricing')).toBeInTheDocument();
    expect(screen.queryByText(/Topic:/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
  });

  it('emits FAQPage JSON-LD for the page’s own questions', () => {
    render(onPage('/pricing', <FaqSection id={PAGE_FAQ_SECTION_ID} initialFaqs={FAQS} emitJsonLd />));
    const schema = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(markup())?.[1] ?? '{}') as {
      '@type'?: string;
      mainEntity?: unknown[];
    };
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(1);
  });

  it('renders nothing for a topic with no FAQ: no heading, no section, no schema', async () => {
    render(onPage('/careers', <FaqSection id={PAGE_FAQ_SECTION_ID} />));
    await waitFor(() => expect(requestedFaqs()).toHaveLength(1));
    await waitFor(() => expect(markup()).not.toContain('animate-pulse'));
    expect(markup()).not.toContain(FAQ_SECTION);
    expect(screen.queryByRole('heading', { name: 'Frequently Asked Questions' })).not.toBeInTheDocument();
    expect(markup()).not.toContain('application/ld+json');
  });
});

describe('a shared page of the lib', () => {
  it("shows the FAQ block of the page's topic when its host names its FAQ endpoint", async () => {
    render(withHost(onPage('/pricing', <DeliveryPage shell={false} backButton={false} />)));
    expect(await screen.findByText('Do I pay per technician?')).toBeInTheDocument();
    expect(requestedFaqs()[0].searchParams.get('topic')).toBe('/pricing');
  });

  it('shows no FAQ block, and asks for none, when the host names no FAQ endpoint', async () => {
    render(<DeliveryPage shell={false} backButton={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestedFaqs()).toHaveLength(0);
    expect(markup()).not.toContain(FAQ_SECTION);
  });
});
