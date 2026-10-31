/**
 * The page's topic stamp is ONE host decision (`PageTopicsProvider showTopic`):
 * every surface that can print it does, a nested provider inherits it, and a
 * surface's own `showTopic` prop still wins.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuideWelcome } from '../../components/chat/guide-welcome';
import { FaqSection } from '../../components/faq/faq-section';
import type { Faq } from '../../types/faq';
import { PageTopicsProvider } from '../page-topics-context';

const FAQS: Faq[] = [
  {
    id: 1,
    question: 'Is it free?',
    answer: 'Yes.',
    display_order: 0,
    is_active: true,
    created_at: '2026-10-30T00:00:00Z',
    updated_at: '2026-10-30T00:00:00Z',
  },
];

describe('PageTopicsProvider showTopic', () => {
  it('stamps the FAQ block and the chat when the host turns it on', () => {
    render(
      <PageTopicsProvider pathname="/pricing" showTopic>
        <FaqSection initialFaqs={FAQS} ask={false} />
        <GuideWelcome quickActions={[{ id: 'a', label: 'How much?' }]} />
      </PageTopicsProvider>,
    );
    expect(screen.getAllByText('/pricing')).toHaveLength(2);
  });

  it('stamps nothing when the host leaves it off', () => {
    render(
      <PageTopicsProvider pathname="/pricing">
        <FaqSection initialFaqs={FAQS} ask={false} />
      </PageTopicsProvider>,
    );
    expect(screen.queryByText('/pricing')).toBeNull();
  });

  it('keeps the host choice in a nested provider', () => {
    render(
      <PageTopicsProvider showTopic>
        <PageTopicsProvider pathname="/pricing">
          <FaqSection initialFaqs={FAQS} ask={false} />
        </PageTopicsProvider>
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/pricing')).toBeTruthy();
  });

  it("lets a surface's own prop override the host", () => {
    render(
      <PageTopicsProvider pathname="/pricing" showTopic>
        <FaqSection initialFaqs={FAQS} ask={false} showTopic={false} />
      </PageTopicsProvider>,
    );
    expect(screen.queryByText('/pricing')).toBeNull();
  });
});
