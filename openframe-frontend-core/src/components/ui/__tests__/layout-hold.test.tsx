import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LayoutHold, TextHold } from '../layout-hold';

describe('TextHold', () => {
  it('keeps the words in the markup (their width is the hold) and hides them from assistive technology', () => {
    const html = renderToString(<TextHold>Six rules</TextHold>);
    expect(html).toContain('Six rules');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('text-transparent');
  });

  it('draws its bars in the server HTML, one per line, with no script', () => {
    // A server-streamed loading state is often replaced before it hydrates: a bar that waits for an
    // effect to measure its lines is never drawn there (the homepage hero's trust row, 2026-10-14).
    const html = renderToString(<TextHold>Remote all year. Together once a year.</TextHold>);
    expect(html).toContain('animate-pulse rounded-md bg-ods-border');
    expect(html).toContain('box-decoration-clone');
    expect(html).not.toContain('inline-block');
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
