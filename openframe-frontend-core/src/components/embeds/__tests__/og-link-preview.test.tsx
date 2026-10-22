import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OGLinkPreview } from '../og-link-preview';

/**
 * The `tile` card is drawn from its props alone (no scrape), and a curated
 * card paints at once while the scrape is in flight instead of a skeleton.
 */
describe('OGLinkPreview', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws a tile from its props, with meta and kicker, and never fetches', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <OGLinkPreview
        url="https://news.example.com/story"
        variant="tile"
        curatedTitle="The headline"
        curatedDescription="The excerpt"
        publicationName="Example News"
        meta={<span>Oct 1</span>}
        kicker={<span>Theme</span>}
      />,
    );
    expect(screen.getByText('The headline')).toBeTruthy();
    expect(screen.getByText('The excerpt')).toBeTruthy();
    expect(screen.getByText('Example News')).toBeTruthy();
    expect(screen.getByText('Oct 1')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://news.example.com/story');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('paints a curated card while the scrape is still in flight, and a skeleton without one', () => {
    const curated = renderToString(
      <OGLinkPreview url="https://news.example.com/story" curatedTitle="Curated title" enablePlaceholder={false} />,
    );
    expect(curated).toContain('Curated title');
    expect(curated).not.toContain('animate-pulse');
    const bare = renderToString(<OGLinkPreview url="https://news.example.com/story" enablePlaceholder={false} />);
    expect(bare).toContain('animate-pulse');
  });
});
