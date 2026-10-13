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

  it('draws nothing in the blank variant', () => {
    const html = renderToString(<TextHold variant="blank">All 00 stories</TextHold>);
    expect(html).toContain('invisible');
    expect(html).not.toContain('bg-ods-border');
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
