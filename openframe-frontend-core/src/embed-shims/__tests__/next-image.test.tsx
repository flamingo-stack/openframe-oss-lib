/**
 * The image shim ranks a `priority` picture's request high on every host: the
 * plain <img> an embedder gets, and whatever component a host registered.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Image, { registerImage } from '../next-image';

const registered: Record<string, unknown>[] = [];
function HostImage(props: Record<string, unknown>) {
  registered.push(props);
  return null;
}

describe('embed-shims/next-image: priority', () => {
  afterEach(() => {
    registered.length = 0;
    // Back to the plain <img> path for the next case.
    registerImage(null as never);
  });

  it('a plain <img> gets fetchpriority="high" when the picture is priority', () => {
    render(<Image src="/hero.png" alt="hero" priority />);
    expect(screen.getByRole('img', { name: 'hero' }).getAttribute('fetchpriority')).toBe('high');
  });

  it('a plain <img> gets no fetch priority otherwise', () => {
    render(<Image src="/card.png" alt="card" />);
    expect(screen.getByRole('img', { name: 'card' }).hasAttribute('fetchpriority')).toBe(false);
  });

  it("a caller's own fetch priority wins over the default", () => {
    render(<Image src="/hero.png" alt="hero" priority fetchPriority="low" />);
    expect(screen.getByRole('img', { name: 'hero' }).getAttribute('fetchpriority')).toBe('low');
  });

  it('a registered host image is handed fetchPriority="high" with priority', () => {
    registerImage(HostImage);
    render(<Image src="/hero.png" alt="hero" priority />);
    render(<Image src="/card.png" alt="card" />);
    expect(registered.map(props => props.fetchPriority)).toEqual(['high', undefined]);
  });
});
