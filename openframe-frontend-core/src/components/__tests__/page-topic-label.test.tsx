/**
 * The page's stamp prints the page's address, the host's mount kept. Where the
 * mount makes the topic (the hub path the page's quick actions and FAQs are
 * tagged with) differ, the hover names the topic.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageTopicsProvider } from '../../contexts/page-topics-context';
import { PageTopicLabel } from '../page-topic-label';

function stampAt(pathname: string, basePath?: string, printed = pathname.toLowerCase().replace(/\/$/, '')) {
  render(
    <PageTopicsProvider basePath={basePath} pathname={pathname}>
      <PageTopicLabel />
    </PageTopicsProvider>,
  );
  return screen.getByText(printed);
}

describe('PageTopicLabel', () => {
  it("prints the Help Center root's address, and names the hub path to tag on hover", () => {
    const stamp = stampAt('/help-center', '/help-center');
    expect(stamp).toHaveTextContent('/help-center');
    expect(stamp).toHaveAttribute('title', 'Tagged as /');
    expect(stamp).toHaveAttribute('data-page-topic', '/');
    expect(stamp).toHaveAttribute('data-page-address', '/help-center');
  });

  it('prints the full address of a page under the mount', () => {
    const stamp = stampAt('/help-center/faqs', '/help-center');
    expect(stamp).toHaveTextContent('/help-center/faqs');
    expect(stamp).toHaveAttribute('title', 'Tagged as /faqs');
  });

  it('prints the same as before outside the mount', () => {
    const stamp = stampAt('/devices', '/help-center');
    expect(stamp).toHaveTextContent('/devices');
    expect(screen.getByTitle('Page topic')).toBe(stamp);
  });

  it('prints the same as before for a host with no mount (the hub)', () => {
    const stamp = stampAt('/Pricing/');
    expect(stamp).toHaveTextContent('/pricing');
    expect(stamp).toHaveAttribute('title', 'Page topic');
  });

  it('prints nothing where the host gave no provider', () => {
    const { container } = render(<PageTopicLabel />);
    expect(container).toBeEmptyDOMElement();
  });
});
