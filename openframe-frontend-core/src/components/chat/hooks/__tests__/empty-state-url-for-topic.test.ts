import { describe, expect, it } from 'vitest';
import { emptyStateUrlForTopic } from '../use-empty-state-config';

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
