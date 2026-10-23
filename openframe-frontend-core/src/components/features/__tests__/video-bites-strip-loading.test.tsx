/**
 * `VideoBitesStrip` in a page's loading state (`LoadingScope`): it draws its skeleton (the heading real, every
 * card a box) instead of nothing. Outside a scope no bites is still no strip.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingScope } from '../../ui/loading-scope';
import { VideoBitesStrip } from '../video-bites-strip';

beforeEach(() => {
  for (const name of ['IntersectionObserver', 'ResizeObserver']) {
    vi.stubGlobal(
      name,
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }
});

describe('VideoBitesStrip in a loading scope', () => {
  it('draws its skeleton when it has no bites', () => {
    render(
      <LoadingScope>
        <VideoBitesStrip bites={[]} />
      </LoadingScope>,
    );
    expect(document.body.innerHTML).toMatch(/<h2[^>]*>.*Key Moments/);
    expect(document.body.innerHTML.match(/bg-ods-skeleton/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('draws nothing where its host usually shows no bites', () => {
    render(
      <LoadingScope>
        <VideoBitesStrip bites={[]} skeletonCount={0} />
      </LoadingScope>,
    );
    expect(document.body.innerHTML).not.toContain('Key Moments');
  });

  it('draws nothing for no bites outside a scope', () => {
    render(<VideoBitesStrip bites={[]} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
