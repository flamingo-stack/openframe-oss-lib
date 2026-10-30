import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PageTopicsProvider } from '../../../../contexts/page-topics-context';
import { emptyStateUrlForTopic, useEmptyStateConfig } from '../use-empty-state-config';

describe('emptyStateUrlForTopic', () => {
  it('leaves the endpoint as given when the page has no topic', () => {
    expect(emptyStateUrlForTopic('/api/docs/empty-state')).toBe('/api/docs/empty-state');
    expect(emptyStateUrlForTopic('/api/docs/empty-state', null)).toBe('/api/docs/empty-state');
    expect(emptyStateUrlForTopic('/api/docs/empty-state', '')).toBe('/api/docs/empty-state');
  });

  it('sends the page topic as a query parameter', () => {
    expect(emptyStateUrlForTopic('/api/docs/empty-state', 'pricing')).toBe('/api/docs/empty-state?topic=pricing');
  });

  it('adds the topic to an endpoint that already has a query', () => {
    expect(emptyStateUrlForTopic('/content/api/ai-agents/fae?x=1', 'home')).toBe(
      '/content/api/ai-agents/fae?x=1&topic=home',
    );
  });

  it('encodes the topic', () => {
    expect(emptyStateUrlForTopic('/e', 'a b&c')).toBe('/e?topic=a+b%26c');
  });
});

describe("useEmptyStateConfig: the page's topic", () => {
  it('reads the empty state for the topic of the page on screen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ quickActions: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient();
    renderHook(() => useEmptyStateConfig('/api/docs/empty-state'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          <PageTopicsProvider topics={{ '/': 'pricing' }}>{children}</PageTopicsProvider>
        </QueryClientProvider>
      ),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('topic')).toBe('pricing');
    vi.unstubAllGlobals();
  });
});
