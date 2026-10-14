import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LayoutHold, TextHold } from '../layout-hold';

describe('TextHold', () => {
  it('keeps the words in the markup, unseen (their space is the hold), and hides them from assistive technology', () => {
    const html = renderToString(<TextHold>Six rules</TextHold>);
    expect(html).toContain('Six rules');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('invisible');
  });

  it('draws a SkeletonText of as many lines as the words take', () => {
    const lineBoxes = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([new DOMRect(0, 0, 200, 24), new DOMRect(0, 24, 120, 24)] as unknown as DOMRectList);
    const { asFragment } = render(<TextHold>Remote all year. Together once a year.</TextHold>);
    lineBoxes.mockRestore();
    // Each `Skeleton` line of the `SkeletonText` is one `h-4` bar.
    const markup = new XMLSerializer().serializeToString(asFragment());
    expect(markup.match(/animate-pulse rounded-md bg-ods-border h-4/g)).toHaveLength(2);
  });

  it('draws nothing in the blank variant', () => {
    const html = renderToString(<TextHold variant="blank">All 00 stories</TextHold>);
    expect(html).toContain('invisible');
    expect(html).not.toContain('animate-pulse');
  });
});

describe('LayoutHold', () => {
  it('renders the real layout invisible and inert', () => {
    const html = renderToString(
      <LayoutHold>
        <section>content</section>
      </LayoutHold>,
    );
    expect(html).toContain('<section>content</section>');
    expect(html).toContain('invisible');
    expect(html).toContain('inert');
    expect(html).toContain('aria-hidden="true"');
  });
});
