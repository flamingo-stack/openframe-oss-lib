/**
 * `PageFaq`: a page's own FAQ block. Pins what every host depends on: the
 * topic is the one the page states (a prop, never the page's address), the
 * block fetches that topic's FAQs or shows the host's own read, it renders
 * nothing for a topic with no FAQ, and a shared page of the lib renders it
 * only when its host passes `faq`.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Faq } from '../../../types/faq';
import { DeliveryPage } from '../../help-center-pages/delivery-page';
import { PAGE_FAQ_SECTION_ID, PageFaq } from '../page-faq';

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
    const faqs = url.pathname.endsWith('/api/faqs') && url.searchParams.get('topic') === 'pricing' ? FAQS : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ faqs, completed: [], inProgress: [] }) });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageFaq', () => {
  it("fetches the FAQs of the topic the page states, from the host's base", async () => {
    render(<PageFaq topic="pricing" apiBaseUrl="/content" />);

    expect(await screen.findByText('Do I pay per technician?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
    expect(markup()).toContain(FAQ_SECTION);
    const [request] = requestedFaqs();
    expect(request.pathname).toBe('/content/api/faqs');
    expect(request.searchParams.get('topic')).toBe('pricing');
  });

  it("shows the host's own read of the topic without fetching it", () => {
    render(<PageFaq topic="pricing" initialFaqs={FAQS} title="Pricing questions" />);
    expect(screen.getByText('Do I pay per technician?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pricing questions' })).toBeInTheDocument();
    expect(requestedFaqs()).toHaveLength(0);
  });

  it('prints its bare topic under the heading only when asked, and always carries it as data', () => {
    const { unmount } = render(<PageFaq topic="pricing" initialFaqs={FAQS} />);
    expect(screen.queryByText('pricing')).not.toBeInTheDocument();
    expect(markup()).toContain('data-faq-topic="pricing"');
    unmount();

    render(<PageFaq topic="pricing" initialFaqs={FAQS} showTopic />);
    expect(screen.getByText('pricing')).toBeInTheDocument();
    expect(screen.queryByText(/Topic:/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInTheDocument();
  });

  it('emits FAQPage JSON-LD for the page’s own questions', () => {
    render(<PageFaq topic="pricing" initialFaqs={FAQS} />);
    const schema = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(markup())?.[1] ?? '{}') as {
      '@type'?: string;
      mainEntity?: unknown[];
    };
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(1);
  });

  it('renders nothing for a topic with no FAQ: no heading, no section, no schema', async () => {
    render(<PageFaq topic="careers" />);
    await waitFor(() => expect(requestedFaqs()).toHaveLength(1));
    await waitFor(() => expect(markup()).not.toContain('animate-pulse'));
    expect(markup()).not.toContain(FAQ_SECTION);
    expect(screen.queryByRole('heading', { name: 'Frequently Asked Questions' })).not.toBeInTheDocument();
    expect(markup()).not.toContain('application/ld+json');
  });
});

describe('a shared page of the lib', () => {
  it('shows the FAQ block of the topic its host passes', async () => {
    render(<DeliveryPage shell={false} backButton={false} faq={{ topic: 'pricing', apiBaseUrl: '/content' }} />);
    expect(await screen.findByText('Do I pay per technician?')).toBeInTheDocument();
    expect(requestedFaqs()[0].searchParams.get('topic')).toBe('pricing');
  });

  it('shows no FAQ block, and asks for none, without the prop', async () => {
    render(<DeliveryPage shell={false} backButton={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestedFaqs()).toHaveLength(0);
    expect(markup()).not.toContain(FAQ_SECTION);
  });
});
