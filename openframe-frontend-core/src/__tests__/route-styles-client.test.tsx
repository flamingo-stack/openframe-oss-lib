import { render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/missing' }));

const FULL_URL = '/_next/static/next-styles/full-b3.css';
/** The complete sheet's links in the document head, where the component appends them (outside what it renders). */
const fullLinks = () =>
  [...document.head.getElementsByTagName('link')].filter(link => link.hasAttribute('data-next-styles-full'));

/** `RouteStyle` drawn in the browser, as Next draws a page it did not render on the server (a 404's error shell). */
async function renderInBrowser(build = 'b3') {
  vi.resetModules();
  process.env.NEXT_STYLES_FULL_URL = FULL_URL;
  const { RouteStyle } = await import('../../scripts/route-styles-client.mjs');
  return render(createElement(RouteStyle, { build, complete: false }));
}

describe('RouteStyle: a page the server did not render', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    delete process.env.NEXT_STYLES_FULL_URL;
  });

  it('loads the complete sheet itself, once', async () => {
    const view = await renderInBrowser();
    expect(fullLinks().map(link => link.getAttribute('href'))).toEqual([FULL_URL]);
    view.rerender(createElement('div'));
    expect(fullLinks()).toHaveLength(1);
  });

  it('leaves it to the loader when the server wrote the rules', async () => {
    const style = document.createElement('style');
    style.setAttribute('data-href', 'next-styles:b3');
    style.textContent = '.p-2{padding:.5rem}';
    document.head.appendChild(style);
    await renderInBrowser();
    expect(fullLinks()).toHaveLength(0);
  });

  it('adds no second copy when the loader already started it', async () => {
    const link = document.createElement('link');
    link.setAttribute('data-next-styles-full', '');
    link.href = FULL_URL;
    document.head.appendChild(link);
    await renderInBrowser();
    expect(fullLinks()).toHaveLength(1);
  });
});
