import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTopicsProvider, usePageTopic } from '../page-topics-context';

function Topic() {
  return <p>{usePageTopic() ?? 'none'}</p>;
}

const TOPICS = { '/': 'home', '/pricing': 'pricing' };

describe('usePageTopic', () => {
  it("reads the router's address (jsdom's `/`)", () => {
    render(
      <PageTopicsProvider topics={TOPICS}>
        <Topic />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('reads the address the provider states for its subtree', () => {
    render(
      <PageTopicsProvider topics={TOPICS} pathname="/pricing/calculator">
        <Topic />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('pricing')).toBeInTheDocument();
  });

  it('has no topic without a map, or on a page no route covers', () => {
    render(<Topic />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
