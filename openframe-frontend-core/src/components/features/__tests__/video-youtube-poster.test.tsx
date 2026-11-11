/**
 * The YouTube poster is the one size every public video has (`hqdefault.jpg`, `youtubePosterUrl`): never a guessed
 * size that can 404 (`maxresdefault`, `sddefault`) and never a WebP copy, which some videos lack at every size.
 * It is drawn before the player is (the page's server HTML carries it) and by the player itself.
 */
import { render } from '@testing-library/react';
import { forwardRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mux/mux-player-react', () => {
  const Fake = forwardRef(() => <div data-testid="mux" />);
  Fake.displayName = 'FakeMuxPlayer';
  return { default: Fake };
});

import { youtubePosterUrl } from '../../../utils/youtube-poster';
import { Video } from '../video';

const ID = 'pqeJFYwnkjE';
const POSTER = `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`;

function imageSources(html: string): string[] {
  return [...html.matchAll(/(?:src|srcSet|srcset)="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
}

describe('Video — YouTube poster', () => {
  it('youtubePosterUrl is the hqdefault JPEG', () => {
    expect(youtubePosterUrl(ID)).toBe(POSTER);
  });

  it('the server HTML carries the poster before the player is drawn', () => {
    const html = renderToString(<Video kind="youtube" url={`https://www.youtube.com/watch?v=${ID}`} />);
    expect(imageSources(html)).toContain(POSTER);
    expect(html).not.toMatch(/maxresdefault|sddefault|vi_webp/);
  });

  it("the box before the player is the facade's own 16:9 box, so nothing moves when the player is drawn", () => {
    const html = renderToString(<Video kind="youtube" url={ID} />);
    expect(html).toMatch(/padding-bottom:56\.25%/);
  });

  it('the player draws the same poster, with no WebP source', () => {
    const { container } = render(<Video kind="youtube" url={ID} title="Demo" lazy={false} />);
    const html = container.innerHTML;
    expect(imageSources(html)).toContain(POSTER);
    expect(html).not.toMatch(/<source/);
    expect(html).not.toMatch(/maxresdefault|sddefault|vi_webp/);
  });

  it("the page's own poster wins", () => {
    const own = 'https://cdn.example.com/poster.jpg';
    const { container } = render(<Video kind="youtube" url={ID} title="Demo" poster={own} lazy={false} />);
    expect(imageSources(container.innerHTML)).toContain(own);
    expect(container.innerHTML).not.toContain('i.ytimg.com');
  });
});
