import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTopicsProvider, usePageAddress, usePageTopic } from '../page-topics-context';

function Topic() {
  return <p>{usePageTopic() ?? 'none'}</p>;
}

describe('usePageTopic', () => {
  it("reads the router's address (jsdom's `/`)", () => {
    render(
      <PageTopicsProvider>
        <Topic />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('reads the address the provider states for its subtree', () => {
    render(
      <PageTopicsProvider pathname="/pricing/calculator">
        <Topic />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/pricing/calculator')).toBeInTheDocument();
  });

  it("asks without the host's mount, inherited by a nested provider", () => {
    render(
      <PageTopicsProvider basePath="/help-center">
        <PageTopicsProvider pathname="/help-center/legal/privacy">
          <Topic />
        </PageTopicsProvider>
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/legal/privacy')).toBeInTheDocument();
  });

  it('has no topic where the host gave no provider', () => {
    render(<Topic />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});

function Address() {
  return <p>{usePageAddress() ?? 'none'}</p>;
}

describe('usePageAddress', () => {
  it("keeps the host's mount the topic drops", () => {
    render(
      <PageTopicsProvider basePath="/help-center">
        <PageTopicsProvider pathname="/Help-Center/Legal/Privacy/">
          <Address />
        </PageTopicsProvider>
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/help-center/legal/privacy')).toBeInTheDocument();
  });

  it("reads the router's address where the provider states none (jsdom's `/`)", () => {
    render(
      <PageTopicsProvider basePath="/help-center">
        <Address />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('has no address where the host gave no provider', () => {
    render(<Address />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
